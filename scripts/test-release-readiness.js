#!/usr/bin/env node
'use strict'

// Mutation self-test for scripts/check-release-readiness.js.
//
// A gate is worth nothing until you have broken the thing it protects and
// watched it fail. Every case below builds a scratch tree the gate passes,
// then reintroduces ONE defect and asserts the gate exits non-zero AND names
// the cause. The expected substring is asserted, not just the exit code: a case
// whose message stops appearing is a case that has quietly stopped testing
// anything, which looks exactly like a clean tree.
//
// Cases, mapped to what they re-create:
//   clean                     the fixture passes, so the failures below are the mutation
//   no-contribution           an empty contributions[] — the state THIS repository is in,
//                             and the tfx error it turns into a named one
//   draft-without-force-tag   `draft: true` and no `force-tag-creation`      (#27)
//   force-tag-at-top-level    the sibling extensions' shape must also pass (no false positive)
//   not-draft-no-force-tag    force-tag-creation is only required WITH draft (no false positive)
//   sbom-not-attested         an SBOM generated and never attested
//   no-sbom-at-all            the SBOM control removed entirely
//   task-without-sbom         a task lands and nobody adds its SBOM steps
//   task-with-sbom            the same task, covered — the transition passes
//   foreign-signing-identity  the ported cosign identity still naming a sibling repo
//   no-verify-step            the pre-publish integrity gate removed
//   comment-only              the SBOM and identity steps present only as YAML comments,
//                             proving a comment cannot satisfy a control
//
// The scratch tree carries its own copy of scripts/, so the gate's
// `path.join(__dirname, '..')` resolves to the fixture root. Nothing is written
// under this repository's Tasks/, which the estate's audit profile declares
// absent and which must stay that way.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const repoRoot = path.join(__dirname, '..')
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-docs-readiness-'))
const GATE = path.join('scripts', 'check-release-readiness.js')

let failed = false

function check(cond, okMsg, failMsg, extra) {
  if (cond) {
    console.log(`OK: ${okMsg}`)
  } else {
    console.error(`FAIL: ${failMsg}`)
    if (extra !== undefined) console.error(extra)
    failed = true
  }
}

const cleanManifest = {
  manifestVersion: 1,
  id: 'fixture-extension',
  name: 'Fixture',
  version: '9.9.9',
  publisher: 'fixture',
  targets: [{ id: 'Microsoft.VisualStudio.Services' }],
  public: false,
  files: [{ path: 'Tasks/Alpha' }],
  contributions: [
    {
      id: 'fixture-alpha',
      type: 'ms.vss-distributed-task.task',
      targets: ['ms.vss-distributed-task.tasks'],
      properties: { name: 'Tasks/Alpha/AlphaV1' },
    },
  ],
}

const cleanReleasePlease = {
  packages: {
    '.': {
      'release-type': 'simple',
      draft: true,
      'force-tag-creation': true,
    },
  },
}

const cleanPackageJson = {
  name: 'fixture',
  version: '0.0.0',
  private: true,
  repository: { type: 'git', url: 'git+https://github.com/fixture-owner/fixture-repo.git' },
}

const IDENTITY = "'^https://github\\.com/fixture-owner/fixture-repo/\\.github/workflows/release\\.yml@refs/(tags/v[0-9]+\\.[0-9]+\\.[0-9]+|heads/main)$'"

/** A minimal release.yml carrying the three things the gate reads. */
function cleanWorkflow({ sboms = [{ file: 'sbom-extension.cdx.json', attest: true }], identity = IDENTITY, verify = true } = {}) {
  const lines = ['---', 'name: Release', 'jobs:', '  sbom-and-sign:', '    steps:']
  for (const s of sboms) {
    lines.push(`      - run: npx --no-install cyclonedx-npm --output-file ${s.file} --omit dev`)
    if (s.attest) {
      lines.push('      - uses: actions/attest@0000000000000000000000000000000000000000')
      lines.push('        with:')
      lines.push('          subject-path: "*.vsix"')
      lines.push(`          sbom-path: "${s.file}"`)
    }
  }
  lines.push('  publish-marketplace:', '    environment: marketplace', '    steps:')
  if (verify) {
    lines.push('      - run: |')
    lines.push('          cosign verify-blob \\')
    lines.push(`            --certificate-identity-regexp ${identity} \\`)
    lines.push('            "$VSIX_FILE"')
  }
  return `${lines.join('\n')}\n`
}

/** A fixture root the gate should pass. */
function makeCleanTree(name) {
  const dir = path.join(workRoot, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true })
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'azure-devops-extension.json'), `${JSON.stringify(cleanManifest, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, '.release-please-config.json'), `${JSON.stringify(cleanReleasePlease, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(cleanPackageJson, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'release.yml'), cleanWorkflow())
  return dir
}

