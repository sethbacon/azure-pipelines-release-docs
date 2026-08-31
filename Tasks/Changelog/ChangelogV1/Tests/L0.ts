/**
 * Tests for the Changelog task.
 *
 * The cases that matter are the ones the plan's threat model and the lab build
 * named, not the happy path: an ADO merge prefix that silently empties a
 * release, a splice that buries the document title, a commit subject that
 * restructures the changelog, a version file that does not stamp, and a PR
 * description that Azure DevOps would reject rather than truncate.
 */

import assert = require('assert');
import cp = require('child_process');
import fs = require('fs');
import os = require('os');
import path = require('path');
import tasks = require('azure-pipelines-task-lib/task');

import { parseCommit, parseCommits, hasReleasableChange, isRendered } from '../src/conventional';
import { parseVersion, formatVersion, bumpTypeFor, applyBump, nextVersion } from '../src/version';
import { renderRelease, spliceRelease } from '../src/changelog';
import { parseVersionFiles, stampJson, isSupportedJsonPath } from '../src/version-files';
import { sanitizeOutputVariableValue } from '../src/output-variable';
import { isWithinWorkingDirectory } from '../src/path-containment';
import { commitsSince, defaultRunner, latestReleaseTag } from '../src/git';
import { parseJson, resolveToken, adoRequest } from '../src/ado-client';
import {
    releaseBranchName,
    fitDescription,
    MAX_DESCRIPTION,
    findOpenReleasePr,
    createReleasePr,
    updateReleasePr,
} from '../src/release-pr';

const at = (type: string, subject: string, extra = '') =>
    parseCommit('abc1234', `${type}: ${subject}${extra ? `\n\n${extra}` : ''}`)!;

describe('conventional: parsing', () => {
    it('parses type, scope, breaking marker and subject', () => {
        const c = parseCommit('sha', 'feat(api)!: drop v1 endpoints')!;
        assert.strictEqual(c.type, 'feat');
        assert.strictEqual(c.scope, 'api');
        assert.strictEqual(c.breaking, true);
        assert.strictEqual(c.subject, 'drop v1 endpoints');
    });

    it('strips the Azure DevOps "Merged PR N:" prefix — without it every ADO merge silently drops', () => {
        const c = parseCommit('sha', 'Merged PR 1234: fix(auth): reject an expired token');
        assert.ok(c, 'an ADO-prefixed conventional commit must still parse');
        assert.strictEqual(c!.type, 'fix');
        assert.strictEqual(c!.scope, 'auth');
    });

    it('treats a BREAKING CHANGE footer as breaking, per Conventional Commits §12', () => {
        assert.strictEqual(at('feat', 'new flag', 'BREAKING CHANGE: removes the old one').breaking, true);
        assert.strictEqual(at('feat', 'new flag', 'BREAKING-CHANGE: removes the old one').breaking, true);
    });

    it('finds a BREAKING CHANGE footer buried in a real squash-merge (COMMIT_MESSAGES) message', () => {
        // Reproduces this repository's own squash shape verbatim, not a hand-invented one --
        // see .github/commit-message-check/verify.mjs, whose `body` line is
        // `source.map(commit => \`* ${commit.message}\`).join('\n\n')` under this repo's actual
        // squash settings (COMMIT_OR_PR_TITLE / COMMIT_MESSAGES, confirmed live via
        // `gh api repos/sethbacon/azure-pipelines-release-docs`). This task only ever reads
        // Azure DevOps history, but the failure mode this guards against -- a footer detector
        // that only checks the paragraph right after the header and never reaches a footer
        // buried a few bullets deep in a multi-commit squash -- is the same regardless of which
        // host produced the squash.
        const header = 'chore: batch release (#4821)';
        const originalCommits = [
            'fix(auth): reject an expired refresh token',
            'feat(api)!: remove the deprecated v1 export endpoint\n\nBREAKING CHANGE: /api/v1/export is removed; callers must use /api/v2/export',
        ];
        const body = originalCommits.map((m) => `* ${m}`).join('\n\n');
        const squashed = `${header}\n\n${body}`;

        const c = parseCommit('sha', squashed)!;
        assert.ok(c, 'the PR-title header must still parse as a conventional commit');
        assert.strictEqual(c.type, 'chore');
        assert.strictEqual(c.breaking, true, 'a footer several bullets deep in the squashed body must still be found');
    });

    it('does not false-positive on a squashed bullet that merely mentions "breaking" in prose', () => {
        const header = 'fix: batch release (#4900)';
        const originalCommits = [
            'fix(cache): avoid a breaking change to the eviction order',
            'docs: note the change above is not breaking for existing callers',
        ];
        const body = originalCommits.map((m) => `* ${m}`).join('\n\n');
        const squashed = `${header}\n\n${body}`;

        assert.strictEqual(parseCommit('sha', squashed)!.breaking, false);
    });

    it('returns null for a non-conventional subject rather than throwing', () => {
        assert.strictEqual(parseCommit('sha', 'update stuff'), null);
        assert.strictEqual(parseCommit('sha', ''), null);
    });

    it('drops unparseable commits from a batch instead of failing the release', () => {
        const parsed = parseCommits([
            { sha: '1', message: 'feat: a' },
            { sha: '2', message: 'merge branch main' },
            { sha: '3', message: 'fix: b' },
        ]);
        assert.strictEqual(parsed.length, 2);
    });

    it('does not render silent types, and a release of only silent types is no release', () => {
        assert.strictEqual(isRendered(at('chore', 'tidy')), false);
        assert.strictEqual(isRendered(at('ci', 'bump action')), false);
        assert.strictEqual(hasReleasableChange([at('chore', 'x'), at('test', 'y')]), false);
        assert.strictEqual(hasReleasableChange([at('chore', 'x'), at('fix', 'y')]), true);
    });

    it('renders a breaking chore, because the break is the point', () => {
        assert.strictEqual(isRendered(parseCommit('s', 'chore!: drop node 18')!), true);
    });
});

