# azure-pipelines-release-docs

**Pipeline Tasks for Release & Documentation** (`sethbacon.pipeline-tasks-release-docs`) — an Azure
DevOps extension covering release engineering (conventional-commit changelog + version management)
and documentation publishing (`Markdown2Html`, `PublishKbArticle`, migrated out of
[azure-pipelines-terraform](https://github.com/sethbacon/azure-pipelines-terraform)).

> **Status: three tasks, not yet published.** `PipelineChangelog`, `PipelineMarkdown2Html` and
> `PipelinePublishKbArticle` are implemented; the extension has never published a Marketplace
> release. The plan is held as a single source of truth in the shared-core repo:
> [initiative-1-shared-task-core.md](https://github.com/4cloudguru/pipeline-task-core/blob/main/docs/initiatives/initiative-1-shared-task-core.md).
> It is deliberately not duplicated here.

## Tasks

### `PipelineChangelog@1` — Changelog and Release Version

Phase 2 of the initiative. Reads conventional commits since the last release tag, computes the next
semantic version, prepends a release section to `CHANGELOG.md`, stamps version files, and opens or
updates a release pull request — the release-please shape, for a repository Azure DevOps hosts.

| Input | Default | Description |
| --- | --- | --- |
| `workingDirectory` | agent cwd | Repository root. |
| `changelogPath` | `CHANGELOG.md` | Created with a Keep a Changelog header if absent. |
| `tagPrefix` | `v` | Prefix on release tags. |
| `targetBranch` | `main` | Branch the release pull request targets. |
| `capZeroMajor` | `true` | A breaking change in 0.x bumps the minor (0.3.7 → 0.4.0) rather than reaching 1.0.0. Matches release-please's `bump-minor-pre-major`. |
| `versionFiles` | — | One `path#$.json.path` per line. A bare path means `$.version`. Fails if a path does not resolve. |
| `commitLimit` | `500` | Bounds history reading on a repository that has never been tagged. |
| `openPullRequest` | `true` | When off, updates files and outputs without calling the REST API. |
| `accessToken` | job identity | Only for cross-repository or cross-organisation publishing. |
| `dryRun` | `false` | Compute and print without writing or calling anything. |

Outputs: `releaseRequired`, `nextVersion`, `previousVersion`, `bumpType`, `releasePullRequestId`.

**Permissions.** The task authenticates as the pipeline's own identity via `SystemVssConnection`, so
the extension does **not** request `vso.code_write` — raising the manifest scope would re-prompt every
installing organisation for consent and grant repo write to the whole extension for one task's sake.
What gates it instead is the Build Service account's rights on the target repository: grant it
**Contribute** and **Contribute to pull requests** there, and enable *Allow scripts to access the
OAuth token* on the job.

**Azure DevOps specifics this task exists to handle.** An ADO squash-merge prefixes the subject with
`Merged PR 1234: `; left in place, every conventional commit in an ADO-hosted repo fails to parse and
the release comes out silently empty. A PR description is capped at 4000 characters and is *rejected*
rather than truncated past it. Both are handled, and both are covered by tests.

### `PipelineMarkdown2Html@1` and `PipelinePublishKbArticle@1`

Migrated out of the Terraform extension (#71). See
[the migration note](#why-a-separate-extension) below for why they moved and what the cutover window is.

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
  resolving to the Terraform-hosted task until its YAML is edited.
- **The cutover window (#55).** The Terraform extension keeps shipping its `Markdown2Html` and
  `PublishKbArticle` until BOTH extensions have published five minor releases with the tasks
  available in both, counting from this extension's first published release — side-by-side is not
  real until there is something to install alongside. Only then are the originals removed there.
  A version count rather than a date, because what a consumer needs before switching is evidence
  that the new tasks have shipped and held up, which a calendar cannot supply. Until then every run
  of the Terraform-hosted originals logs a non-fatal warning naming its replacement.
- Base manifest keeps `"public": false` and `configs/release.json` is the override that opts into the
  public listing. Both halves are now a gate: `scripts/check-versions.js` reads every file in
  `configs/`, allows only `release.json` to set `public: true` or a `Public` gallery flag, requires
  each override's `id`/`publisher` to match the coordinates this repository releases under, and fails
  closed on an override it has no rule for — tfx overrides win over the base manifest, so an
  unreviewed file here decides which Marketplace listing gets updated (#43).
- The task universe is **declared** in `task-universe.json` and measured on every run. A gate that
  walks `Tasks/` today enumerates zero, and zero is only acceptable because it was written down in
  advance: the declaration says `expect: "absent"`, the gates print a `SCAFFOLD:` banner saying they
  proved nothing about task code, and they fail the moment a task exists under a declaration that
  still says none do. Once tasks land, flip it to `expect: "present"` with a `minTasks` floor and a
  run that enumerates fewer fails (#39). The shape is the estate's blind-audit code-universe gate,
  which aborts rather than grade a tree nobody opened.
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
npm run audit:all         # per-task npm audit (the root lockfile never sees a
                          # task's dependencies under the no-workspace model)
npm run check:versions    # declared task universe, task versions/GUIDs/name prefix,
                          # task version monotonicity against the base revision,
                          # version agreement between azure-devops-extension.json
                          # and release-please, and the configs/ publish identity
npm run check:docs-claims # documented claims vs. what the workflows actually do
npm run check:composition # what the .vsix would contain, and whether the manifest
                          # promises anything that is not in it
npm run check:audit-scope # whether the required "Dependency audit" job inspects a
                          # non-empty set of packages
npm run test:composition  # mutation self-tests: re-create each defect the gates
npm run test:gates        # above exist to catch and assert they fail by name
npm run check:release-readiness  # preconditions release.yml depends on
npm run test:release-readiness   # mutation self-test for the gate above
npm run test:publish             # the publish wrapper keeps the Entra token off
                                 # argv and bounds its retries
```

`check:versions`, `check:composition`, `test:composition` and `test:gates` all run in the required
`Check Version Consistency` CI job; `check:audit-scope` runs in `Dependency audit`, ahead of the
audit it checks the scope of. `Lint GitHub Actions` (actionlint) and `Check Documented Claims` are
separate jobs and are both required contexts on `main`. The three `*release-readiness*`/`*publish*`
commands run in `release.yml`'s `guard` job, because they answer questions about a release rather
than about a commit; `check:release-readiness` fails today, by design, and says why.
`npm run build:release` runs `check:composition` before composing
`./build`, and `scripts/copy-build.js` then refuses to compose a package containing a symlink, a
secret-shaped file, a path outside a known task directory, or anything the allowlist does not cover —
and asserts, over its own finished output, that every path the packaged manifest promises is present.

Commits follow Conventional Commits; releases are cut by release-please.

> **The publish path exists and has never run.** `.github/workflows/release.yml` takes a `v*` tag on
> `main` through guard → CI → build → package → SBOM-and-sign → draft release → Marketplace publish →
> undraft, gating the publish behind the `marketplace` GitHub Environment and authenticating with a
> GitHub OIDC to Microsoft Entra federated credential rather than a stored token. It was ported from
> the sibling extensions rather than written here; that file's header records where the two siblings
> disagree and which side this repository followed, and why the ten-minute cap on the Entra token
> decides the job order.
>
> It cannot yet complete: `azure-devops-extension.json` declares `"contributions": []`, and
> `tfx extension create` refuses to package a manifest with no contribution. A tag pushed today stops
> in the first job saying exactly that (`scripts/check-release-readiness.js`), which is the point —
> the path is reviewed before it carries anything, rather than after. Two prerequisites also live
> outside this tree: a federated credential on the shared publishing service principal for this
> repository's subject, and the `marketplace` environment's own self-review/admin-bypass and `v*` tag
> protection settings (#50, #51).
>
> `SECURITY.md` carries the machine-checked form: its **Supply chain controls** table lists each
> control as `enforced` or `planned`, and `scripts/check-docs-claims.js` fails the build in both
> directions — a control claimed but absent, and a control implemented while the table still calls it
> planned. That second direction is what moved all four rows in the same change that landed the
> workflow, and what stops these two documents drifting apart again.