function writeJson(dir, rel, value) {
  fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(value, null, 2)}\n`)
}

function addTask(dir, family, taskDir) {
  const full = path.join(dir, 'Tasks', family, taskDir)
  fs.mkdirSync(full, { recursive: true })
  fs.writeFileSync(path.join(full, 'task.json'), `${JSON.stringify({ id: 'x', name: 'x', version: { Major: 1, Minor: 0, Patch: 0 } }, null, 2)}\n`)
}

function runGate(dir) {
  const res = spawnSync(process.execPath, [path.join(dir, GATE)], { encoding: 'utf8', cwd: dir })
  return { status: res.status, out: `${res.stdout}${res.stderr}` }
}

const CASES = [
  {
    name: 'clean',
    mutate: () => {},
    expectExit: 0,
    expectText: 'a tagged release could proceed',
    why: 'the fixture passes, so every failure below is the mutation and not the fixture',
  },
  {
    name: 'no-contribution',
    mutate: (dir) => writeJson(dir, 'azure-devops-extension.json', { ...cleanManifest, contributions: [] }),
    expectExit: 1,
    expectText: 'at least one contribution',
    why: 'an empty contributions[] is named here instead of surfacing as a bare tfx error four jobs later',
  },
  {
    name: 'draft-without-force-tag',
    mutate: (dir) => writeJson(dir, '.release-please-config.json', { packages: { '.': { 'release-type': 'simple', draft: true } } }),
    expectExit: 1,
    expectText: 'force-tag-creation',
    why: 'draft without force-tag-creation is the defect that left seven draft releases and zero tags (#27)',
  },
  {
    name: 'force-tag-at-top-level',
    mutate: (dir) =>
      writeJson(dir, '.release-please-config.json', {
        draft: true,
        'force-tag-creation': true,
        packages: { '.': { 'release-type': 'simple' } },
      }),
    expectExit: 0,
    expectText: 'a tagged release could proceed',
    why: 'the sibling extensions set both at the top level; that shape must not be a false positive',
  },
  {
    name: 'not-draft-no-force-tag',
    mutate: (dir) => writeJson(dir, '.release-please-config.json', { packages: { '.': { 'release-type': 'simple', draft: false } } }),
    expectExit: 0,
    expectText: 'a tagged release could proceed',
    why: 'a non-draft release tags itself; requiring force-tag-creation there would be noise',
  },
  {
    name: 'sbom-not-attested',
    mutate: (dir) =>
      fs.writeFileSync(
        path.join(dir, '.github', 'workflows', 'release.yml'),
        cleanWorkflow({ sboms: [{ file: 'sbom-extension.cdx.json', attest: false }] }),
      ),
    expectExit: 1,
    expectText: 'no `actions/attest` step names it',
    why: 'an SBOM generated and never attested ships as a file, not as a verifiable claim',
  },
  {
    name: 'no-sbom-at-all',
    mutate: (dir) => fs.writeFileSync(path.join(dir, '.github', 'workflows', 'release.yml'), cleanWorkflow({ sboms: [] })),
    expectExit: 1,
    expectText: 'generates no CycloneDX SBOM at all',
    why: 'removing the control entirely must fail, not pass vacuously',
  },
  {
    name: 'task-without-sbom',
    mutate: (dir) => addTask(dir, 'Alpha', 'AlphaV1'),
    expectExit: 1,
    expectText: 'no SBOM is generated for this task',
    why: 'the day a task lands, an unchanged release.yml leaves its dependency closure undescribed',
  },
  {
    name: 'task-with-sbom',
    mutate: (dir) => {
      addTask(dir, 'Alpha', 'AlphaV1')
      fs.writeFileSync(
        path.join(dir, '.github', 'workflows', 'release.yml'),
        cleanWorkflow({
          sboms: [
            { file: 'sbom-extension.cdx.json', attest: true },
            { file: 'sbom-alpha-v1.cdx.json', attest: true },
          ],
        }),
      )
    },
    expectExit: 0,
    expectText: 'a tagged release could proceed',
    why: 'covering the task clears the failure — the gate demands a fix, not a permanent red',
  },
  {
    name: 'foreign-signing-identity',
    mutate: (dir) =>
      fs.writeFileSync(
        path.join(dir, '.github', 'workflows', 'release.yml'),
        cleanWorkflow({
          identity: "'^https://github\\.com/sethbacon/azure-pipelines-terraform/\\.github/workflows/release\\.yml@refs/tags/v.*$'",
        }),
      ),
    expectExit: 1,
    expectText: 'not this repository',
    why: 'a cosign identity ported verbatim from a sibling verifies the sibling, not these bytes',
  },
  {
    name: 'no-verify-step',
    mutate: (dir) => fs.writeFileSync(path.join(dir, '.github', 'workflows', 'release.yml'), cleanWorkflow({ verify: false })),
    expectExit: 1,
    expectText: 'runs no `cosign verify-blob --certificate-identity-regexp`',
    why: 'without the pre-publish integrity gate nothing checks the bytes being published are the bytes signed',
  },
  {
    name: 'comment-only',
    mutate: (dir) => {
      const text = cleanWorkflow()
        .split('\n')
        .map((line) => (line.trim() === '' || line === '---' ? line : `# ${line}`))
        .join('\n')
      fs.writeFileSync(path.join(dir, '.github', 'workflows', 'release.yml'), text)
    },
    expectExit: 1,
    expectText: 'generates no CycloneDX SBOM at all',
    why: 'commented-out YAML is prose: a control described but not run must not satisfy the gate',
  },
]

try {
  for (const c of CASES) {
    const dir = makeCleanTree(c.name)
    // Every case starts from a tree the gate passes, so a failure below is the mutation.
    const before = runGate(dir)
    check(
      before.status === 0,
      `${c.name}: the unmutated fixture passes`,
      `${c.name}: the fixture ALREADY fails before the mutation, so this case proves nothing`,
      before.out,
    )
    c.mutate(dir)
    const after = runGate(dir)
    check(
      after.status === c.expectExit && after.out.includes(c.expectText),
      `${c.name}: exit ${after.status} naming "${c.expectText}" — ${c.why}`,
      `${c.name}: expected exit ${c.expectExit} and a message containing "${c.expectText}", got exit ${after.status}`,
      after.out,
    )
  }
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true })
}

if (failed) {
  console.error('\ncheck-release-readiness.js self-test: FAILED.')
  process.exit(1)
}
console.log(`\ncheck-release-readiness.js self-test: ${CASES.length} case(s) passed.`)