describe('version: bump arithmetic', () => {
    it('parses with and without the v prefix and rejects pre-release', () => {
        assert.deepStrictEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3 });
        assert.deepStrictEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3 });
        assert.strictEqual(parseVersion('1.2.3-rc.1'), null);
    });

    it('takes the largest bump the set calls for', () => {
        assert.strictEqual(bumpTypeFor([at('fix', 'a')]), 'patch');
        assert.strictEqual(bumpTypeFor([at('fix', 'a'), at('feat', 'b')]), 'minor');
        assert.strictEqual(bumpTypeFor([at('fix', 'a'), parseCommit('s', 'feat!: c')!]), 'major');
        assert.strictEqual(bumpTypeFor([at('chore', 'a')]), 'none');
    });

    it('caps a 0.x major by default: 0.3.7 -> 0.4.0, not 1.0.0', () => {
        assert.strictEqual(formatVersion(applyBump({ major: 0, minor: 3, patch: 7 }, 'major', true)), '0.4.0');
    });

    it('reaches 1.0.0 when the cap is off', () => {
        assert.strictEqual(formatVersion(applyBump({ major: 0, minor: 3, patch: 7 }, 'major', false)), '1.0.0');
    });

    it('never caps a 1.x major', () => {
        assert.strictEqual(formatVersion(applyBump({ major: 1, minor: 4, patch: 2 }, 'major', true)), '2.0.0');
    });

    it('zeroes the lower components on a minor bump', () => {
        assert.strictEqual(formatVersion(applyBump({ major: 1, minor: 4, patch: 9 }, 'minor', true)), '1.5.0');
    });

    it('leaves the version alone when nothing is releasable', () => {
        const { version, bump } = nextVersion({ major: 1, minor: 0, patch: 0 }, [at('chore', 'x')], true);
        assert.strictEqual(bump, 'none');
        assert.strictEqual(formatVersion(version), '1.0.0');
    });
});

