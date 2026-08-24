/**
 * Conventional-commit parsing for the release task.
 *
 * Deliberately not a dependency on release-please's parser: this task has to
 * agree with release-please's OUTPUT (the estate's repos are release-please
 * managed and their CHANGELOGs must not reshape when this task takes over), but
 * it consumes Azure DevOps history, which release-please never sees.
 */

/** Types that produce a changelog entry, in the order their sections are rendered. */
export const CHANGELOG_TYPES: ReadonlyArray<{ type: string; section: string }> = [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance' },
    { type: 'deps', section: 'Dependencies' },
    { type: 'docs', section: 'Documentation' },
    { type: 'refactor', section: 'Refactor' },
    { type: 'revert', section: 'Reverts' },
    { type: 'security', section: 'Security' },
];

/** Parsed but intentionally unrendered: real releases, no changelog line. */
export const SILENT_TYPES: ReadonlySet<string> = new Set(['chore', 'ci', 'build', 'test', 'style']);

export interface ParsedCommit {
    readonly sha: string;
    readonly type: string;
    readonly scope?: string;
    readonly breaking: boolean;
    readonly subject: string;
}

/**
 * An Azure DevOps PR merge prefixes the squashed subject with `Merged PR 1234: `.
 * Left in place, every conventional commit in an ADO-hosted repo fails to parse
 * and the release is silently empty — which looks identical to "nothing to
 * release" (lab build 366923).
 */
const ADO_MERGE_PREFIX = /^Merged PR \d+:\s*/;

// type(scope)!: subject — scope and the breaking `!` both optional.
const HEADER = /^([a-z]+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

/** A `BREAKING CHANGE:`/`BREAKING-CHANGE:` footer is equivalent to `!` (Conventional Commits v1.0.0 §12). */
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:\s*\S/m;

/**
 * Parse one commit. Returns null for anything non-conventional — a merge bubble,
 * a hand-written subject, a revert of a revert. Null is a skip, never a failure:
 * one unparseable commit in a hundred must not fail a release.
 */
export function parseCommit(sha: string, message: string): ParsedCommit | null {
    if (typeof message !== 'string') return null;
    const normalised = message.replace(/\r\n/g, '\n');
    const firstLine = normalised.split('\n', 1)[0] ?? '';
    const header = firstLine.replace(ADO_MERGE_PREFIX, '').trim();

    const m = HEADER.exec(header);
    if (!m) return null;

    const [, type, scope, bang, subject] = m;
    return {
        sha,
        type,
        scope: scope && scope.length > 0 ? scope : undefined,
        breaking: bang === '!' || BREAKING_FOOTER.test(normalised),
        subject: subject.trim(),
    };
}

/** Parse a batch, dropping everything unparseable. */
export function parseCommits(commits: ReadonlyArray<{ sha: string; message: string }>): ParsedCommit[] {
    const parsed: ParsedCommit[] = [];
    for (const c of commits) {
        const p = parseCommit(c.sha, c.message);
        if (p) parsed.push(p);
    }
    return parsed;
}

/** True when this commit contributes a rendered changelog line. */
export function isRendered(commit: ParsedCommit): boolean {
    if (commit.breaking) return true;
    return CHANGELOG_TYPES.some((t) => t.type === commit.type);
}

/**
 * True when the commit set justifies cutting a release at all. A batch of pure
 * `chore`/`ci` commits is real history and no release: cutting one anyway
 * produces a version whose changelog section is empty.
 */
export function hasReleasableChange(commits: ReadonlyArray<ParsedCommit>): boolean {
    return commits.some((c) => isRendered(c));
}
