/**
 * Git history reading.
 *
 * EVERY invocation goes through execFileSync with an ARGV ARRAY. A commit
 * subject, a branch name and a tag are all attacker-influenced in a repository
 * that accepts pull requests, so none of them may ever reach a shell. There is
 * no string-concatenated git command in this file and there must never be one.
 */

import { execFileSync } from 'child_process';

/**
 * Separates commits in `git log` output. Written as git's own `%x00` escape,
 * never as a literal NUL in the argument: Node refuses to pass an argv string
 * containing one, and `commitsSince` swallows the throw, so a literal here makes
 * every history read return "no commits" — indistinguishable from a repository
 * with nothing to release.
 */
const RECORD_FORMAT = '%x00';
const RECORD = '\u0000';
const FIELD = '\u001f';

export interface RawCommit {
    readonly sha: string;
    readonly message: string;
}

export interface GitRunner {
    (args: string[]): string;
}

export function defaultRunner(cwd: string): GitRunner {
    return (args: string[]) =>
        execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            windowsHide: true,
        });
}

/**
 * The most recent tag matching `<prefix><semver>`, or null when the repository
 * has never been tagged.
 *
 * `--sort=-v:refname` orders by version rather than by tag date, so a hotfix
 * tagged today on an old branch does not become "the last release".
 */
export function latestReleaseTag(run: GitRunner, tagPrefix: string): string | null {
    let out: string;
    try {
        // `--end-of-options` forces every argument after it to be read as a
        // positional value, never as a flag -- without it, a `tagPrefix` task
        // input starting with `-` (e.g. `-nonexistent-flag`) makes the pattern
        // argument look like an option to `git tag` itself instead of the glob
        // it actually is.
        out = run(['tag', '--list', '--sort=-v:refname', '--end-of-options', `${tagPrefix}[0-9]*.[0-9]*.[0-9]*`]);
    } catch {
        return null;
    }
    const first = out.split('\n').map((l) => l.trim()).filter(Boolean)[0];
    return first ?? null;
}

/**
 * Commits reachable from HEAD but not from `sinceTag` (or the whole history when
 * there is no tag yet), newest first and capped at `limit`.
 *
 * The cap is not cosmetic: an untagged repository asked for its whole history
 * will otherwise buffer every commit it has ever had into the agent's memory.
 */
export function commitsSince(
    run: GitRunner,
    sinceTag: string | null,
    limit: number,
): RawCommit[] {
    const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD';
    // `--end-of-options` (placed after every flag, immediately before the
    // revision range) forces `range` to be read as a positional revision
    // argument, never as an option -- git ref names cannot themselves start
    // with `-`, but this keeps the guarantee independent of that constraint
    // rather than resting on it. It must come before `range`, not via a bare
    // `--`: a bare `--` here would instead mark the start of *pathspecs* for
    // `git log`, silently reinterpreting the revision range as a (non-
    // matching) path and dropping every commit rather than erroring.
    const args = [
        'log',
        `--max-count=${Math.max(1, Math.floor(limit))}`,
        `--format=%H%x1f%B${RECORD_FORMAT}`,
        '--end-of-options',
        range,
    ];

    let out: string;
    try {
        out = run(args);
    } catch {
        return [];
    }

    const commits: RawCommit[] = [];
    for (const record of out.split(RECORD)) {
        const trimmed = record.replace(/^\s+/, '');
        if (!trimmed) continue;
        const sep = trimmed.indexOf(FIELD);
        if (sep === -1) continue;
        commits.push({ sha: trimmed.slice(0, sep).trim(), message: trimmed.slice(sep + 1).trim() });
    }
    return commits;
}