describe('changelog: rendering and splicing', () => {
    const section = () =>
        renderRelease({
            version: { major: 1, minor: 2, patch: 0 },
            date: '2026-08-24',
            commits: [at('feat', 'add a thing'), at('fix', 'stop a crash')],
        });

    it('groups commits under their section headings', () => {
        const s = section();
        assert.ok(s.includes('## 1.2.0 (2026-08-24)'));
        assert.ok(s.includes('### Features'));
        assert.ok(s.includes('* add a thing'));
        assert.ok(s.includes('### Bug Fixes'));
    });

    it('splices BELOW the title and preamble, not above them', () => {
        const existing = '# Changelog\n\nAll notable changes.\n\n## 1.1.0 (2026-01-01)\n\n* old\n';
        const out = spliceRelease(existing, section());
        assert.ok(out.startsWith('# Changelog'), 'the document title must stay first');
        assert.ok(out.indexOf('## 1.2.0') < out.indexOf('## 1.1.0'), 'the new release goes above the old one');
        assert.ok(out.indexOf('All notable changes.') < out.indexOf('## 1.2.0'), 'the preamble stays above releases');
    });

    it('appends after a preamble that has no releases yet', () => {
        const out = spliceRelease('# Changelog\n\nAll notable changes.\n', section());
        assert.ok(out.startsWith('# Changelog'));
        assert.ok(out.includes('## 1.2.0'));
    });

    it('creates a titled file when there is no changelog at all', () => {
        const out = spliceRelease('', section());
        assert.ok(out.startsWith('# Changelog\n'));
    });

    it('neutralises a commit subject that would restructure the document', () => {
        const s = renderRelease({
            version: { major: 1, minor: 0, patch: 0 },
            date: '2026-08-24',
            commits: [parseCommit('s', 'feat: # Injected Heading')!],
        });
        assert.ok(!/^#\s+Injected/m.test(s), 'a subject must not become a markdown heading');
    });

    it('keeps a multi-line subject on one bullet', () => {
        const s = renderRelease({
            version: { major: 1, minor: 0, patch: 0 },
            date: '2026-08-24',
            commits: [{ sha: 's', type: 'feat', breaking: false, subject: 'line one\nline two' }],
        });
        assert.ok(s.includes('* line one line two'));
    });
});

describe('version-files: stamping', () => {
    it('parses bare paths and path#jsonpath pairs', () => {
        const files = parseVersionFiles('package.json\nazure-devops-extension.json#$.version\n# a comment\n');
        assert.deepStrictEqual(files, [
            { path: 'package.json', jsonpath: '$.version' },
            { path: 'azure-devops-extension.json', jsonpath: '$.version' },
        ]);
    });

    it('rejects a jsonpath beyond simple dotted access', () => {
        assert.strictEqual(isSupportedJsonPath('$.version'), true);
        assert.strictEqual(isSupportedJsonPath('$.a.b.c'), true);
        assert.strictEqual(isSupportedJsonPath('$..version'), false);
        assert.strictEqual(isSupportedJsonPath('$.items[0]'), false);
    });

    it('stamps the value and preserves indentation and trailing newline', () => {
        const src = '{\n  "name": "x",\n  "version": "1.0.0"\n}\n';
        const out = stampJson(src, '$.version', '1.1.0')!;
        assert.ok(out.includes('"version": "1.1.0"'));
        assert.ok(out.endsWith('}\n'));
        assert.ok(out.includes('\n  "name"'), 'two-space indent preserved');
    });

    it('returns null when the path does not resolve, so the caller can fail loudly', () => {
        assert.strictEqual(stampJson('{"name":"x"}', '$.version', '1.1.0'), null);
        assert.strictEqual(stampJson('{"a":{"b":1}}', '$.a.c', '1.1.0'), null);
        assert.strictEqual(stampJson('not json', '$.version', '1.1.0'), null);
    });

    it('refuses a path segment that reaches the prototype chain', () => {
        // Every one of these satisfies the DOTTED grammar, and the leaf test used
        // to be `in`, which walks the prototype chain -- so `$.__proto__.toString`
        // resolved and assigned onto Object.prototype for the rest of the process.
        assert.strictEqual(isSupportedJsonPath('$.__proto__.toString'), false);
        assert.strictEqual(isSupportedJsonPath('$.constructor.prototype.x'), false);
        assert.strictEqual(isSupportedJsonPath('$.a.prototype'), false);

        assert.strictEqual(stampJson('{"a":1}', '$.__proto__.toString', 'pwned'), null);
        assert.strictEqual(({} as Record<string, unknown>)['toString'], Object.prototype.toString);
        assert.strictEqual(stampJson('{"a":1}', '$.constructor.prototype.polluted', 'pwned'), null);
        assert.strictEqual(({} as Record<string, unknown>)['polluted'], undefined);
    });

    it('walks only own properties, so an inherited name is not a resolvable path', () => {
        assert.strictEqual(stampJson('{"a":1}', '$.hasOwnProperty', 'x'), null);
        assert.strictEqual(stampJson('{"a":1}', '$.toString', 'x'), null);
        assert.strictEqual(stampJson('[1,2]', '$.toString', 'x'), null);
    });
});

describe('output-variable: the setVariable boundary', () => {
    it('rejects a value carrying a newline, which would forge a second logging command', () => {
        assert.strictEqual(
            sanitizeOutputVariableValue('1.2.3\n##vso[task.setvariable variable=pwned]1'),
            null,
        );
        assert.strictEqual(sanitizeOutputVariableValue('\r\n'), null);
    });

    it('rejects a non-string value, which an `as string` cast would have let through', () => {
        assert.strictEqual(sanitizeOutputVariableValue({ nested: true }), null);
        assert.strictEqual(sanitizeOutputVariableValue(undefined), null);
        assert.strictEqual(sanitizeOutputVariableValue(42), '42');
    });

    it('caps length and passes an ordinary value through unchanged', () => {
        assert.strictEqual(sanitizeOutputVariableValue('x'.repeat(1025)), null);
        assert.strictEqual(sanitizeOutputVariableValue('1.2.3'), '1.2.3');
        assert.strictEqual(sanitizeOutputVariableValue('minor'), 'minor');
    });
});

describe('path-containment: the write boundary', () => {
    it('accepts the working directory itself and its descendants', () => {
        const base = fs.realpathSync(os.tmpdir());
        assert.strictEqual(isWithinWorkingDirectory(base, base), true);
        assert.strictEqual(isWithinWorkingDirectory(path.join(base, 'a', 'b.md'), base), true);
    });

    it('rejects a traversal out of the working directory', () => {
        const base = path.join(fs.realpathSync(os.tmpdir()), 'wd');
        assert.strictEqual(isWithinWorkingDirectory(path.resolve(base, '../../etc/passwd'), base), false);
        assert.strictEqual(isWithinWorkingDirectory(path.resolve(base, '..', 'sibling.md'), base), false);
    });

    it('rejects a target that only stays inside lexically, via a symlink', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'containment-'));
        const base = path.join(root, 'work');
        const outside = path.join(root, 'outside');
        fs.mkdirSync(base);
        fs.mkdirSync(outside);
        // Deliberately unguarded: 'junction' needs no privilege on Windows and
        // symlinkSync always works elsewhere, so a throw here is a real finding.
        // A this.skip() would mark the test pending, which --forbid-pending fails.
        fs.symlinkSync(outside, path.join(base, 'link'), 'junction');
        // path.resolve alone says this is under base; realpath says it is not.
        assert.strictEqual(isWithinWorkingDirectory(path.join(base, 'link', 'x.md'), base), false);
    });
});

