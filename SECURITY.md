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

Note the tense. No task is implemented in this repository, so the first four bullets describe the
code this extension is being built to hold rather than code it holds today. They are written down now
because they are what the design has to answer for, and a task's review is the wrong place to be
discovering them for the first time.

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

One prerequisite still lives outside this tree: the `marketplace` environment as provisioned permits
self-review and admin bypass (#50), with no protection on `v*` tags (#51). Both are repository
settings, and both have to be settled before that environment is load-bearing rather than decorative.

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
| `dependency-scan`              | enforced | `.github/workflows/weekly-security.yml` runs OSV-Scanner over the tree every Monday and on demand, covering advisories the npm registry's own database does not carry, and re-runs the whole of CI as a drift canary for the weeks when nothing merges. One limitation is load-bearing and is stated rather than inherited: `google/osv-scanner-action` is a **Docker action on a mutable image tag**, so the full-SHA pin fixes its `action.yml` and not the scanner image `ghcr.io/google/osv-scanner-action:v2.5.0` that action runs. Accepted, with reasoning and date, under [Residual risks](#residual-risks).                                                                                                             |
| `sbom-attestation`             | enforced | `sbom-and-sign` generates a CycloneDX SBOM of the extension's production closure and attests it to the `.vsix`. `@cyclonedx/cyclonedx-npm` is a devDependency again, and this time a workflow invokes it. With no tasks yet the SBOM has no third-party components, which is the truth about a `.vsix` that bundles none; `scripts/check-release-readiness.js` fails the release the day a task lands without an SBOM of its own, so that emptiness cannot outlive the empty tree.                                                                                                                                                                                                                                               |

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

Three more gates run only at release time, in `release.yml`'s `guard` job, because they answer
questions a pull request cannot: `scripts/check-release-readiness.js` (the release preconditions —
something to publish, a release-please config that actually creates the tag `release.yml` triggers
on, SBOM coverage that tracks the task tree, and a cosign identity naming *this* repository rather
than the sibling it was ported from), plus the mutation self-tests
`scripts/test-release-readiness.js` and `scripts/test-publish-marketplace.js`, which break what
those guards protect and assert each one fails and names the cause. They belong in the
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
here. It is in scope under a **signature-free kind**: it has no `Tasks/` tree, and pointing the
thirteen `ado-extension` signatures at an empty task surface would make each of them enumerate
nothing and exit 2, which is could-not-run rather than clean. Those thirteen classes are the
specification this extension's tasks are written against — each is expected to have a class test and a
recorded mutation proving that test detects the defect — and they start being replayed against this
repository on the day `Markdown2HtmlV1` and `PublishKbArticleV1` land here and the kind flips. The
rationale is in the header of `.github/workflows/signature-replay.yml`; the onboarding detail is in
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
  write` — and it has never executed, because `azure-devops-extension.json` declares no
  contributions and the `guard` job stops every tag. There is therefore no observed egress record to
  build an allowlist from, and a guessed one fails a first release after a human has approved the
  environment gate. Each of its seven jobs carries the reason on the step; derive the lists from the
  first real run's harden-runner summaries and flip them then.
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
  reads a tree with no production dependencies.
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
