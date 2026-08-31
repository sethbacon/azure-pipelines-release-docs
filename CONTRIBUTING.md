# Contributing

This document describes the development process for **Pipeline Tasks for Release & Documentation**
(`sethbacon.pipeline-tasks-release-docs`), an Azure DevOps extension with three tasks:
`Tasks/Changelog/ChangelogV1` (`PipelineChangelog@1`), `Tasks/Markdown2Html/Markdown2HtmlV1`
(`PipelineMarkdown2Html@1`) and `Tasks/PublishKbArticle/PublishKbArticleV1`
(`PipelinePublishKbArticle@1`). The latter two are migrating out of
[azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform) — see the
"Why a separate extension" section of `README.md` for the full rationale and the cutover window.
The extension has not yet published a Marketplace release.

## Commit convention

All commits and PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
`.github/workflows/pr-checks.yml`'s `PR title convention` job enforces these types, with no scope
requirement:

`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `deps`, `security`, `perf`, `revert`

The PR title is what ends up in the changelog — write it as a clear, reader-facing statement.

### One breaking change per merged commit

This repository squash-merges with `squash_merge_commit_message=COMMIT_MESSAGES` (confirmed live via
`gh api repos/sethbacon/azure-pipelines-release-docs`), so every commit body in a PR is concatenated
into one merge commit — and release-please keeps only the **first** `BREAKING CHANGE:` footer of that
commit, reading a `!` marker only from its header. A second declaration anywhere in the PR is dropped
in silence: no changelog entry, no upgrade note, and nothing failing to say so.
`terraform-registry-backend` v4.0.0 shipped two undocumented breaking changes exactly this way.

Splitting the footers across separate commits does not help; the squash concatenates them back.
Either open one PR per breaking change, or combine them into a single `BREAKING CHANGE:` footer and
write each one up. A footer and a `!` header in the same commit are one declaration, not two, and are
fine. Two required checks guard this: `Breaking-change footers survive the squash` counts declarations
across the PR's commits, and `release-please can read the merged commit` builds the exact message this
PR would squash into `main` and parses it with release-please's own parser
(`.github/commit-message-check/verify.mjs`).

## Prerequisites

- Node.js 24 — every task's `package.json` pins `engines.node: >=24` and CI compiles and tests under
  it. The root `package.json` itself only requires `>=20` (it holds build tooling, not task code).
- npm
- GitHub CLI (`gh`) — optional, useful for creating PRs

TypeScript (`tsc`) and `tfx-cli` are installed as root dev dependencies; no global installation needed.

## Initial setup

```bash
git clone https://github.com/sethbacon/azure-pipelines-release-docs
cd azure-pipelines-release-docs
npm ci               # root tooling: tfx-cli, typescript, rimraf, the SBOM generator
npm run deps          # installs each task's own dependencies (scripts/for-each-task.js)
```

Or install one task directly before working on just it:

```bash
cd Tasks/Changelog/ChangelogV1        # or Tasks/Markdown2Html/Markdown2HtmlV1,
npm install                           # or Tasks/PublishKbArticle/PublishKbArticleV1
```

## Development workflow

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes.
3. Run the local quality gate from the task directory you changed:

   ```bash
   npm run compile   # zero TypeScript errors required
   npm test          # compiles tests, then runs the task's mocha/L0 suite
   npm run lint       # eslint src/ Tests/ — not run in CI today, but keep it clean
   ```

   Or, from the repo root, across every task: `npm run compile && npm run test:all`.

4. Open a PR to `main` with a conventional-commit title.
5. CI runs automatically. Every one of these jobs gates the PR — a change that trips any of them
   blocks the merge:

   <!-- ci-jobs:begin .github/workflows/ci.yml -->
   - `Check Version Consistency` — validates `task-universe.json` against `Tasks/`, each `task.json`'s
     version/name-prefix/GUID and monotonicity against the base revision, `azure-devops-extension.json`
     agreement with release-please, and the `configs/` publish-identity rules
     (`scripts/check-versions.js`), plus package composition (`scripts/check-package-composition.js`)
     and release-readiness preconditions (`scripts/check-release-readiness.js`), each with its own
     mutation self-test run in the same job.
   - `Build and Test` — on Ubuntu and Windows: installs each task's dependencies, compiles, and runs
     `npm run test:all`, then re-runs the compiled entry point of every task under Node 20 (the
     `Node20_1` execution-handler fallback) to prove it still loads there.
   - `Dependency audit` — `npm audit --audit-level=high` at the root and across every task
     (`npm run audit:all`), gated first by `scripts/check-audit-scope.js` (the audited tree is not
     empty) and `scripts/check-dependabot-coverage.js` (every task directory has a Dependabot entry).
   - `Workflow Security` — actionlint checks the workflow schema and zizmor scans for workflow-security
     anti-patterns, both from `4cloudguru/shared-workflows`'s `workflow-security.yml` rather than
     maintained here. It reports as two separate required contexts,
     `Workflow Security / Zizmor (workflow security lint)` and
     `Workflow Security / Workflow schema (actionlint)`.
   - `Workflow Security Record` — the same zizmor scan again, in SARIF mode, so findings land in the
     Security tab where one can be dismissed with a reason that outlives the run. It is a reporter, not
     a gate: in that mode zizmor exits 0 whatever it finds, so `Workflow Security` above is what blocks.
   - `Check Documented Claims` — `scripts/check-docs-claims.js` checks this file's own `ci-jobs` region
     against this workflow (bidirectionally — an undocumented job or a documented one that no longer
     exists both fail), every backticked `Tasks/`, `scripts/`, `docs/`, `configs/`, `images/` or
     `.github/` path referenced from `README.md`/`SECURITY.md`/`CONTRIBUTING.md`/`CLAUDE.md`/`overview.md`
     against the tree, and `SECURITY.md`'s supply-chain control ledger against what the workflows
     actually run.
   <!-- ci-jobs:end -->

   This list is checked against `.github/workflows/ci.yml` by `scripts/check-docs-claims.js`, in both
   directions, so it cannot drift as jobs are added, renamed, or removed.

   `.github/workflows/pr-checks.yml` gates the PR as well: `PR title convention`, `Dependency review`
   (`fail-on-severity: high`), and the two release-parsing guards described above,
   `Breaking-change footers survive the squash` and `release-please can read the merged commit`. It
   also runs `Release PR Minor Bumps`, which no-ops on an ordinary PR and only checks anything on a
   `release-please--*` branch — it is not itself a required check today, since it has nothing to
   enforce outside that case.

   Three more workflows gate `main` independently of `pr-checks.yml`: `CodeQL` (required as
   `Analyze (javascript-typescript)`), `signature-replay` (required as `replay / replay`, the estate's
   cross-repo vulnerability-class replay), and `Workflow Hardening` (required as
   `workflow-hardening / Workflow hardening` — SHA-pinned + version-labelled actions, a timeout on
   every job, `harden-runner` running first, and dependency installs with scripts disabled).

6. Squash-merge when CI passes and the PR is approved; the branch is deleted automatically.

## Testing

Test files live under each task's `Tests/` directory. `Markdown2Html` and `PublishKbArticle` follow
the estate's scenario-pair convention:

- `<Name>.ts` — mock-runner setup (inputs, env vars, exec answers), then `tr.run()`
- `<Name>L0.ts` — the task body run inside the mock child, registered as an `it()` in `Tests/L0.ts`

`Changelog` tests its exported functions directly (`import { parseCommit, ... } from '../src/conventional'`,
etc.) inside `Tests/L0.ts`, plus two end-to-end scenario pairs, `Tests/EntryPointRelease.ts` /
`EntryPointNoRelease.ts`, that run the compiled entry point under `MockTestRunner`. When adding a case
to an existing detector or handler, match the pattern already used for that file rather than inventing
a third style.

Per-task commands:

```bash
cd Tasks/Changelog/ChangelogV1 && npm test
cd Tasks/Markdown2Html/Markdown2HtmlV1 && npm test
cd Tasks/PublishKbArticle/PublishKbArticleV1 && npm test
```

Each runs `npm run compile:all` (task `tsc -b` + test `tsc -p tsconfig.tests.json`) before mocha, so
`npm test` always reflects your latest source — never invoke `mocha` directly against a possibly-stale
compiled `Tests/*.js`.

## Release process

Releases are automated via [release-please](https://github.com/googleapis/release-please), the same
shape as the sibling extensions:

1. Merge conventional-commit PRs to `main` — release-please accumulates them.
2. release-please opens a Release PR that bumps `azure-devops-extension.json`'s `version` and updates
   `CHANGELOG.md`.
3. Per-task `Minor` bumps are applied automatically on the Release PR
   (`.github/workflows/release-pr-minor-bumps.yml` → `scripts/bump-minor-versions.js`), backstopped by
   the `Release PR Minor Bumps` check (`scripts/check-minor-bumps.js`) and, at tag time,
   `release.yml`'s own re-run of the same script. Manual fallback, only if that automation is broken:
   run `node scripts/bump-minor-versions.js` from the repo root, or bump `Minor` by hand in whichever of
   `Tasks/Changelog/ChangelogV1/task.json`, `Tasks/Markdown2Html/Markdown2HtmlV1/task.json` or
   `Tasks/PublishKbArticle/PublishKbArticleV1/task.json` changed since the last release.
4. Merging the Release PR tags `vX.Y.Z`. `release.yml` then runs `guard` → `ci` → `build` → `package`
   → `sbom-and-sign` → `draft-release` → `publish-marketplace` → `undraft-release`: full CI, a packaged
   `.vsix`, a CycloneDX SBOM plus cosign signature per task, a draft GitHub Release, a Marketplace
   publish gated behind the `marketplace` environment's required human approval, then the release is
   undrafted.

`npm run check:release-readiness` runs the same preconditions `release.yml`'s `guard` job depends on;
`npm run test:release-readiness` is its mutation self-test.

## Publisher information

- **Publisher ID:** `sethbacon`
- **Extension ID:** `pipeline-tasks-release-docs`
- **Extension name:** `Pipeline Tasks for Release & Documentation`
