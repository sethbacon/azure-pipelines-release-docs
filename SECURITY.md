# Security Policy

## Reporting a vulnerability

Report privately via [GitHub Security Advisories](https://github.com/sethbacon/azure-pipelines-release-docs/security/advisories/new).
Please do not open a public issue for a suspected vulnerability.

Include the affected task and version, a description of the impact, and reproduction steps.
You will get an acknowledgement within 7 days.

## Supported versions

Until `1.0.0`, only the latest published minor receives fixes.

## Threat surface

These tasks run on Azure Pipelines agents with access to pipeline credentials, and they publish to
external systems (a ServiceNow instance, a Git remote). The surfaces that matter:

- **Stored XSS** in generated HTML published to a knowledge base.
- **Query injection** into the ServiceNow Table API.
- **Credential handling** — service connection secrets must never reach the build log, `argv`, or a
  world-readable temp file.
- **Egress** — every outbound request to an operator-configurable URL must be host-authorised against
  the resolved address, and re-authorised on each redirect hop.
- **Supply chain** — the integrity of the `.vsix` and of the path that publishes it. See
  [Supply chain controls](#supply-chain-controls).

Note the tense. All three tasks are implemented today (`Tasks/Changelog/ChangelogV1`,
`Tasks/Markdown2Html/Markdown2HtmlV1`, `Tasks/PublishKbArticle/PublishKbArticleV1`), each with a
`src/` tree and its own test suite, and the extension has published seven Marketplace releases
(`v0.2.0` through `v1.0.2`). The bullets above are the surfaces those implementations are checked
against, not surfaces still being designed toward: `PublishKbArticleV1`'s HTML sanitizer and
pre-publish content gate cover stored XSS, its ServiceNow client rejects a query value containing `^`
or a newline before it reaches `sysparm_query`, and credential inputs are masked with
`tasks.setSecret` before first use. This repository is also now in scope for the estate's
`ado-extension` signature replay for the same reason — see [Defect classes](#defect-classes).

## Supply chain controls

`.github/workflows/release.yml` builds, packages, signs and attests the `.vsix` and publishes it
behind the `marketplace` GitHub Environment, using the `AZDO_PUBLISH_CLIENT_ID`/`AZDO_PUBLISH_TENANT_ID`
variables and a GitHub OIDC to Microsoft Entra federated credential rather than a stored token. It was
ported from the sibling extensions
([azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform),
[azure-pipelines-packer](https://github.com/sethbacon/azure-pipelines-packer)) rather than written
here, and the header of that file records where the two siblings disagree and which side this
repository followed.

These controls are enforced on the **only** path that can produce a published `.vsix` — no other path
exists, and the manual `tfx` invocation that used to be the de-facto one is not a path this
repository sanctions.

### The federated credential's subject, which differs from the siblings'

The Entra service principal behind `AZDO_PUBLISH_CLIENT_ID` is shared with both siblings, and each
repository needs its own federated credential. This repository's subject is **not** the same shape as
theirs:

```
repo:sethbacon@14307877/azure-pipelines-release-docs@1331298995:environment:marketplace
```

GitHub gives repositories created after **2026-07-15** an immutable default OIDC subject that embeds
the owner and repository IDs. This repository was created 2026-08-11; azure-pipelines-terraform
(2026-03-06) and azure-pipelines-packer (2026-06-12) predate the cutoff and still present the plain
`repo:OWNER/REPO:environment:marketplace` form their CONTRIBUTING.md documents.

This matters because the failure mode is misleading. A credential created from the siblings' recipe
never matches, and Entra rejects it with `AADSTS700213: No matching federated identity record found
for presented assertion subject`, which reads as a wrong or missing credential rather than a wrong
format — so the natural next move is to recreate the same wrong thing. Read the authoritative value
per repository instead of copying:

```
gh api repos/OWNER/REPO/actions/oidc/customization/sub --jq .sub_claim_prefix
```

A rename or transfer after the cutoff moves a legacy repository onto the immutable form as well, so
the siblings are one repository-settings change away from needing new credentials of their own.

Two repository-settings prerequisites this doc used to flag as outstanding (#50, #51) are now settled.
`v*` release tags sit behind an active ruleset (#51). The `marketplace` environment no longer permits
an admin to bypass its reviewer requirement (`can_admins_bypass: false`) — but it does still permit
self-review (`prevent_self_review: false`), and that half is deliberate, not an oversight: this is a
solo-operated repository with no second person available to hold an independent-reviewer role, so
`prevent_self_review` was set back to `false` rather than leave the environment able to require an
approval nobody could ever give (#50). The environment is consequently a self-review speed bump, not
an independent second-party check — an honest, working control for a one-person project, not the
stronger guarantee the phrase "environment protection" might otherwise imply.

This table is machine-checked: `scripts/check-docs-claims.js` (CI job **Check Documented Claims**)
reads it on every pull request and compares each row against `.github/workflows/`. The comparison
runs in both directions. A row marked `enforced` that no workflow implements fails the build — that is
the defect this table replaces. A row marked `planned` whose control has appeared in a workflow fails
it too, which is the direction that moved these four rows: the publish path landing and the table
staying still would have been the same drift pointing the other way.

<!-- controls:begin -->

| Control                        | Status   | What it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketplace-publish`          | enforced | `.github/workflows/release.yml` builds, packages and publishes the `.vsix` from a tagged commit on `main`. It replaces an unreviewed `tfx` invocation on a maintainer's machine (#26).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `publish-environment-approval` | enforced | The `publish-marketplace` job declares `environment: marketplace`, so the publish stops at that environment's protection rules. The `guard` job re-verifies, fail-closed, that the environment still has a required reviewer and a deployment branch/ref policy before anything is built.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `vsix-signature`               | enforced | `sbom-and-sign` signs the `.vsix` with keyless cosign and attaches a build-provenance attestation. Both the draft release and the publish re-run `cosign verify-blob` against this repository's own workflow identity first, so the bytes published are provably the bytes signed.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `workflow-hardening`           | enforced | `.github/workflows/workflow-hardening.yml` calls `4cloudguru/shared-workflows`' gate and fails the build if any `uses:` is not pinned to a full commit SHA with a version comment, any npm install runs without `--ignore-scripts`, any job declares no `timeout-minutes`, or any job's egress policy is `audit` without a recorded reason on the step. Every one of those four was true of this tree and enforced by nothing (#21, #22, #23, #30). The checker is taken from that repository at the pinned commit, so there is no local copy to weaken; its 23-case mutation self-test breaks each property in a fixture and asserts the gate names it, and runs there beside the checker rather than here beside a fork of it. |
| `dependency-scan`              | enforced | `.github/workflows/weekly-security.yml` runs OSV-Scanner over the tree every Monday and on demand, covering advisories the npm registry's own database does not carry, and re-runs the whole of CI as a drift canary for the weeks when nothing merges. Since 2026-09-09 it calls `4cloudguru/shared-workflows`' `osv-scan` action rather than `google/osv-scanner-action` directly: that action runs the scanner from a **digest-pinned** image, so the full-SHA pin now covers the scanner binary and not merely its `action.yml`, and it reports the scanner's real exit code, so a finding files a tracking issue while a scanner that did not complete fails the job. What remains stated rather than inherited is what the scan does **not** flag: the per-task `osv-scanner.toml` suppressions, each bounded and reasoned under [Residual risks](#residual-risks).                                                                                                             |
| `sbom-attestation`             | enforced | `sbom-and-sign` generates a CycloneDX SBOM for the extension root and one per task (`sbom-extension.cdx.json`, `sbom-changelogv1.cdx.json`, `sbom-markdown2htmlv1.cdx.json`, `sbom-publishkbarticlev1.cdx.json`) and attests each to the `.vsix`. `scripts/check-release-readiness.js` fails the release if a task ever lands without a matching SBOM step, so this coverage cannot silently fall behind the task tree again.                                                                                                                                                                                                                                                |

<!-- controls:end -->

## What is enforced today

The only executable content in this repository is its gate scripts and its workflows. These run on
every pull request to `main`, and all of them are configured as required status checks:

- **Check Version Consistency** — `scripts/check-versions.js`. Task manifests must carry integer
  `Major`/`Minor`/`Patch`, a GUID-shaped unique `id`, and a unique name with the `Pipeline` prefix;
  the base extension manifest must keep `"public": false`. It never reads `configs/`, so which
  override may opt into a public listing is convention rather than a gate (#43).
- **Check Documented Claims** — `scripts/check-docs-claims.js`. The control table above, and every
  repo-relative path these documents name.
- **Workflow Hardening** — `4cloudguru/shared-workflows`' `workflow-hardening.yml`: full-SHA action
  pinning, `--ignore-scripts` on every install, a `timeout-minutes` on every job, an egress
  policy that is either `block` with an endpoint allowlist or `audit` with the reason written on the
  step, and that `scripts/for-each-task.js` runs npm as `node <npm-cli.js>` rather than spawning a
  `.cmd` wrapper or a shell (#45). The checker is taken from that repository at the pinned commit, so
  there is no local copy to weaken, and its 23-case mutation self-test runs there beside it.
- **Workflow Security** — `4cloudguru/shared-workflows`' `workflow-security.yml`: zizmor for
  workflow-security anti-patterns and actionlint for the schema errors zizmor does not look for, plus
  a fixture proving actionlint still rejects a broken workflow. `workflow-security-record.yml` runs
  the same scanner a second time to record findings in the security tab; it cannot block, and the
  first one cannot record, which is why both are called.
  And so is the one guard in this repository that is a shell script embedded in YAML:
  `4cloudguru/shared-workflows' tests/test-breaking-change-footers.js` extracts the breaking-change counter out of
  `pr-checks.yml` and runs it against fixture commit histories — including one served by a `gh`
  that exits non-zero, so the counter is proved to fail closed on a commit list it cannot read
  rather than report zero declarations and go green.
- **Dependency audit** — `npm audit` over the root lockfile and `npm run audit:all` over each task's,
  with `scripts/check-audit-scope.js` refusing a run that would inspect an empty tree (#20, #54) and
  `scripts/check-dependabot-coverage.js` refusing a task directory whose lockfile no
  `.github/dependabot.yml` entry watches — or an entry watching a directory that does not exist
  (#25). Both are dependency-free and run before any install.
- **Build and Test** (ubuntu and windows) — the per-task install, compile and test path, and
  `scripts/test-for-each-task.js`, the only self-test here that runs on both matrix legs, because the
  property it proves is platform-specific: it executes the real per-task npm spawn against the real
  npm, so the windows-2025 context stops reporting green over a code path it has never run (#45).
- **Scan Workflows (zizmor)**, **Analyze (javascript-typescript)** (CodeQL), **Dependency review**,
  **PR title convention**, and **replay**, the estate's structural signature gate.

Two jobs in `pr-checks.yml` report on every pull request without blocking one, because adding a
required context is a repository-settings change and this file does not make those. Both are about
the same thing — what release-please reads out of the commit a merge creates — and both should be
promoted together: **Breaking-change footers survive the squash** (this repository squash-merges with
`COMMIT_MESSAGES`, and release-please keeps only the *first* `BREAKING CHANGE:` footer of a commit,
so a pull request declaring two ships one of them silently: #49) and **release-please can read the
merged commit**.

Two properties of those jobs are worth stating because they are not visible from the list. The two
jobs that hold a **stored** GitHub App private key — `release-please` and signature-replay's
`replay` — currently run harden-runner with `egress-policy: audit`, the same as every other job in
this repository: both are the first execution of harden-runner at all for their jobs, so there is no
baseline yet from which a `block` policy's endpoint allowlist could be derived without guessing (#23).
That policy is not set in this repository at all — both jobs delegate to a reusable workflow pinned
by commit SHA in `4cloudguru/shared-workflows`, and `scripts/check-shared-workflow-egress.js` fetches
that exact pinned commit's source and fails the build if its real egress-policy ever stops matching
what this file claims, so this description cannot silently drift from the pinned code the way it once
did. Every other job is on `audit` with the reason recorded on the step and enforced in both directions
by the gate above. And `replay` revokes its installation token immediately after the one checkout it
exists for, then spends the revoked token and fails if it still works — so the fifteen repositories' own
committed gate scripts, and the commit under review, execute in a job holding no credential.

Two more gates run only at release time, in `release.yml`'s `guard` job, because they answer
questions a pull request cannot: `scripts/check-release-readiness.js` (the release preconditions —
something to publish, a release-please config that actually creates the tag `release.yml` triggers
on, SBOM coverage that tracks the task tree, and a cosign identity naming *this* repository rather
than the sibling it was ported from), plus the mutation self-test
`scripts/test-release-readiness.js`, which breaks what that guard protects and asserts it fails and
names the cause. (The Marketplace publish's own retry/token-safety self-test moved with the
implementation to 4cloudguru/shared-workflows' `publish-marketplace` composite action, which carries
its own self-test there.) They belong in the
already-required **Check Version Consistency** job so they gate a merge as well as a release; that is
a one-line change to `.github/workflows/ci.yml` and is deliberately not made here.

The known limits of those checks are recorded as open issues rather than restated here, because a
restatement in this document is precisely what it has to stop drifting: see the issues labelled
[`audit-2026-08-19`](https://github.com/sethbacon/azure-pipelines-release-docs/issues?q=is%3Aissue+is%3Aopen+label%3Aaudit-2026-08-19).
Two of them change how much the list above is worth and so are named here: repository admins can
bypass required checks entirely (#28), and `npm audit --omit=dev` currently has no production
dependency to inspect (#20).

## Defect classes

This repository is in scope for the estate's structural signature replay, and `replay` blocks a merge
here. It is in scope under the **`ado-extension`** kind — the same one `azure-pipelines-terraform`
and `azure-pipelines-packer` carry — now that `Tasks/` holds real code: the thirteen `ado-extension`
signatures (`artifact-trust`, `capture-output-protection`, `credential-input-type`, `docs-claims`,
`egress-authorization`, `enforced-disciplines`, `hardened-temp-writes`, `network-retry`,
`output-boundary`, `premask-emission`, `prototype-safe-lookup`, `provider-auth-failclosed`,
`proxy-parity`) enumerate real call sites in this repository's replay runs, rather than exiting 2 as
could-not-run over an empty surface the way they did before `ChangelogV1`, `Markdown2HtmlV1` and
`PublishKbArticleV1` landed. Each is a class test with a recorded mutation proving it detects the
defect it is named for. The rationale is in the header of
`.github/workflows/signature-replay.yml`; the onboarding detail is in
[`docs/initiatives/`](https://github.com/4cloudguru/pipeline-task-core/tree/main/docs/initiatives)
in `pipeline-task-core`.

## Residual risks

Recorded here as they are accepted, with the reasoning and the decision date.

- **`replay` cannot report green on a Dependabot or fork pull request** (2026-08-19, #31). It is a
  required status check, and on those runs `secrets.SUITE_READ_APP_KEY` resolves to the empty string
  — Dependabot runs read the Dependabot secret store, fork runs read none — so the token step fails
  before any signature runs. The obvious remedy, mirroring the App private key into the Dependabot
  store, is declined: `pull_request` runs the workflow file from the PR head and Dependabot edits
  workflow files, which would give a compromised upstream action a path to the key. The estate is
  choosing between three options in `sethbacon/azure-pipelines-packer#263` and every host of this
  workflow has to land the same one, so it is deliberately **not** resolved here. Until it is, a
  Dependabot PR needs an admin merge after confirming it touches nothing the signatures analyse.
- **`.github/workflows/release.yml` runs entirely on `egress-policy: audit`** (2026-08-19, #23). It
  is the most privileged workflow in the repository — `id-token`, `attestations` and `contents:
  write` — and it has now run seven times (`v0.2.0` through `v1.0.2`), all successfully, so an
  observed egress record exists to build an allowlist from. That flip has not been made: every job
  still reads `egress-policy: audit`, with the reason recorded on the step. Derive the lists from
  those seven runs' harden-runner summaries and flip them.
- **OSV-Scanner runs as a Docker action on a mutable image tag** (2026-08-19, #58). The `uses:` in
  `.github/workflows/weekly-security.yml` is pinned to a full commit SHA, and what that SHA pins is
  the action's `action.yml`, whose entire substance is
  `image: "docker://ghcr.io/google/osv-scanner-action:v2.5.0"` — a tag on a registry this repository
  does not control and cannot re-point. Whoever can push that tag replaces the code that runs in that
  job, and neither the pin, nor Dependabot, nor this repository's own full-SHA gate would report it;
  `sethbacon/azure-pipelines-packer#261` moved this action 2.3.8 → 2.5.0 with none of that said
  anywhere. The fix is to stop using the action and run the scanner from a checksum-verified release
  download, the way the `actionlint` step in `ci.yml` already does, and it is not made here because
  #58 asked for the family's layer rather than a divergent one. What bounds it meanwhile: the job is
  scheduled rather than merge-blocking, holds no stored credential, runs on `contents: read`, and
  reads a tree with no production dependencies. **Superseded on 2026-09-09**: that family layer now
  exists, and the job calls `4cloudguru/shared-workflows`' `osv-scan` action, which invokes the
  scanner image by **digest** (`ghcr.io/google/osv-scanner-action:v2.5.1@sha256:dcd947131d8d11b8d0964de6590661fb921a4ecbd7b90a7cb21083acfc3fd8cc`)
  rather than by tag — so the full-SHA pin on that `uses:` line now fixes the scanner that runs, and
  the checksum-verified binary download described above was never needed. The risk is closed; the
  entry is kept because the reasoning is what the replacement had to satisfy.
- **`adm-zip` 0.6.0 (GHSA-vwc7-r8mq-g2x9) is suppressed in each task's `osv-scanner.toml`**
  (2026-09-09, tracked across the extension family in `sethbacon/azure-pipelines-packer#435`). The
  advisory is a symlink-following flaw on extraction, rated moderate, and **no patched version
  exists**: the GitHub advisory records `first_patched_version: none`, 0.6.0 is still the latest
  release, and the upstream fix `cthackers/adm-zip#575` is open. There is therefore nothing an
  `overrides` entry could name — the `"adm-zip": "^0.6.0"` already in each task's `package.json` holds
  the newest thing published, not a fix. What makes this an acceptance rather than an unfixed
  exposure is that the vulnerable code is never loaded. `adm-zip` is reached only through
  `azure-pipelines-task-lib`, which declares `adm-zip ^0.6.0`, and the Node package **never requires
  it**: in the installed 5.279.0 tree the string appears in `package.json` and in no shipped file,
  because the dependency belongs to task-lib's PowerShell library, which these tasks do not ship
  (`microsoft/azure-pipelines-task-lib#1202`, closed 2026-08-26). Nor is it reached another way: no
  task in this extension extracts an archive at all — `ChangelogV1` reads git history,
  `Markdown2HtmlV1` renders markdown, `PublishKbArticleV1` posts over HTTP — and no source file here
  requires `adm-zip` or any other unzip path. The suppression is **bounded at 2026-12-31**,
  deliberately shorter than an open-ended acceptance because a fix is actively in progress upstream;
  re-evaluate at expiry or when `adm-zip` > 0.6.0 ships, whichever comes first. Each
  `osv-scanner.toml` sits **beside the lockfile it covers**
  (`Tasks/Changelog/ChangelogV1/osv-scanner.toml`,
  `Tasks/Markdown2Html/Markdown2HtmlV1/osv-scanner.toml`,
  `Tasks/PublishKbArticle/PublishKbArticleV1/osv-scanner.toml`) rather than at the repository root,
  because a root file does not reach nested lockfiles under `--recursive`. `npm audit` does not read
  these files, so it will keep reporting `adm-zip`; that is expected and is not a second finding.
- **Cross-repository shared-module parity is checked weekly, not on every commit** (2026-09-08,
  `sethbacon/azure-pipelines-terraform#1112` finding 1). `Markdown2Html`'s `html-sanitizer.ts` and
  `uri-scheme-guard.ts` are PROVENANCE copies of files that still live in `azure-pipelines-terraform`
  (deprecated there, `sethbacon/azure-pipelines-terraform#1046`); until now the two copies were held in
  sync only by the fact that every fix to either task was applied to both repositories by hand, because
  `scripts/check-shared-modules.js`'s byte-identity FAMILIES check cannot see across a repository
  boundary. `scripts/check-cross-repo-parity.js` now does, comparing each copy's body against a fresh
  checkout of that repository's `main`, and the `cross-repo-parity` job in
  `.github/workflows/weekly-security.yml` is where that checkout happens. `scripts/test-check-cross-repo-parity.js`
  self-tests the comparison logic itself on every pull request, in `ci.yml`, since the real comparison's
  upstream checkout only exists in the scheduled job. Accepted for the same reason `dependency-scan`'s
  weekly cadence is above: scheduled rather than merge-blocking, and it holds no stored credential — a
  divergence introduced the day after a Monday run is caught up to six days later rather than
  immediately.
- **The redacted replay report is still published from a public repository** (2026-08-19, #24).
  `security-orchestration`'s `remediation/replay/redact-replay-report.js` strips every site list from both the artifact and the job log
  before either is published, leaving the per-signature evidence (which repositories it ran in, what
  it skipped, and the counts) that a green required check needs to be worth anything. What remains
  public is that evidence plus the ledger's issue numbers and titles, all of which point at public
  repositories. Retention is bounded at seven days. Restricting who may download it is not an
  option: Actions artifacts inherit repository read access and there is no per-artifact ACL.

## Shared CI workflows

Part of this repository's CI is **defined in another repository** — [`4cloudguru/shared-workflows`](https://github.com/4cloudguru/shared-workflows) — and called from `.github/workflows/`. That is a real supply-chain relationship, and it is recorded here so an audit of this repository does not stop at this repository's own tree.

**What runs, and where it is pinned.** Each caller in `.github/workflows/` names the shared workflow on its `uses:` line, pinned to a full 40-hex commit SHA with a trailing comment naming the release that SHA is. The tag is a label; the SHA is what runs. An unlabelled SHA is rejected by the workflow-hardening gate, because a bare 40-hex ref cannot be reviewed or updated deliberately.

**Why the pins have to agree across repositories.** A shared definition drifts differently from a duplicated file: every repository looks like it is using "the shared one" while sitting on different commits, which is *harder* to see than divergent files, not easier. A signature in `security-orchestration` (`shared-workflow-pin-parity`) reports **disagreement** between callers of the same shared workflow — it reports disagreement rather than staleness, because a repository deliberately held back is a decision while N repositories disagreeing without anyone deciding is drift.

**What the shared repository is itself protected by.** Its `main` requires its own zizmor and actionlint checks with `enforce_admins` enabled, restricts which third-party actions may run to an explicit allowlist, issues a read-only default `GITHUB_TOKEN`, and runs the workflow-hardening gate against itself.

**What this repository still controls.** Triggers, concurrency, and the secrets it passes. Secrets are passed **by name** — never `secrets: inherit`, which would forward every secret in this repository to a workflow owned by someone else. Any `vars.*` a shared workflow reads resolve against **this** repository, so credentials and their installation scope do not move.
