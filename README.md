# azure-pipelines-release-docs

**Pipeline Tasks for Release & Documentation** (`sethbacon.pipeline-tasks-release-docs`) — an Azure
DevOps extension covering release engineering (conventional-commit changelog + version management)
and documentation publishing (`Markdown2Html`, `PublishKbArticle`, migrated out of
[azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform)).

> **Status: scaffold.** No tasks are implemented yet. The plan is held as a single source of truth in
> the shared-core repo, because that package is Phase 0 and blocks this work:
> [initiative-1-shared-task-core.md](https://github.com/4cloudguru/pipeline-task-core/blob/main/docs/initiatives/initiative-1-shared-task-core.md).
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
  `scripts/check-versions.js`. The tasks being migrated do not carry that prefix today, and a task
  GUID cannot be reused across two separately-published extensions — so this is a rename to a new name
  and a new id rather than an in-place move, and a pipeline referencing `Markdown2Html@1` keeps
  resolving to the Terraform-hosted task until its YAML is edited. No deprecation window has been
  decided yet (#55).
- Base manifest keeps `"public": false`, which `scripts/check-versions.js` does enforce, and
  `configs/release.json` is the override that opts into the public listing. Only that first half is a
  gate: no script reads `configs/`, so a dev override that set `public: true` would package a public
  listing and the check would still pass (#43). Treat the override files as convention until that
  closes.
- Tasks live at `Tasks/<Family>/<TaskDirVn>/task.json` — exactly two directory levels. That layout is
  the definition every script shares via `scripts/lib/task-dirs.js`, and
  `scripts/check-package-composition.js` fails on anything under `Tasks/` that sits outside it.
- The `.vsix` is composed by **allowlist**, not denylist. What may ship is enumerated in
  `scripts/lib/package-contents.js`, and a file matching no rule is a build/CI failure that names it
  rather than a file that silently ships or silently vanishes. See that file for the reasoning and
  for what the allowlist costs when a task legitimately adds a new asset type.
- Node 24 execution handler with a `Node20_1` fallback for agents lacking the Node 24 runner.
- Shared primitives come from `@4cloudguru/pipeline-task-core` (platform-agnostic) and
  `@4cloudguru/pipeline-task-ado` (the half that may name Azure DevOps — input parsing, the agent
  proxy dispatcher, `tasks.loc`) rather than being copied in. Both publish to the public npm
  registry from the `4cloudguru` org. Note the scope: `@sethbacon` on npmjs belongs to an unrelated
  third party, so a `@sethbacon/...` specifier is not a typo to be tolerated.

## Development

```bash
npm ci                    # root tooling (tfx, typescript)
npm run deps              # per-task dependencies
npm run compile
npm run test:all
npm run check:versions    # task versions/GUIDs/name prefix, and version agreement
                          # between azure-devops-extension.json and release-please
npm run check:docs-claims # documented claims vs. what the workflows actually do
npm run check:composition # what the .vsix would contain, and whether the manifest
                          # promises anything that is not in it
npm run test:composition  # mutation self-test: re-creates each defect the gates
                          # above exist to catch and asserts they fail by name
```

`check:versions`, `check:composition` and `test:composition` all run in the required
`Check Version Consistency` CI job. `npm run build:release` runs `check:composition` before composing
`./build`, and `scripts/copy-build.js` then refuses to compose a package containing a symlink, a
secret-shaped file, a path outside a known task directory, or anything the allowlist does not cover —
and asserts, over its own finished output, that every path the packaged manifest promises is present.

Commits follow Conventional Commits; releases are cut by release-please.

> **Not yet implemented:** there is no `release.yml`, so nothing publishes to the Visual Studio
> Marketplace today. The sibling extensions gate that behind a reviewed `marketplace` environment
> with a deployment branch/tag policy, and this repo should adopt the same before its first release
> (#26). Stated here as absent rather than described as if it existed — a README that claims a publish
> path the repo does not have is the `docs-claims` defect class, which this extension inherits in
> full.
>
> `SECURITY.md` now carries the same statement in machine-checked form: its **Supply chain controls**
> table lists each control as `enforced` or `planned`, and `scripts/check-docs-claims.js` fails the
> build in both directions — a control claimed but absent, and a control implemented while the table
> still calls it planned. That second direction is what stops these two documents drifting apart
> again, which is how the claim survived here in the first place.
