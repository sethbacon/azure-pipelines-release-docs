#!/usr/bin/env node
'use strict'

// Mutation self-test for the VERSION / UNIVERSE / PUBLISH-IDENTITY / AUDIT-SCOPE
// / DEPENDABOT-COVERAGE gates — scripts/check-versions.js,
// scripts/for-each-task.js, scripts/check-audit-scope.js,
// scripts/check-dependabot-coverage.js and the declaration in
// scripts/lib/task-dirs.js.
//
// Companion to scripts/test-package-composition.js, which does the same for the
// composition path. Same contract, because it is the only one worth anything: a
// gate is unproven until you have broken the thing it protects and watched it
// fail BY NAME. Every case builds a clean fixture, proves the gate passes on it,
// reintroduces exactly one defect the audit found, and asserts a non-zero exit
// AND the expected substring. Exit code alone is not evidence — a gate that
// started failing for an unrelated reason looks identical.
//
// Cases, mapped to the findings they re-create:
//   guid-hyphens / guid-short   36 hyphens accepted as a GUID              (#38)
//   dup-id-case / dup-name-case uniqueness defeated by changing one letter (#38)
//   dup-malformed-id            a bad id skipped registration, so a second
//                               task could reuse it silently               (#38)
//   version-regression          a task version moving backwards            (#44)
//   version-not-bumped          task code changed, version did not         (#44)
//   history-unresolvable        tasks present, previous versions unreadable(#44)
//   dev-public / dev-gallery    a dev override opting into a public listing(#43)
//   release-not-public          the release override NOT opting in         (#43)
//   override-id / -publisher    publish coordinates drifting               (#43)
//   unknown-config              a new override no rule covers              (#43)
//   configs-missing             the override directory gone                (#43)
//   universe-*                  the empty-universe contract, both ways     (#39)
//   audit-*                     a required audit job inspecting nothing (#20,#54)
//   dependabot-*                a task's lockfile nobody watches, and the
//                               reverse: an entry watching nothing        (#25)
//
// The scaffold case is the one to read closely: it asserts that a tree with a
// DECLARED-empty Tasks/ exits 0 while SAYING it proved nothing. That is the
// distinction the whole design rests on, so it is asserted rather than assumed.
//
// Nothing is written under this repository's own Tasks/, which the estate's
// audit profile declares absent and which must stay that way.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const repoRoot = path.join(__dirname, '..')
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-docs-gates-'))

const VERSIONS = path.join('scripts', 'check-versions.js')
const AUDIT_SCOPE = path.join('scripts', 'check-audit-scope.js')
const DEPENDABOT = path.join('scripts', 'check-dependabot-coverage.js')
const FOR_EACH = path.join('scripts', 'for-each-task.js')

const EXTENSION_ID = 'fixture-extension'
const PUBLISHER = 'fixture'
const VERSION = '9.9.9'

const alphaTask = { id: '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607', name: 'PipelineAlpha', friendlyName: 'Alpha', version: { Major: 2, Minor: 1, Patch: 0 } }
const betaTask = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'PipelineBeta', friendlyName: 'Beta', version: { Major: 1, Minor: 0, Patch: 0 } }

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * A fixture root every gate should pass: two canonical tasks, a declaration
 * matching them, and the packaging overrides the publish-identity check reads.
 */