describe('git: history reading', () => {
    it('asks for tags by version order, not tag date', () => {
        const calls: string[][] = [];
        const tag = latestReleaseTag((args) => {
            calls.push(args);
            return 'v1.3.0\nv1.2.0\n';
        }, 'v');
        assert.strictEqual(tag, 'v1.3.0');
        assert.ok(calls[0].includes('--sort=-v:refname'));
    });

    it('returns null when the repository has never been tagged', () => {
        assert.strictEqual(latestReleaseTag(() => '', 'v'), null);
        assert.strictEqual(latestReleaseTag(() => { throw new Error('no tags'); }, 'v'), null);
    });

    it('bounds the commit count it requests', () => {
        const calls: string[][] = [];
        commitsSince((args) => { calls.push(args); return ''; }, 'v1.0.0', 250);
        assert.ok(calls[0].some((a) => a === '--max-count=250'));
        assert.ok(calls[0].includes('v1.0.0..HEAD'));
    });

    it('passes the range as one argv element, never as an interpolated string', () => {
        const calls: string[][] = [];
        commitsSince((args) => { calls.push(args); return ''; }, null, 10);
        assert.ok(calls[0].includes('HEAD'));
        assert.ok(calls[0].every((a) => typeof a === 'string'));
    });

    it('puts no NUL in argv — Node rejects such an argument, and the throw reads as "nothing to release"', () => {
        const calls: string[][] = [];
        commitsSince((args) => { calls.push(args); return ''; }, 'v1.0.0', 10);
        for (const arg of calls[0]) {
            assert.ok(!arg.includes('\u0000'), `argv element must not contain a NUL: ${JSON.stringify(arg)}`);
        }
    });

    it('splits records so a multi-line commit body stays with its sha', () => {
        const out = commitsSince(
            () => 'aaa\u001ffeat: one\n\nbody line\u0000bbb\u001ffix: two\u0000',
            null,
            10,
        );
        assert.strictEqual(out.length, 2);
        assert.strictEqual(out[0].sha, 'aaa');
        assert.ok(out[0].message.includes('body line'));
        assert.strictEqual(out[1].sha, 'bbb');
    });

    it('places --end-of-options immediately before the tagPrefix-derived pattern, so a dash-leading tagPrefix can never be read as a git tag flag', () => {
        const calls: string[][] = [];
        latestReleaseTag((args) => { calls.push(args); return ''; }, '-nonexistent-flag');
        const patternIndex = calls[0].findIndex((a) => a.startsWith('-nonexistent-flag'));
        assert.ok(patternIndex > 0, `pattern not found in argv: ${JSON.stringify(calls[0])}`);
        assert.strictEqual(calls[0][patternIndex - 1], '--end-of-options');
    });

    it('places --end-of-options immediately before the range, so a dash-leading tag can never be read as a git log flag', () => {
        const calls: string[][] = [];
        commitsSince((args) => { calls.push(args); return ''; }, '-evilflag', 10);
        const rangeIndex = calls[0].indexOf('-evilflag..HEAD');
        assert.ok(rangeIndex > 0, `range not found in argv: ${JSON.stringify(calls[0])}`);
        assert.strictEqual(calls[0][rangeIndex - 1], '--end-of-options');
    });

    it('never lets an option-like tag reach the real git process as a working flag (e.g. write a file via --output=)', function () {
        this.timeout(20000);
        const repo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'changelog-git-argv-'));
        try {
            const git = (...args: string[]) =>
                cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
            git('init', '--quiet', '--initial-branch=main');
            git('config', 'user.email', 'test@example.invalid');
            git('config', 'user.name', 'Test');
            git('config', 'commit.gpgsign', 'false');
            fs.writeFileSync(path.join(repo, 'f.txt'), 'x');
            git('add', '.');
            git('commit', '--quiet', '-m', 'chore: seed');

            const before = new Set(fs.readdirSync(repo));
            // `git log`'s real `--output=<file>` flag WRITES the named file instead of
            // printing to stdout -- a genuine, damaging outcome if this ever reaches
            // git as a parsed option rather than as a literal (non-matching) revision.
            const decoy = 'pwned-by-tag';
            commitsSince(defaultRunner(repo), `--output=${decoy}`, 10);
            const after = fs.readdirSync(repo).filter((f) => !before.has(f));
            assert.deepStrictEqual(after, [], `git must never have written a new file from the tag value, found: ${JSON.stringify(after)}`);
        } finally {
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });
});

