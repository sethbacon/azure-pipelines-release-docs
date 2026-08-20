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
  [Supply chain controls](#supply-chain-controls): none of those controls exists here yet.

Note the tense. No task is implemented in this repository, so the first four bullets describe the
code this extension is being built to hold rather than code it holds today. They are written down now
because they are what the design has to answer for, and a task's review is the wrong place to be
discovering them for the first time.

## Supply chain controls

**Status as of 2026-08-19: not one of the controls below is implemented.** This repository builds no
`.vsix`, signs nothing, attests nothing, and publishes nothing. A `marketplace` GitHub Environment
and `AZDO_PUBLISH_CLIENT_ID`/`AZDO_PUBLISH_TENANT_ID` variables do exist in repository settings, but
no workflow references any of them, so nothing deploys through that gate and the approval it would
impose is inert.

The intent is real and is recorded here so that it survives: before the first Marketplace release,
this repository adopts the publish path the sibling extensions
([azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform),
[azure-pipelines-packer](https://github.com/sethbacon/azure-pipelines-packer)) already run —
guard, build, package, SBOM-and-sign, draft release, environment-gated publish. That is tracked as
issues #26 and #57 and is deliberately taken as one reviewed change rather than piecemeal.

Until then this table is the whole truth about the artifact's integrity, and it is machine-checked:
`scripts/check-docs-claims.js` (CI job **Check Documented Claims**) reads it on every pull request and
compares each row against `.github/workflows/`. The comparison runs in both directions. A row marked
`enforced` that no workflow implements fails the build — that is the defect this table replaces. A row
marked `planned` whose control has appeared in a workflow fails it too, and that is the direction that
matters from here: when the publish path lands, this table has to be updated in the same change. It
cannot quietly become true.

<!-- controls:begin -->

| Control | Status | What `enforced` will mean |
| --- | --- | --- |
| `marketplace-publish` | planned | A reviewed workflow publishes the `.vsix`, replacing today's de-facto path — an unreviewed `tfx` invocation on a maintainer's machine (#26). |
| `publish-environment-approval` | planned | That workflow's publish job declares `environment: marketplace`, so the publish stops at the environment's protection rules. |
| `vsix-signature` | planned | The release workflow signs the `.vsix` with keyless cosign and attaches a build-provenance attestation, both verifiable against the workflow's own OIDC identity. |
| `sbom-attestation` | planned | The release workflow generates a CycloneDX SBOM and attests it to the artifact. `@cyclonedx/cyclonedx-npm` was removed from `package.json` in the meantime: a generator that was installed into every CI job and invoked by nothing made this row look implemented. |

<!-- controls:end -->

Two caveats on `publish-environment-approval`, so that wiring it up is not mistaken for finishing it.
The `marketplace` environment as provisioned permits self-review and admin bypass (#50), and no
protection exists on `v*` tags (#51). Both are repository settings rather than code, and both have to
be settled before that environment is load-bearing.

## What is enforced today

The only executable content in this repository is its gate scripts and its workflows. These run on
every pull request to `main`, and all of them are configured as required status checks:

- **Check Version Consistency** — `scripts/check-versions.js`. Task manifests must carry integer
  `Major`/`Minor`/`Patch`, a GUID-shaped unique `id`, and a unique name with the `Pipeline` prefix;
  the base extension manifest must keep `"public": false`. It never reads `configs/`, so which
  override may opt into a public listing is convention rather than a gate (#43).
- **Check Documented Claims** — `scripts/check-docs-claims.js`. The control table above, and every
  repo-relative path these documents name.
- **Build and Test** (ubuntu and windows), **Dependency audit**, **Scan Workflows (zizmor)**,
  **Analyze (javascript-typescript)** (CodeQL), and **replay**, the estate's structural signature
  gate.

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

_None recorded yet — this repository is a scaffold._
