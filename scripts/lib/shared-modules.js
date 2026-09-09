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
    {
        // Symlink-aware working-directory containment (#123): Changelog's
        // isWithinWorkingDirectory/realpathOfExistingPrefix realpaths the deepest
        // existing ancestor on both sides before comparing, unlike a lexical
        // path.relative/startsWith check, which an in-tree symlink can defeat.
        // Markdown2Html's include resolver and PublishKbArticle's image-rewrite
        // extractor each had their own lexical-only version until the suite
        // replay found the asymmetry -- keep byte-identical so a future fix to
        // one does not silently leave the others weaker.
        dirs: [CHANGELOG_SRC, MARKDOWN_SRC, PUBLISH_SRC],
        modules: ['path-containment.ts'],
    },
];

// Both modules above arrived with the tasks when they migrated from
// azure-pipelines-terraform, which still carries its own (deprecated, #1046)
// copies of these two tasks. Registering the CANONICAL (Markdown2Html) dir of
// each file is enough -- the within-repo FAMILIES entries above already keep
// PublishKbArticle's copy byte-identical to it.
//
// This list is read by TWO checks that see different things, and the second one
// is newer than this comment used to admit:
//
//   1. scripts/check-shared-modules.js, in this repository, can only verify
//      that each copy still SAYS where it came from and whether it claims to be
//      in sync, via the @shared-module header. It cannot open the upstream file.
//
//   2. the `cross-repo-copy-parity` replay signature, in security-orchestration,
//      DOES diff the bodies below each side's leading comment, across every
//      ado-extension repository at once. It runs here on every pull request and
//      on main via .github/workflows/signature-replay.yml.
//
// So a real cross-repo byte diff now exists, which is what the maintenance-
// surface finding of azure-pipelines-terraform#1112 asked for. Verified by
// mutation: dropping 'action' from URI_BEARING_ATTRIBUTES in this repository's
// copy alone takes that signature from zero sites to one.
//
// The consequence for anyone editing these two files: a fix applied here and
// not upstream (or the reverse) now fails a gate rather than drifting quietly,
// so apply it to both copies in the same change. A @shared-module-status of
// IN-SYNC is a claim the signature checks, not a claim it trusts.
const UPSTREAM = 'azure-pipelines-terraform';

const PROVENANCE = [
    { dir: MARKDOWN_SRC, file: 'uri-scheme-guard.ts', upstream: UPSTREAM },
    { dir: MARKDOWN_SRC, file: 'html-sanitizer.ts', upstream: UPSTREAM },
];

module.exports = { FAMILIES, PROVENANCE };
