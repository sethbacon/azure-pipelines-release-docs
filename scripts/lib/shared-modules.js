// The shared-module lists for this repository. The LOGIC that consumes them is
// scripts/check-shared-modules.js, which is byte-identical across the three
// extensions; these lists are the part that legitimately differs.
//
// FAMILIES   directories that must carry byte-identical copies of the named
//            modules. The first dir is canonical; every other dir's copy must
//            match it exactly.
// PROVENANCE modules copied from ANOTHER repository, which cannot be
//            byte-compared here and must instead carry a machine-checkable
//            provenance header naming their upstream and sync status.

const MARKDOWN_SRC = 'Tasks/Markdown2Html/Markdown2HtmlV1/src';
const PUBLISH_SRC = 'Tasks/PublishKbArticle/PublishKbArticleV1/src';
const CHANGELOG_SRC = 'Tasks/Changelog/ChangelogV1/src';

const FAMILIES = [
    {
        // URI-scheme validation shared by the two independent HTML sanitizer/gate
        // layers guarding the ServiceNow KB-publishing pipeline: Markdown2Html's
        // render-time sanitizeRenderedHtml() and PublishKbArticle's downstream
        // fail-closed validateHtmlContent(). Each task previously carried its own
        // drifting copy of this logic, which is exactly how the control-character
        // scheme bypass (azure-pipelines-terraform#446) evaded both layers at
        // once — keep byte-identical.
        dirs: [MARKDOWN_SRC, PUBLISH_SRC],
        modules: ['uri-scheme-guard.ts'],
    },
    {
        // The allowlist HTML sanitizer itself (azure-pipelines-terraform#820):
        // before it, PublishKbArticle's raw htmlFile input was only ever
        // DENYLIST-validated (html-validate.ts) and then published VERBATIM, so a
        // bypass of that denylist reached ServiceNow's stored-XSS sink unfiltered.
        // Both of the KB-publishing pipeline's independent entry points —
        // Markdown2Html's render-time convertMarkdownToHtml() and
        // PublishKbArticle's pre-publish sanitizeHtmlForPublish() — must apply the
        // SAME allowlist policy (including the #835 rel="noopener noreferrer"
        // forcing on <a target=…>), or a KB article published one way could carry
        // active content a KB article published the other way would have stripped.
        dirs: [MARKDOWN_SRC, PUBLISH_SRC],
        modules: ['html-sanitizer.ts'],
    },
    {
        // The output-variable neutralizer. Every task in this extension emits
        // `##vso[task.setvariable ...]`, which later steps macro-expand into
        // scripts, so all three need the SAME length/printable-ASCII guard on the
        // way out. It lived in PublishKbArticle's manifest.ts, where the other two
        // tasks could not reach it -- Changelog and Markdown2Html emitted five
        // output variables with no validation at all until the suite replay was
        // finally pointed at this repo and said so.
        dirs: [PUBLISH_SRC, CHANGELOG_SRC, MARKDOWN_SRC],
        modules: ['output-variable.ts'],
    },
];

// Both modules above arrived with the tasks when they migrated from
// azure-pipelines-terraform, and both repositories still carry byte-identical
// copies. Registering them as cross-repository copies as well would require the
// @shared-module provenance headers, which is a separate decision about which
// repository is upstream now that the tasks live here; until that is settled the
// within-repo families are what this gate enforces.
const PROVENANCE = [];

module.exports = { FAMILIES, PROVENANCE };