function makeCleanTree(name, { tasks = ['Alpha', 'Beta'] } = {}) {
  const dir = path.join(workRoot, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dir, 'scripts'), { recursive: true })
  fs.cpSync(path.join(repoRoot, '.github', 'workflows'), path.join(dir, '.github', 'workflows'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'package-lock.json'), path.join(dir, 'package-lock.json'))
  writeJson(path.join(dir, 'package.json'), { name: 'fixture-root', private: true })
  writeDependabot(dir, tasks.map((task) => `Tasks/${task}/${task}V1`))

  writeJson(path.join(dir, 'azure-devops-extension.json'), {
    manifestVersion: 1,
    id: EXTENSION_ID,
    name: 'Fixture',
    version: VERSION,
    publisher: PUBLISHER,
    public: false,
    files: [{ path: 'Tasks/Alpha' }],
    contributions: [],
  })
  writeJson(path.join(dir, '.release-please-manifest.json'), { '.': VERSION })
  writeJson(path.join(dir, '.release-please-config.json'), { packages: { '.': { 'package-name': EXTENSION_ID } } })
  writeJson(path.join(dir, 'task-universe.json'), {
    expect: tasks.length > 0 ? 'present' : 'absent',
    minTasks: tasks.length,
    why: 'Fixture tree for the gate mutation self-test — the declared count is exactly what this fixture builds.',
  })
  writeJson(path.join(dir, 'configs', 'dev.json'), { id: `${EXTENSION_ID}-dev`, publisher: PUBLISHER, public: false })
  writeJson(path.join(dir, 'configs', 'release.json'), { id: EXTENSION_ID, publisher: PUBLISHER, public: true, galleryFlags: ['Public'] })

  if (tasks.includes('Alpha')) {
    writeJson(path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'task.json'), alphaTask)
    writeJson(path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'package.json'), { name: 'alpha', private: true })
    fs.writeFileSync(path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'index.js'), "'use strict'\n")
  }
  if (tasks.includes('Beta')) {
    writeJson(path.join(dir, 'Tasks', 'Beta', 'BetaV1', 'task.json'), betaTask)
    writeJson(path.join(dir, 'Tasks', 'Beta', 'BetaV1', 'package.json'), { name: 'beta', private: true })
    fs.writeFileSync(path.join(dir, 'Tasks', 'Beta', 'BetaV1', 'index.js'), "'use strict'\n")
  }
  return dir
}

/**
 * A dependabot config covering the root and every task directory the fixture
 * builds — i.e. the state the repository has to be in once tasks land, and the
 * one the coverage gate is mutated away from below.
 */
function writeDependabot(dir, taskDirs) {
  const entry = (directory) => [
    '  - package-ecosystem: npm',
    `    directory: "/${directory}"`,
    '    schedule:',
    '      interval: weekly',
  ]
  const lines = [
    'version: 2',
    '',
    'updates:',
    '  - package-ecosystem: github-actions',
    '    directory: "/"',
    '    schedule:',
    '      interval: weekly',
    '    groups:',
    '      github-actions-dependencies:',
    '        patterns:',
    '          - "*"',
    ...entry(''),
    ...taskDirs.flatMap((taskDir) => entry(taskDir)),
    '',
  ]
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.github', 'dependabot.yml'), lines.join('\n'))
}

/** Rewrite a fixture's dependabot config as text, the way a maintainer would. */
function editDependabot(dir, mutate) {
  const file = path.join(dir, '.github', 'dependabot.yml')
  fs.writeFileSync(file, mutate(fs.readFileSync(file, 'utf8')))
}

function git(dir, args) {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' })
}

/** Give a fixture one commit, so the monotonicity comparison has a base. */
function commitAll(dir) {
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 'gates@example.invalid'])
  git(dir, ['config', 'user.name', 'gate fixture'])
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'fixture'])
  return git(dir, ['rev-parse', 'HEAD']).stdout.trim()
}