describe('release-pr: description and branch', () => {
    it('derives a stable release branch so a re-run updates its own PR', () => {
        assert.strictEqual(releaseBranchName('main'), 'release/main');
        assert.strictEqual(releaseBranchName('refs/heads/main'), 'release/main');
    });

    it('fits a long description under the 4000-character cap Azure DevOps rejects past', () => {
        const long = 'x'.repeat(MAX_DESCRIPTION + 500);
        const fitted = fitDescription(long, 'https://example.invalid/notes');
        assert.ok(fitted.length <= MAX_DESCRIPTION, `got ${fitted.length}`);
        assert.ok(fitted.includes('Truncated'));
    });

    it('leaves a short description untouched', () => {
        assert.strictEqual(fitDescription('short'), 'short');
    });

    it('leaves a description of exactly the 4000-character cap untouched', () => {
        const exact = 'x'.repeat(MAX_DESCRIPTION);
        assert.strictEqual(fitDescription(exact), exact);
    });

    it('truncates a description one character past the cap', () => {
        const overByOne = 'x'.repeat(MAX_DESCRIPTION + 1);
        const fitted = fitDescription(overByOne);
        assert.ok(fitted.length <= MAX_DESCRIPTION, `got ${fitted.length}`);
        assert.ok(fitted.includes('Truncated'));
        assert.notStrictEqual(fitted, overByOne);
    });
});

