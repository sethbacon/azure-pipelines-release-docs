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
- **Supply chain** — the `.vsix` is signed and SBOM-attested; publishing requires environment approval.

## Defect classes

This repository is in scope for the estate's structural signature replay. Thirteen defect classes
apply to an Azure DevOps extension, and they are treated as a specification rather than as audit
findings — each is expected to have a class test and a recorded mutation proving that test detects the
defect. See `docs/initiatives/` in `pipeline-task-core` for the onboarding detail.

## Residual risks

Recorded here as they are accepted, with the reasoning and the decision date.

_None recorded yet — this repository is a scaffold._
