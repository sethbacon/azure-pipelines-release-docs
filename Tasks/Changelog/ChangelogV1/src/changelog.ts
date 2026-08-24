/**
 * CHANGELOG.md rendering and splicing.
 */

import { CHANGELOG_TYPES, ParsedCommit } from './conventional';
import { SemVer, formatVersion } from './version';

/**
 * Where a new release section begins.
 *
 * A naive prepend puts the new section ABOVE the `# Changelog` title and the
 * Keep a Changelog preamble, which is how the file ends up with its heading
 * buried a release deeper on every run (lab build 366923). The insertion point
 * is: immediately before the first existing release heading, or — when there is
 * none yet — at the end of the preamble.
 */
const RELEASE_HEADING = /^##\s+\[?v?\d+\.\d+\.\d+/m;

/** Markdown control characters that would let a commit subject restructure the document. */
function escapeSubject(subject: string): string {
    return subject
        .replace(/[\r\n]+/g, ' ')
        .replace(/^\s*#+\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .trim();
}

export interface RenderOptions {
    readonly version: SemVer;
    readonly date: string;
    readonly commits: ReadonlyArray<ParsedCommit>;
    readonly compareUrl?: string;
}

/** Render one release section, including its trailing blank line. */
export function renderRelease(options: RenderOptions): string {
    const { version, date, commits, compareUrl } = options;
    const heading = compareUrl
        ? `## [${formatVersion(version)}](${compareUrl}) (${date})`
        : `## ${formatVersion(version)} (${date})`;

    const lines: string[] = [heading, ''];

    const breaking = commits.filter((c) => c.breaking);
    if (breaking.length > 0) {
        lines.push('### ⚠ BREAKING CHANGES', '');
        for (const c of breaking) lines.push(`* ${bullet(c)}`);
        lines.push('');
    }

    for (const { type, section } of CHANGELOG_TYPES) {
        const inSection = commits.filter((c) => c.type === type);
        if (inSection.length === 0) continue;
        lines.push(`### ${section}`, '');
        for (const c of inSection) lines.push(`* ${bullet(c)}`);
        lines.push('');
    }

    return lines.join('\n');
}

function bullet(commit: ParsedCommit): string {
    const scope = commit.scope ? `**${commit.scope}:** ` : '';
    return `${scope}${escapeSubject(commit.subject)}`;
}

/**
 * Splice a rendered section into an existing CHANGELOG, preserving the title and
 * preamble. An absent or empty file is created with the Keep a Changelog header
 * rather than starting with a bare release section.
 */
export function spliceRelease(existing: string | null | undefined, section: string): string {
    const body = (existing ?? '').replace(/\r\n/g, '\n');

    if (body.trim().length === 0) {
        return `# Changelog\n\n${section.trimEnd()}\n`;
    }

    const match = RELEASE_HEADING.exec(body);
    if (match) {
        const at = match.index;
        return `${body.slice(0, at)}${section.trimEnd()}\n\n${body.slice(at)}`;
    }

    // A preamble with no releases yet: append after it, not before it.
    return `${body.replace(/\s*$/, '')}\n\n${section.trimEnd()}\n`;
}
