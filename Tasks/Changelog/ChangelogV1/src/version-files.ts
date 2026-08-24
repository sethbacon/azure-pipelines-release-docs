/**
 * Version stamping for files outside the changelog.
 *
 * Mirrors release-please's `extra-files` with a `jsonpath`, restricted to the
 * one shape the estate actually uses (`$.version` in a JSON manifest). A general
 * JSONPath evaluator would be a lot of surface for no current caller.
 */

export interface VersionFile {
    readonly path: string;
    readonly jsonpath: string;
}

/** Parse `path#$.version` lines. Blank lines and `#`-comments are skipped. */
export function parseVersionFiles(raw: string | undefined): VersionFile[] {
    const files: VersionFile[] = [];
    for (const line of String(raw ?? '').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const at = trimmed.lastIndexOf('#');
        if (at <= 0) {
            files.push({ path: trimmed, jsonpath: '$.version' });
            continue;
        }
        files.push({ path: trimmed.slice(0, at).trim(), jsonpath: trimmed.slice(at + 1).trim() });
    }
    return files;
}

/** Only `$.a.b` dotted paths — no wildcards, filters or recursive descent. */
const DOTTED = /^\$(?:\.[A-Za-z_$][\w$]*)+$/;

export function isSupportedJsonPath(jsonpath: string): boolean {
    return DOTTED.test(jsonpath);
}

/**
 * Set `jsonpath` to `version` in `json`, preserving the file's existing
 * indentation and trailing newline so the diff is one line.
 *
 * Returns null when the path does not resolve — a silent no-op here would ship a
 * release whose manifest still claims the previous version.
 */
export function stampJson(source: string, jsonpath: string, version: string): string | null {
    if (!isSupportedJsonPath(jsonpath)) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        return null;
    }

    const segments = jsonpath.slice(2).split('.');
    let cursor: Record<string, unknown> = parsed as Record<string, unknown>;
    for (const segment of segments.slice(0, -1)) {
        const next = cursor?.[segment];
        if (!next || typeof next !== 'object') return null;
        cursor = next as Record<string, unknown>;
    }
    const leaf = segments[segments.length - 1];
    if (!cursor || typeof cursor !== 'object' || !(leaf in cursor)) return null;

    cursor[leaf] = version;

    const indent = detectIndent(source);
    const trailing = source.endsWith('\n') ? '\n' : '';
    return JSON.stringify(parsed, null, indent) + trailing;
}

function detectIndent(source: string): number {
    const m = /\n(\s+)"/.exec(source);
    return m ? m[1].replace(/\t/g, '    ').length : 2;
}
