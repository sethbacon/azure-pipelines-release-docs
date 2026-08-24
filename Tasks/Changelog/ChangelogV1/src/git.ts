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
        out = run(['tag', '--list', `${tagPrefix}[0-9]*.[0-9]*.[0-9]*`, '--sort=-v:refname']);
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
    const args = ['log', `--max-count=${Math.max(1, Math.floor(limit))}`, `--format=%H%x1f%B${RECORD_FORMAT}`, range];

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
