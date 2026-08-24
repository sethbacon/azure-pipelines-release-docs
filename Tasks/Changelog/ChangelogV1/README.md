# PipelineChangelog

Derives the next semantic version from conventional commits, updates `CHANGELOG.md` and version
files, and opens or updates a release pull request.

## Modules

| File | Role |
| --- | --- |
| `index.ts` | Entry point — reads inputs, orchestrates, sets the output variables |
| `conventional.ts` | Conventional-commit parsing, including the ADO `Merged PR N:` prefix |
| `version.ts` | Semver arithmetic and the 0.x major cap |
| `changelog.ts` | Release-section rendering and the splice below the title/preamble |
| `git.ts` | History reading — argv arrays only, never a shell |
| `version-files.ts` | `$.dotted.path` stamping in JSON manifests |
| `ado-client.ts` | The job's access token, and the REST transport with its retry policy |
| `release-pr.ts` | Finding, creating and updating the release pull request |

## Decisions worth knowing

**Argv, never a shell.** A commit subject, a branch and a tag are all attacker-influenced in a
repository that accepts pull requests. Every `git` invocation goes through `execFileSync` with an
argument array; there is no string-concatenated git command in this task and there must never be one.

**The record separator is `%x00`, git's own escape — not a literal NUL.** Node refuses to pass an
argv string containing a NUL, and `commitsSince` swallows the throw, so a literal one makes every
history read return "no commits" — indistinguishable from a repository with nothing to release. A
test asserts no argv element contains a NUL.

**A batch of only `chore`/`ci`/`test` commits is not a release.** Cutting one anyway produces a
version whose changelog section is empty.

**An unparseable commit is skipped, never fatal.** One hand-written subject in a hundred must not
fail a release.

**Version files fail loudly.** A `jsonpath` that does not resolve is an error, not a no-op: silently
skipping it ships a release whose manifest still claims the previous version.

**`$.dotted.paths` only.** No wildcards, filters or recursive descent — a general JSONPath evaluator
would be a lot of attack surface for a caller that only ever writes `$.version`.

## Testing

`npm test` runs the unit suites plus two entry-point scenarios that build a real scratch git
repository and run the compiled `src/index.js` under the task mock runner: one that cuts a release
end to end (asserting the changelog splices below the title and the manifest is stamped), and one
whose history is all `chore` (asserting the changelog is left byte-identical).