describe('ado-client: response handling', () => {
    const url = 'https://dev.azure.invalid/x?token=abc';

    it('parses a 2xx body', () => {
        assert.deepStrictEqual(parseJson<{ a: number }>({ status: 200, body: '{"a":1}', url }, 'thing'), { a: 1 });
    });

    it('fails a non-2xx with the status, and scrubs the URL out of the detail', () => {
        assert.throws(
            () => parseJson({ status: 403, body: `denied at ${url}`, url }, 'create'),
            (e: Error) => {
                assert.ok(/403/.test(e.message), e.message);
                assert.ok(!/token=abc/.test(e.message), 'the query string must not survive into the message');
                return true;
            },
        );
    });

    it('reports an unparseable 2xx body as such, not as a parser crash', () => {
        assert.throws(() => parseJson({ status: 200, body: '<html>', url }, 'list'));
    });
});

describe('ado-client: token and retry policy', () => {
    const connection = { collectionUri: 'https://d.invalid/o', project: 'P', repositoryId: 'R', token: 'tok' };
    const endpoint = 'https://dev.azure.invalid/o/P/_apis/git/repositories/R/pullrequests?api-version=7.1';

    const patched: { secrets: string[]; restore: () => void } = { secrets: [], restore: () => undefined };

    beforeEach(() => {
        const lib = tasks as unknown as Record<string, unknown>;
        const origSetSecret = lib['setSecret'];
        const origParam = lib['getEndpointAuthorizationParameter'];
        patched.secrets = [];
        lib['setSecret'] = (v: string) => { patched.secrets.push(v); };
        patched.restore = () => {
            lib['setSecret'] = origSetSecret;
            lib['getEndpointAuthorizationParameter'] = origParam;
        };
    });
    afterEach(() => patched.restore());

    it('masks the token AND its base64 Basic form, which is what actually travels', () => {
        (tasks as unknown as Record<string, unknown>)['getEndpointAuthorizationParameter'] = () => 'secret-token';
        const token = resolveToken();
        assert.strictEqual(token, 'secret-token');
        assert.ok(patched.secrets.includes('secret-token'), 'raw token masked');
        assert.ok(
            patched.secrets.includes(Buffer.from(':secret-token').toString('base64')),
            'the base64 header form must be masked too',
        );
    });

    it('prefers an explicit token over the job identity', () => {
        (tasks as unknown as Record<string, unknown>)['getEndpointAuthorizationParameter'] = () => 'job-token';
        assert.strictEqual(resolveToken('explicit'), 'explicit');
    });

    it('fails loudly when no token is available at all', () => {
        (tasks as unknown as Record<string, unknown>)['getEndpointAuthorizationParameter'] = () => '';
        assert.throws(() => resolveToken());
    });

    it('retries a 429 and returns the eventual success', async () => {
        let calls = 0;
        const result = await adoRequest(connection, 'GET', endpoint, undefined, async () => {
            calls += 1;
            return calls < 3 ? { status: 429, body: '' } : { status: 200, body: '{"ok":true}' };
        });
        assert.strictEqual(result.status, 200);
        assert.strictEqual(calls, 3);
    });

    it('does NOT retry a received 4xx — repeating it cannot change the answer', async () => {
        let calls = 0;
        const result = await adoRequest(connection, 'GET', endpoint, undefined, async () => {
            calls += 1;
            return { status: 403, body: 'denied' };
        });
        assert.strictEqual(result.status, 403);
        assert.strictEqual(calls, 1, 'a 403 must be asked exactly once');
    });

    it('sends a JSON body as a Buffer with a content type', async () => {
        let seen: { headers?: Record<string, string>; body?: Buffer } = {};
        await adoRequest(connection, 'POST', endpoint, { a: 1 }, async (options) => {
            seen = options;
            return { status: 200, body: '{}' };
        });
        assert.ok(Buffer.isBuffer(seen.body), 'the body must be an encoded Buffer');
        assert.strictEqual(seen.headers?.['Content-Type'], 'application/json');
        assert.ok(seen.headers?.Authorization?.startsWith('Basic '), 'Basic auth header');
    });

    it('sends no body and no content type on a GET', async () => {
        let seen: { headers?: Record<string, string>; body?: Buffer } = {};
        await adoRequest(connection, 'GET', endpoint, undefined, async (options) => {
            seen = options;
            return { status: 200, body: '{}' };
        });
        assert.strictEqual(seen.body, undefined);
        assert.strictEqual(seen.headers?.['Content-Type'], undefined);
    });
});

