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

**Status as of 2026-08-19: the publish path exists and has never run.**
`.github/workflows/release.yml` builds, packages, signs and attests the `.vsix` and publishes it
behind the `marketplace` GitHub Environment, using the `AZDO_PUBLISH_CLIENT_ID`/`AZDO_PUBLISH_TENANT_ID`
variables and a GitHub OIDC to Microsoft Entra federated credential rather than a stored token. It was
ported from the sibling extensions
([azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform),
[azure-pipelines-packer](https://github.com/sethbacon/azure-pipelines-packer)) rather than written
here, and the header of that file records where the two siblings disagree and which side this
repository followed.

It has never run because it cannot yet complete. `azure-devops-extension.json` declares
`"contributions": []` and `tfx extension create` refuses to package a manifest with no contribution,
so a tag pushed today stops in the first job with that stated by name — `scripts/check-release-readiness.js`
says it rather than leaving it to be discovered as a bare tfx error three jobs later. The first
release becomes possible when the first task lands. Two things follow, and both are why the table
below reads the way it does: these controls are enforced on the **only** path that can produce a
published `.vsix` — no other path exists, and the manual `tfx` invocation that used to be the
de-facto one is not a path this repository sanctions — and none of them has yet been exercised
end to end against a real artifact.

Two prerequisites live outside this tree and are not satisfied by merging this file. The Entra
service principal behind `AZDO_PUBLISH_CLIENT_ID` is shared with both siblings and needs a federated
credential for this repository's subject before `azure/login` can succeed here. And the `marketplace`
environment as provisioned permits self-review and admin bypass (#50), with no protection on `v*`
tags (#51); both are repository settings, and both have to be settled before that environment is
load-bearing rather than decorative.

This table is machine-checked: `scripts/check-docs-claims.js` (CI job **Check Documented Claims**)
reads it on every pull request and compares each row against `.github/workflows/`. The comparison
runs in both directions. A row marked `enforced` that no workflow implements fails the build — that is
the defect this table replaces. A row marked `planned` whose control has appeared in a workflow fails
it too, which is the direction that moved these four rows: the publish path landing and the table
staying still would have been the same drift pointing the other way.

<!-- controls:begin -->

| Control | Status | What it means |
| --- | --- | --- |
| `marketplace-publish` | enforced | `.github/workflows/release.yml` builds, packages and publishes the `.vsix` from a tagged commit on `main`. It replaces an unreviewed `tfx` invocation on a maintainer's machine (#26). |
| `publish-environment-approval` | enforced | The `publish-marketplace` job declares `environment: marketplace`, so the publish stops at that environment's protection rules. The `guard` job re-verifies, fail-closed, that the environment still has a required reviewer and a deployment branch/ref policy before anything is built. |
| `vsix-signature` | enforced | `sbom-and-sign` signs the `.vsix` with keyless cosign and attaches a build-provenance attestation. Both the draft release and the publish re-run `cosign verify-blob` against this repository's own workflow identity first, so the bytes published are provably the bytes signed. |
| `workflow-hardening` | enforced | `scripts/check-workflow-hardening.js` runs in CI's **Lint GitHub Actions** job and fails the build if any `uses:` is not pinned to a full commit SHA with a version comment, any npm install runs without `--ignore-scripts`, any job declares no `timeout-minutes`, or any job's egress policy is `audit` without a recorded reason on the step. Every one of those four was true of this tree and enforced by nothing (#21, #22, #23, #30). `scripts/test-workflow-hardening.js` breaks each property in a fixture and asserts the gate names it. |
| `sbom-attestation` | enforced | `sbom-and-sign` generates a CycloneDX SBOM of the extension's production closure and attests it to the `.vsix`. `@cyclonedx/cyclonedx-npm` is a devDependency again, and this time a workflow invokes it. With no tasks yet the SBOM has no third-party components, which is the truth about a `.vsix` that bundles none; `scripts/check-release-readiness.js` fails the release the day a task lands without an SBOM of its own, so that emptiness cannot outlive the empty tree. |

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
- **Lint GitHub Actions** — actionlint, plus `scripts/check-workflow-hardening.js`: full-SHA action
  pinning, `--ignore-scripts` on every install, a `timeout-minutes` on every job, and an egress
  policy that is either `block` with an endpoint allowlist or `audit` with the reason written on the
  step. Both carry mutation self-tests that run beside them on every pull request.
- **Build and Test** (ubuntu and windows), **Dependency audit**, **Scan Workflows (zizmor)**,
  **Analyze (javascript-typescript)** (CodeQL), and **replay**, the estate's structural signature
  gate.

Two properties of those jobs are worth stating because they are not visible from the list. The two
jobs that hold a **stored** GitHub App private key — `release-please` and signature-replay's
`replay` — run harden-runner with `egress-policy: block` and an explicit endpoint allowlist; every
other job is on `audit` with the reason recorded on the step and enforced in both directions by the
gate above. And `replay` revokes its installation token immediately after the one checkout it exists
for, then spends the revoked token and fails if it still works — so the fifteen repositories' own
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
- **The redacted replay report is still published from a public repository** (2026-08-19, #24).
  `scripts/redact-replay-report.js` strips every site list from both the artifact and the job log
  before either is published, leaving the per-signature evidence (which repositories it ran in, what
  it skipped, and the counts) that a green required check needs to be worth anything. What remains
  public is that evidence plus the ledger's issue numbers and titles, all of which point at public
  repositories. Retention is bounded at seven days. Restricting who may download it is not an
  option: Actions artifacts inherit repository read access and there is no per-artifact ACL.
