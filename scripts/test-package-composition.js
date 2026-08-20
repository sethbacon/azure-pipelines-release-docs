#!/usr/bin/env node
'use strict'

// Mutation self-test for the composition path — scripts/check-package-composition.js,
// scripts/copy-build.js and scripts/check-versions.js.
//
// A gate is worth nothing until you have broken the thing it protects and watched
// it fail. Every case below builds a clean scratch tree, proves the gates pass on
// it, then reintroduces ONE of the defects the audit actually found and asserts
// the gate exits non-zero AND names the cause. A case whose expected substring
// stops appearing is a case that has quietly stopped testing anything, so the
// substring is asserted, not just the exit code.
//
// Cases, mapped to the findings they re-create:
//   deep-nested-task   a task.json three directory levels under Tasks/, which
//                      every gate skipped and the packager shipped        (#37)
//   nested-task-json   a task.json inside an otherwise-valid task directory (#37)
//   stray-file         a payload beside it, outside every task directory  (#37)
//   missing-asset      the manifest pointing at a file that is not there (#42,#46)
//   missing-icon       images/icon.png deleted out from under the manifest (#46)
//   symlink            a tracked symlink the packager would dereference   (#40)
//   symlink-build      the same, proved against copy-build.js's own output(#40)
//   secret             a signing.key at a task root                       (#41)
//   unknown-type       a file type the allowlist does not know — the COST of
//                      the allowlist, made loud instead of silent         (#41)
//   no-contribution    a task with no contributions[] entry               (#47)
//   no-files-entry     a task no files[] entry covers                (#47,#29)
//   dangling-file      a files[] entry pointing at nothing                (#29)
//   version-drift      manifest version != .release-please-manifest.json  (#29)
//
// The scratch tree carries its own copy of scripts/, so each script's
// `path.join(__dirname, '..')` resolves to the fixture root. Nothing is written
// under this repository's Tasks/, which is declared absent by the estate's audit
// profile and must stay that way.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const repoRoot = path.join(__dirname, '..')
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-docs-composition-'))

const GATE = path.join('scripts', 'check-package-composition.js')
const COPY = path.join('scripts', 'copy-build.js')
const VERSIONS = path.join('scripts', 'check-versions.js')

const VERSION = '9.9.9'