describe('release-pr: REST shape', () => {
    const connection = {
        collectionUri: 'https://dev.azure.invalid/org/',
        project: 'Proj',
        repositoryId: 'repo-id',
        token: 'tok',
    };
    const ok = (body: unknown) => async () => ({ status: 200, body: JSON.stringify(body), url: 'u' });

    it('finds an existing open release PR', async () => {
        const found = await findOpenReleasePr(
            connection, 'release/main', 'main',
            ok({ value: [{ pullRequestId: 7, sourceRefName: 'refs/heads/release/main' }] }),
        );
        assert.strictEqual(found?.pullRequestId, 7);
    });

    it('returns null when none is open, so the caller creates one', async () => {
        assert.strictEqual(await findOpenReleasePr(connection, 'release/main', 'main', ok({ value: [] })), null);
    });

    it('sends fully-qualified refs when creating', async () => {
        let sent: Record<string, unknown> = {};
        const created = await createReleasePr(
            connection, 'release/main', 'main', 'title', 'body',
            async (_c, _m, _u, body) => {
                sent = body as Record<string, unknown>;
                return { status: 200, body: '{"pullRequestId":9}', url: 'u' };
            },
        );
        assert.strictEqual(created.pullRequestId, 9);
        assert.strictEqual(sent.sourceRefName, 'refs/heads/release/main');
        assert.strictEqual(sent.targetRefName, 'refs/heads/main');
    });

    it('PATCHes an existing PR by id', async () => {
        let method = '';
        let seen = '';
        await updateReleasePr(connection, 11, 't', 'd', async (_c, m, u) => {
            method = m;
            seen = u;
            return { status: 200, body: '{}', url: u };
        });
        assert.strictEqual(method, 'PATCH');
        assert.ok(seen.includes('/pullrequests/11'), seen);
    });

    it('rejects a project id that would escape the URL path', async () => {
        await assert.rejects(
            findOpenReleasePr({ ...connection, project: '../../evil' }, 'release/main', 'main', ok({ value: [] })),
        );
    });
});