function run(dir, script, { env = {}, args = [] } = {}) {
  const result = spawnSync(process.execPath, [path.join(dir, script), ...args], {
    encoding: 'utf8',
    cwd: dir,
    env: { ...process.env, BASE_REV: '', ...env },
  })
  return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}` }
}

let failures = 0

function report(ok, message) {
  if (ok) console.log(`  OK   ${message}`)
  else {
    console.error(`  FAIL ${message}`)
    failures += 1
  }
}

/** A gate must exit non-zero AND say why. */
function expectRejection(label, script, mutate, expected, options = {}) {
  const dir = makeCleanTree(`case-${label}`, options)
  const base = options.git ? commitAll(dir) : null
  mutate(dir)
  const { status, output } = run(dir, script, { env: base && !options.noBase ? { BASE_REV: base } : {}, args: options.args || [] })
  if (status === 0) {
    report(false, `${label}: ${script} exited 0 on the mutated tree\n${output}`)
    return
  }
  const wanted = Array.isArray(expected) ? expected : [expected]
  const missing = wanted.filter((w) => !output.includes(w))
  if (missing.length > 0) {
    report(false, `${label}: ${script} failed but never mentioned ${missing.map((m) => JSON.stringify(m)).join(', ')}\n${output}`)
    return
  }
  report(true, `${label}: ${script} exits ${status} naming ${wanted.map((w) => JSON.stringify(w)).join(' + ')}`)
}

function expectPass(label, script, options = {}, mustSay = []) {
  const dir = makeCleanTree(`pass-${label}`, options)
  const base = options.git ? commitAll(dir) : null
  if (options.mutate) options.mutate(dir)
  const { status, output } = run(dir, script, { env: base ? { BASE_REV: base } : {}, args: options.args || [] })
  if (status !== 0) {
    report(false, `${label}: ${script} exited ${status} on a tree it should accept\n${output}`)
    return
  }
  const missing = mustSay.filter((w) => !output.includes(w))
  if (missing.length > 0) {
    report(false, `${label}: ${script} passed but never said ${missing.map((m) => JSON.stringify(m)).join(', ')}\n${output}`)
    return
  }
  report(true, `${label}: ${script} exits 0${mustSay.length ? ` saying ${mustSay.map((w) => JSON.stringify(w)).join(' + ')}` : ''}`)
}

function editTask(dir, family, task, mutate) {
  const file = path.join(dir, 'Tasks', family, task, 'task.json')
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  mutate(value)
  writeJson(file, value)
}

function editJson(dir, rel, mutate) {
  const file = path.join(dir, rel)
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  mutate(value)
  writeJson(file, value)
}

function editWorkflow(dir, file, mutate) {
  const full = path.join(dir, '.github', 'workflows', file)
  fs.writeFileSync(full, mutate(fs.readFileSync(full, 'utf8')))
}

try {
  console.log('clean trees:')
  expectPass('clean-versions', VERSIONS, { git: true }, ['examined 2 task manifest(s)', '2 compared against'])
  expectPass('clean-audit-scope', AUDIT_SCOPE, {}, ['Audit scope check passed'])
  expectPass('clean-dependabot', DEPENDABOT, {}, ['all 2 task director(ies) are enumerated', '3 npm entr(ies)'])

  // The load-bearing case. A DECLARED-empty tree is allowed to exit 0 — and is
  // required to say, in words, that it validated nothing. "Nothing to examine
  // yet" and "examined nothing" are the same exit code; only this line separates
  // them, so if it ever stops being printed this test fails (#39).
  console.log('the declared-empty universe:')
  expectPass('scaffold-versions', VERSIONS, { tasks: [] }, [
    'SCAFFOLD: 0 tasks enumerated',
    'proved nothing about task code',
    'examined 0 task manifest(s)',
  ])
  expectPass('scaffold-for-each', FOR_EACH, { tasks: [], args: ['compile'] }, [
    'SCAFFOLD: 0 tasks enumerated',
    "'compile' ran against nothing",
  ])
  // The declared-empty case for #25 specifically: zero task directories means
  // the coverage half of this gate enumerated nothing, and it has to say so
  // while still proving what it CAN prove about the entries that exist.
  expectPass('scaffold-dependabot', DEPENDABOT, { tasks: [] }, [
    'SCAFFOLD: 0 tasks enumerated',
    'proved nothing about it',
    '0 task director(ies) on disk',
  ])

  console.log('mutations — the universe contract (#39):')

  // Declared absent while a task exists: the state that must NOT be reachable by
  // accident. This is what stops the scaffold exemption from being a loophole —
  // the floor of zero cannot survive the arrival of real task code.
  expectRejection(
    'universe-stale-absent',
    VERSIONS,
    (dir) => writeJson(path.join(dir, 'task-universe.json'), { expect: 'absent', why: 'still a scaffold, honestly, no really, trust me on this' }),
    ['declares Tasks/ absent', 'has outlived its scope'],
  )
  expectRejection(
    'universe-stale-absent-for-each',
    FOR_EACH,
    (dir) => writeJson(path.join(dir, 'task-universe.json'), { expect: 'absent', why: 'still a scaffold, honestly, no really, trust me on this' }),
    'declares Tasks/ absent',
    { args: ['test'] },
  )
  // The floor issue #39 asked for: a declared task that did not enumerate.
  expectRejection(
    'universe-floor',
    VERSIONS,
    (dir) => fs.rmSync(path.join(dir, 'Tasks', 'Beta'), { recursive: true, force: true }),
    ['declares at least 2 task(s), but 1 were enumerated'],
  )
  expectRejection(
    'universe-floor-for-each',
    FOR_EACH,
    (dir) => fs.rmSync(path.join(dir, 'Tasks'), { recursive: true, force: true }),
    'declares at least 2 task(s), but 0 were enumerated',
    { args: ['ci'] },
  )
  // No declaration at all: an undeclared zero is exactly "examined nothing and
  // called it clean", so it is not allowed to be a pass either.
  expectRejection('universe-undeclared', VERSIONS, (dir) => fs.rmSync(path.join(dir, 'task-universe.json')), 'task-universe.json: missing')
  expectRejection(
    'universe-undeclared-empty-tree',
    VERSIONS,
    (dir) => fs.rmSync(path.join(dir, 'task-universe.json')),
    'task-universe.json: missing',
    { tasks: [] },
  )
  expectRejection(
    'universe-placeholder-why',
    VERSIONS,
    (dir) => editJson(dir, 'task-universe.json', (u) => {
      u.why = 'because'
    }),
    'why must be at least',
  )

  console.log('mutations — task identity (#38):')

  expectRejection(
    'guid-hyphens',
    VERSIONS,
    (dir) => editTask(dir, 'Alpha', 'AlphaV1', (t) => {
      t.id = '------------------------------------' // 36 hyphens: the audit's own fixture
    }),
    'id must be a canonical GUID',
  )
  expectRejection(
    'guid-short',
    VERSIONS,
    (dir) => editTask(dir, 'Alpha', 'AlphaV1', (t) => {
      t.id = '3f2a1b4c5d6e4f708a91b2c3d4e5f60712' // 34 hex, no grouping
    }),
    'id must be a canonical GUID',
  )
  // The same GUID in a different case is the same identity to Azure DevOps, and
  // was two distinct Map keys here.
  expectRejection(
    'dup-id-case',
    VERSIONS,
    (dir) => editTask(dir, 'Beta', 'BetaV1', (t) => {
      t.id = alphaTask.id.toUpperCase()
    }),
    ['id', 'is already used by'],
  )
  expectRejection(
    'dup-name-case',
    VERSIONS,
    (dir) => editTask(dir, 'Beta', 'BetaV1', (t) => {
      t.name = 'PipelineALPHA'
    }),
    ['name', 'is already used by'],
  )
  // The `else if` bug: a malformed id was never registered, so a SECOND task
  // could reuse it and no duplicate was reported. Both errors must appear.
  expectRejection(
    'dup-malformed-id',
    VERSIONS,
    (dir) => {
      editTask(dir, 'Alpha', 'AlphaV1', (t) => {
        t.id = 'not-a-guid-at-all'
      })
      editTask(dir, 'Beta', 'BetaV1', (t) => {
        t.id = 'not-a-guid-at-all'
      })
    },
    ['id must be a canonical GUID', 'is already used by'],
  )

  console.log('mutations — task version history (#44):')

  expectRejection(
    'version-regression',
    VERSIONS,
    (dir) => editTask(dir, 'Alpha', 'AlphaV1', (t) => {
      t.version = { Major: 1, Minor: 0, Patch: 0 }
    }),
    ['is BELOW 2.1.0', 'cache'],
    { git: true },
  )
  expectRejection(
    'version-not-bumped',
    VERSIONS,
    (dir) => fs.writeFileSync(path.join(dir, 'Tasks', 'Alpha', 'AlphaV1', 'index.js'), "'use strict'\nrequire('node:child_process')\n"),
    ['changed since', 'did not move'],
    { git: true },
  )
  // Tasks present and no readable history: unverifiable is not verified.
  expectRejection(
    'history-unresolvable',
    VERSIONS,
    () => {},
    ['could not be compared with their previous values', 'not a verified one'],
    // A git tree with ONE commit and no remote: BASE_REV unset, origin/main and
    // HEAD^ both unresolvable. Two real tasks, no readable previous version —
    // the gate must refuse rather than skip the comparison and report success.
    { git: true, noBase: true },
  )

  console.log('mutations — publish identity (#43):')

  expectRejection(
    'dev-public',
    VERSIONS,
    (dir) => editJson(dir, 'configs/dev.json', (c) => {
      c.public = true
    }),
    ['configs/dev.json: "public": true', 'tfx overrides win'],
  )
  expectRejection(
    'dev-gallery-public',
    VERSIONS,
    (dir) => editJson(dir, 'configs/dev.json', (c) => {
      c.galleryFlags = ['Public']
    }),
    ['configs/dev.json: galleryFlags includes "Public"'],
  )
  expectRejection(
    'release-not-public',
    VERSIONS,
    (dir) => editJson(dir, 'configs/release.json', (c) => {
      c.public = false
    }),
    ['configs/release.json: "public": false'],
  )
  expectRejection(
    'override-id',
    VERSIONS,
    (dir) => editJson(dir, 'configs/dev.json', (c) => {
      c.id = 'somebody-elses-extension'
    }),
    ['configs/dev.json: id', 'different listing'],
  )
  expectRejection(
    'override-publisher',
    VERSIONS,
    (dir) => editJson(dir, 'configs/dev.json', (c) => {
      c.publisher = 'attacker'
    }),
    ['configs/dev.json: publisher', 'different identity'],
  )
  expectRejection(
    'override-public-missing',
    VERSIONS,
    (dir) => editJson(dir, 'configs/dev.json', (c) => {
      delete c.public
    }),
    ['"public" must be stated explicitly'],
  )
  expectRejection(
    'unknown-config',
    VERSIONS,
    (dir) => writeJson(path.join(dir, 'configs', 'staging.json'), { id: EXTENSION_ID, publisher: PUBLISHER, public: true, galleryFlags: ['Public'] }),
    ['configs/staging.json: unrecognised packaging override'],
  )
  expectRejection('configs-missing', VERSIONS, (dir) => fs.rmSync(path.join(dir, 'configs'), { recursive: true }), 'configs/: missing')
  expectRejection(
    'extension-id-drift',
    VERSIONS,
    (dir) => editJson(dir, 'azure-devops-extension.json', (m) => {
      m.id = 'renamed-extension'
    }),
    ["does not match .release-please-config.json's"],
  )

  console.log('mutations — audit scope (#20, #54):')

  expectRejection(
    'audit-omit-dev',
    AUDIT_SCOPE,
    (dir) => editWorkflow(dir, 'ci.yml', (yaml) => yaml.replace('run: npm audit --audit-level=high', 'run: npm audit --omit=dev --audit-level=high')),
    ['would inspect 0 of', '--omit=dev excludes all'],
  )
  expectRejection(
    'audit-absent',
    AUDIT_SCOPE,
    (dir) => editWorkflow(dir, 'ci.yml', (yaml) => yaml.replace(/^.*npm audit.*$/gm, '      - run: true')),
    ['no `npm audit` invocation in any workflow'],
  )
  expectRejection(
    'audit-per-task-unwired',
    AUDIT_SCOPE,
    (dir) => editWorkflow(dir, 'ci.yml', (yaml) => yaml.replace(/^.*npm run audit:all.*$/gm, '      - run: true')),
    ['no workflow runs the per-task audit'],
  )
  expectRejection(
    'audit-action-removed',
    AUDIT_SCOPE,
    (dir) => {
      const file = path.join(dir, 'scripts', 'for-each-task.js')
      const source = fs.readFileSync(file, 'utf8')
      fs.writeFileSync(file, source.replace(/^ {2}audit: .*$/m, '  // audit removed'))
    },
    ["but no 'audit'"],
  )
  expectRejection(
    'audit-empty-lockfile',
    AUDIT_SCOPE,
    (dir) => writeJson(path.join(dir, 'package-lock.json'), { name: 'fixture', lockfileVersion: 3, packages: { '': {} } }),
    ['resolves 0 packages'],
  )

  console.log('mutations — dependabot coverage (#25):')

  // THE case. A task lands and nobody edits .github/dependabot.yml: its
  // lockfile is then watched by nothing, and every other control stays green
  // because none of them looks inside a task directory either.
  expectRejection(
    'dependabot-task-unwatched',
    DEPENDABOT,
    (dir) => editDependabot(dir, (yaml) => yaml.replace('  - package-ecosystem: npm\n    directory: "/Tasks/Beta/BetaV1"\n    schedule:\n      interval: weekly\n', '')),
    ['Tasks/Beta/BetaV1', 'no automated updates at all', 'directory: "/Tasks/Beta/BetaV1"'],
  )
  // A glob covers what it matches. `Tasks/*` does NOT reach two levels down, so
  // a config that looks like coverage and is not must still fail.
  expectRejection(
    'dependabot-glob-too-shallow',
    DEPENDABOT,
    (dir) =>
      editDependabot(dir, (yaml) =>
        yaml
          .replace('    directory: "/Tasks/Alpha/AlphaV1"', '    directories:\n      - "/Tasks/*"')
          .replace('    directory: "/Tasks/Beta/BetaV1"', '    directories:\n      - "/Tasks/*"'),
      ),
    ['Tasks/Alpha/AlphaV1', 'no automated updates at all'],
  )
  // And the same glob written to the right depth is coverage, so the gate is
  // not simply rejecting globs.
  expectPass(
    'dependabot-glob-matches',
    DEPENDABOT,
    {
      mutate: (dir) =>
        editDependabot(dir, (yaml) =>
          yaml
            .replace('    directory: "/Tasks/Alpha/AlphaV1"', '    directories:\n      - "/Tasks/*/*"')
            .replace('    directory: "/Tasks/Beta/BetaV1"', '    directories:\n      - "/Tasks/*/*"'),
        ),
    },
    ['all 2 task director(ies) are enumerated'],
  )
  // The other direction: an entry that watches nothing. Dependabot logs a
  // missing directory and carries on, so the row reads as coverage forever.
  expectRejection(
    'dependabot-phantom-directory',
    DEPENDABOT,
    (dir) => editDependabot(dir, (yaml) => yaml.replace('"/Tasks/Beta/BetaV1"', '"/Tasks/Beta/BetaV2"')),
    ['names a directory that does not exist', 'coverage it does not provide'],
  )
  expectRejection(
    'dependabot-directory-without-package',
    DEPENDABOT,
    (dir) => fs.rmSync(path.join(dir, 'Tasks', 'Beta', 'BetaV1', 'package.json')),
    ['no package.json', 'inert'],
  )
  expectRejection(
    'dependabot-root-dropped',
    DEPENDABOT,
    (dir) => editDependabot(dir, (yaml) => yaml.replace('  - package-ecosystem: npm\n    directory: "/"\n    schedule:\n      interval: weekly\n', '')),
    ['no npm entry for `directory: "/"`'],
  )
  expectRejection(
    'dependabot-no-npm-entry',
    DEPENDABOT,
    (dir) => editDependabot(dir, (yaml) => yaml.replace(/  - package-ecosystem: npm/g, '  - package-ecosystem: nuget')),
    ['declares no `package-ecosystem: npm` entry at all'],
  )
  expectRejection(
    'dependabot-file-missing',
    DEPENDABOT,
    (dir) => fs.rmSync(path.join(dir, '.github', 'dependabot.yml')),
    ['not found', 'pass over an empty set'],
  )
  expectRejection(
    'dependabot-no-updates-list',
    DEPENDABOT,
    (dir) => fs.writeFileSync(path.join(dir, '.github', 'dependabot.yml'), 'version: 2\n'),
    ['no top-level `updates:` list'],
  )
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\ntest-gates: ${failures} case(s) failed.`)
  process.exit(1)
}
console.log('\ntest-gates: every gate rejected the defect it exists to catch, and the declared-empty run said so out loud.')