const cleanManifest = {
  manifestVersion: 1,
  id: 'fixture-extension',
  name: 'Fixture',
  version: VERSION,
  publisher: 'fixture',
  targets: [{ id: 'Microsoft.VisualStudio.Services' }],
  scopes: ['vso.build'],
  description: 'fixture',
  public: false,
  icons: { default: 'images/icon.png', large: 'images/icon.png' },
  content: { details: { path: 'overview.md' }, license: { path: 'LICENSE' } },
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

const cleanTask = {
  id: '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607',
  name: 'PipelineAlpha',
  friendlyName: 'Alpha',
  version: { Major: 1, Minor: 0, Patch: 0 },
}

/** Build a fresh fixture root that both gates should pass. */
function makeCleanTree(name) {
  const dir = path.join(workRoot, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'azure-devops-extension.json'), `${JSON.stringify(cleanManifest, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, '.release-please-manifest.json'), `${JSON.stringify({ '.': VERSION }, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'fixture licence\n')
  fs.writeFileSync(path.join(dir, 'overview.md'), '# Fixture\n')
  fs.mkdirSync(path.join(dir, 'images'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'images', 'icon.png'), path.join(dir, 'images', 'icon.png'))

  const task = path.join(dir, 'Tasks', 'Alpha', 'AlphaV1')
  fs.mkdirSync(path.join(task, 'Tests'), { recursive: true })
  fs.writeFileSync(path.join(task, 'task.json'), `${JSON.stringify(cleanTask, null, 2)}\n`)
  fs.writeFileSync(path.join(task, 'index.js'), "'use strict'\n")
  fs.writeFileSync(path.join(task, 'index.ts'), "export {}\n")
  fs.writeFileSync(path.join(task, 'tsconfig.json'), '{}\n')
  fs.writeFileSync(path.join(task, 'Tests', 'index.test.js'), "'use strict'\n")
  return dir
}

function run(dir, script) {
  return spawnSync(process.execPath, [path.join(dir, script)], { encoding: 'utf8' })
}

function editManifest(dir, mutate) {
  const file = path.join(dir, 'azure-devops-extension.json')
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  mutate(manifest)
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

let failures = 0

function report(ok, message) {
  if (ok) {
    console.log(`  OK   ${message}`)
  } else {
    console.error(`  FAIL ${message}`)
    failures += 1
  }
}

/** A gate must exit non-zero AND say why. Exit code alone is not evidence. */
function expectRejection(label, script, mutate, expectedSubstring) {
  const dir = makeCleanTree(`case-${label}`)
  mutate(dir)
  const result = run(dir, script)
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (result.status === 0) {
    report(false, `${label}: ${script} exited 0 on the mutated tree`)
    return { dir, output }
  }
  if (!output.includes(expectedSubstring)) {
    report(false, `${label}: ${script} failed but never mentioned ${JSON.stringify(expectedSubstring)}\n${output}`)
    return { dir, output }
  }
  report(true, `${label}: ${script} exits ${result.status} naming ${JSON.stringify(expectedSubstring)}`)
  return { dir, output }
}

try {
  console.log('clean tree:')
  const clean = makeCleanTree('clean')
  for (const script of [GATE, VERSIONS, COPY]) {
    const result = run(clean, script)
    report(result.status === 0, `${script} exits 0 on a clean tree${result.status === 0 ? '' : `\n${result.stdout}${result.stderr}`}`)
  }

  // The clean composition must actually contain what the manifest promises and
  // must NOT contain the dev-only files sitting right next to them. A gate that
  // only ever proves "fails on bad input" has not shown it composes correctly.
  const built = path.join(clean, 'build')
  for (const rel of ['azure-devops-extension.json', 'LICENSE', 'overview.md', 'images/icon.png', 'Tasks/Alpha/AlphaV1/task.json', 'Tasks/Alpha/AlphaV1/index.js']) {
    report(fs.existsSync(path.join(built, rel)), `build/ contains ${rel}`)
  }
  for (const rel of ['Tasks/Alpha/AlphaV1/index.ts', 'Tasks/Alpha/AlphaV1/tsconfig.json', 'Tasks/Alpha/AlphaV1/Tests/index.test.js']) {
    report(!fs.existsSync(path.join(built, rel)), `build/ excludes ${rel}`)
  }

  console.log('mutations:')

  // #37 — the audit's own fixture: a task three directory levels down.
  expectRejection(
    'deep-nested-task',
    GATE,
    (dir) => {
      const deep = path.join(dir, 'Tasks', 'Deep', 'Nested', 'DeepV1')
      fs.mkdirSync(deep, { recursive: true })
      fs.writeFileSync(path.join(deep, 'task.json'), JSON.stringify({ id: 'not-a-guid', name: 'EvilTask', version: { Major: 'x' } }))
      fs.writeFileSync(path.join(deep, 'evil.js'), "require('node:child_process')\n")
    },
    'Tasks/Deep/Nested/DeepV1/task.json',
  )

  // #37 — the same reciprocal assertion one level in: a task.json nested INSIDE
  // an otherwise-valid task directory is also a path the two-level walk never
  // returns, and it is packaged just the same.
  expectRejection(
    'nested-task-json',
    GATE,
    (dir) => {
      const nested = path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'nested')
      fs.mkdirSync(nested, { recursive: true })
      fs.writeFileSync(path.join(nested, 'task.json'), JSON.stringify({ id: 'not-a-guid', name: 'Smuggled' }))
    },
    'Tasks/Alpha/AlphaV1/nested/task.json',
  )

  // #37 — the shallower half: a payload under Tasks/ that is in no task at all.
  expectRejection(
    'stray-file',
    GATE,
    (dir) => {
      fs.writeFileSync(path.join(dir, 'Tasks', 'Alpha', 'loose-payload.js'), "'use strict'\n")
    },
    'Tasks/Alpha/loose-payload.js',
  )

  // #42 / #46 — a manifest-referenced asset that does not exist.
  expectRejection(
    'missing-asset',
    GATE,
    (dir) => editManifest(dir, (m) => {
      m.content.details.path = 'does-not-exist.md'
    }),
    'does-not-exist.md',
  )

  expectRejection(
    'missing-icon',
    GATE,
    (dir) => fs.rmSync(path.join(dir, 'images', 'icon.png')),
    'icons.default',
  )

  // #40 — a symlink the packager would dereference.
  expectRejection(
    'symlink',
    GATE,
    (dir) => fs.symlinkSync('/etc/hostname', path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'notes.md')),
    'symlink',
  )

  // #40 again, at the composition step, and this is the assertion that matters:
  // the old copy-build.js turned this link into a REGULAR FILE holding the
  // target's bytes. Prove no such file was produced.
  {
    const dir = makeCleanTree('case-symlink-build')
    fs.symlinkSync('/etc/hostname', path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'notes.md'))
    const result = run(dir, COPY)
    const output = `${result.stdout || ''}${result.stderr || ''}`
    report(result.status !== 0 && output.includes('symlink'), 'symlink-build: copy-build.js refuses to compose a tree containing a symlink')
    const leaked = path.join(dir, 'build', 'Tasks', 'Alpha', 'AlphaV1', 'notes.md')
    report(!fs.existsSync(leaked), 'symlink-build: build/ holds no dereferenced copy of the link target')
    report(!fs.existsSync(path.join(dir, 'build')), 'symlink-build: no half-composed build/ is left behind')
  }

  // #41 — a secret at a task root, which the denylist copied verbatim.
  expectRejection(
    'secret',
    COPY,
    (dir) => fs.writeFileSync(path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'signing.key'), '-----BEGIN PRIVATE KEY-----\n'),
    'signing.key',
  )

  // #41 — the cost of the allowlist, and the reason it fails closed: a file type
  // no rule covers stops the build by name instead of vanishing from the package.
  expectRejection(
    'unknown-type',
    GATE,
    (dir) => fs.writeFileSync(path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'payload.bin'), 'binary'),
    'payload.bin',
  )

  // #47 — a task that compiles, tests and version-checks and installs as nothing.
  expectRejection(
    'no-contribution',
    GATE,
    (dir) => editManifest(dir, (m) => {
      m.contributions = []
    }),
    'contribution',
  )

  // #47 / #29 — a task declared by a contribution and absent from the package.
  expectRejection(
    'no-files-entry',
    GATE,
    (dir) => editManifest(dir, (m) => {
      m.files = []
    }),
    'files[] entry',
  )

  // #29 — a files[] entry with nothing behind it.
  expectRejection(
    'dangling-file',
    GATE,
    (dir) => editManifest(dir, (m) => {
      m.files.push({ path: 'Tasks/DoesNotExist' })
    }),
    'Tasks/DoesNotExist',
  )

  // #29 — the Marketplace version drifting from the tag and changelog.
  expectRejection(
    'version-drift',
    VERSIONS,
    (dir) => editManifest(dir, (m) => {
      m.version = '1.2.3'
    }),
    'version disagreement',
  )
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\ntest-package-composition: ${failures} case(s) failed.`)
  process.exit(1)
}
console.log('\ntest-package-composition: every gate rejected the defect it exists to catch.')
