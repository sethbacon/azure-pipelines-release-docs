# azure-pipelines-release-docs

**Pipeline Tasks for Release & Documentation** (`sethbacon.pipeline-tasks-release-docs`) — an Azure
DevOps extension covering release engineering (conventional-commit changelog + version management)
and documentation publishing (`Markdown2Html`, `PublishKbArticle`, migrated out of
[azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform)).

> **Status: scaffold.** No tasks are implemented yet. The plan is held as a single source of truth in
> the shared-core repo, because that package is Phase 0 and blocks this work:
> [initiative-1-shared-task-core.md](https://github.com/sethbacon/pipeline-task-core/blob/main/docs/initiatives/initiative-1-shared-task-core.md).
> It is deliberately not duplicated here.

## Why a separate extension

`Markdown2Html` and `PublishKbArticle` currently ship inside the Terraform extension, where they are
roughly a fifth of the task surface and carry threat classes — stored XSS in published HTML,
ServiceNow query injection — wholly unrelated to Terraform execution. Anyone assessing "should we
trust this Terraform extension" has to review them end to end. Moving them here separates the two
concerns so each can be versioned, reviewed and trusted on its own terms.

## Conventions inherited from the estate

- Task names carry the `Pipeline` prefix (`PipelineMarkdown2Html`, `PipelinePublishKbArticle`) so this
  extension installs side-by-side with the Terraform one during migration. Enforced by
  `scripts/check-versions.js`.
- Base manifest keeps `"public": false`; `configs/release.json` opts into the public listing, so a dev
  package can never accidentally ship one. Also enforced by `scripts/check-versions.js`.
- Node 24 execution handler with a `Node20_1` fallback for agents lacking the Node 24 runner.
- Shared primitives come from `@sethbacon/pipeline-task-core` rather than being copied in.

## Development

```bash
npm ci                    # root tooling (tfx, typescript)
npm run deps              # per-task dependencies
npm run compile
npm run test:all
npm run check:versions
```

Commits follow Conventional Commits; releases are cut by release-please and published to the
Visual Studio Marketplace via a reviewed `marketplace` environment.