describe('entry point: a release is cut end to end', () => {
    it('writes below the title, stamps the manifest and publishes the outputs', () => {
        const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'EntryPointRelease.js')], {
            encoding: 'utf8',
            timeout: 120000,
        });
        const stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
        const scratch = path.join(__dirname, '.scratch', 'entrypoint-release');

        const changelog = fs.readFileSync(path.join(scratch, 'CHANGELOG.md'), 'utf8');
        const manifest = JSON.parse(fs.readFileSync(path.join(scratch, 'manifest.json'), 'utf8'));

        assert.ok(changelog.startsWith('# Changelog'), `title must stay first:\n${changelog}`);
        assert.ok(/## 0\.2\.0/.test(changelog), `expected a 0.2.0 section:\n${changelog}`);
        assert.ok(/add the thing/.test(changelog), 'the feat is listed');
        assert.ok(/stop the crash/.test(changelog), 'the ADO-prefixed fix is listed');
        assert.strictEqual(manifest.version, '0.2.0', 'the manifest is stamped');
        assert.ok(/nextVersion/.test(stdout), `expected the output variable in:\n${stdout.slice(0, 2000)}`);
    });
});

describe('entry point: nothing releasable', () => {
    it('reports no release and leaves the changelog byte-identical', () => {
        cp.spawnSync(process.execPath, [path.join(__dirname, 'EntryPointNoRelease.js')], {
            encoding: 'utf8',
            timeout: 120000,
        });
        const scratch = path.join(__dirname, '.scratch', 'entrypoint-noop');
        const changelog = fs.readFileSync(path.join(scratch, 'CHANGELOG.md'), 'utf8');
        assert.strictEqual(changelog, '# Changelog\n\nAll notable changes.\n', 'an all-chore batch must write nothing');
    });
});

describe('entry point: a throw during early setup is reported, not crashed', () => {
    it('reports a clean Failed result when setResourcePath throws, instead of an unhandled-rejection crash (finding 1 of #133)', () => {
        const result = cp.spawnSync(process.execPath, [path.join(__dirname, 'EntryPointSetResourcePathThrows.js')], {
            encoding: 'utf8',
            timeout: 120000,
        });
        const stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
        assert.strictEqual(result.status, 0, `the task process must exit cleanly, not crash uncaught:\n${stdout.slice(0, 2000)}`);
        // The raw message, with no "Unhandled: " prefix and no accompanying stack-trace
        // issue, proves the task's OWN catch block handled this -- not azure-pipelines-
        // task-lib's generic process-level uncaughtException/unhandledRejection fallback
        // (registered as an import side effect in task.js), which reports a
        // differently-worded "Unhandled: <message>" result instead.
        assert.ok(
            /task\.complete result=Failed;\]boom-from-setResourcePath$/m.test(stdout),
            `expected the task's own catch to report the raw message with no wrapper:\n${stdout.slice(0, 2000)}`
        );
        assert.ok(
            !/Unhandled: boom-from-setResourcePath/.test(stdout),
            `must not fall through to azure-pipelines-task-lib's generic unhandled-exception reporting:\n${stdout.slice(0, 2000)}`
        );
    });
});
