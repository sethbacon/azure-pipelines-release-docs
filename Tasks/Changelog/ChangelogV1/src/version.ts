/**
 * Semantic version arithmetic for the release task.
 */

import { ParsedCommit, isRendered } from './conventional';

export interface SemVer {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
}

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Parse `1.2.3` or `v1.2.3`. Rejects pre-release and build metadata rather than guessing at ordering. */
export function parseVersion(raw: string): SemVer | null {
    const m = VERSION.exec(String(raw ?? '').trim());
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function formatVersion(v: SemVer): string {
    return `${v.major}.${v.minor}.${v.patch}`;
}

export function compareVersions(a: SemVer, b: SemVer): number {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** The largest bump the commit set calls for, before any 0.x capping. */
export function bumpTypeFor(commits: ReadonlyArray<ParsedCommit>): BumpType {
    let bump: BumpType = 'none';
    for (const c of commits) {
        if (c.breaking) return 'major';
        if (c.type === 'feat') bump = 'minor';
        else if (bump !== 'minor' && isRendered(c)) bump = 'patch';
    }
    return bump;
}

/**
 * Apply `bump` to `current`.
 *
 * `capZeroMajor` keeps a pre-1.0 package pre-1.0: a breaking change takes
 * 0.3.7 to 0.4.0 rather than to 1.0.0. This mirrors release-please's
 * `bump-minor-pre-major`, which this repository already sets — reaching 1.0.0
 * should be a decision someone makes, not a side effect of the first `feat!`.
 */
export function applyBump(current: SemVer, bump: BumpType, capZeroMajor: boolean): SemVer {
    if (bump === 'none') return current;
    if (bump === 'major') {
        if (capZeroMajor && current.major === 0) return { major: 0, minor: current.minor + 1, patch: 0 };
        return { major: current.major + 1, minor: 0, patch: 0 };
    }
    if (bump === 'minor') return { major: current.major, minor: current.minor + 1, patch: 0 };
    return { major: current.major, minor: current.minor, patch: current.patch + 1 };
}

export function nextVersion(
    current: SemVer,
    commits: ReadonlyArray<ParsedCommit>,
    capZeroMajor: boolean,
): { version: SemVer; bump: BumpType } {
    const bump = bumpTypeFor(commits);
    return { version: applyBump(current, bump, capZeroMajor), bump };
}
