#!/usr/bin/env node
'use strict'

// Self-test for generate-third-party-notices.js.
//
// THIRD_PARTY_NOTICES.md is the attribution for what each task bundles into the
// .vsix, and what each task bundles is its PRODUCTION closure: the release build
// runs `npm ci` and then `npm prune --omit=dev` before the package is composed.
// The generator used to list whatever happened to be installed. Run on a tree
// that had not been pruned it attributed every devDependency as bundled -- the
// committed file claimed 317 packages for PipelineChangelog when 37 ship -- and
// nothing noticed, because the only gate on the file is that it exists.
//
// Each case builds a throwaway repository root, runs the generator against it the
// way a maintainer does (as a script, with the root as its argument) and asserts
// on the file it wrote or on the failure it reported:
//
//   - membership comes from the lockfile's production entries, not the install
//     state, so a pruned and an unpruned tree produce the same file
//   - a tree the lockfile does not describe (a production package missing, or
//     installed at another version) fails instead of writing a wrong file
//   - tasks are discovered the way every gate and the packager discover them

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const GENERATOR = path.join(__dirname, 'generate-third-party-notices.js')

let failures = 0
const report = (ok, msg) => {
  if (ok) console.log(`  OK   ${msg}`)
  else {
    console.error(`  FAIL ${msg}`)
    failures += 1
  }
}

/**
 * Writes a repository root holding the given tasks.
 *
 * `packages` is keyed the way a lockfile keys them ('node_modules/a/node_modules/b').
 * Each value is the lockfile entry (`version`, plus `dev` / `optional` as npm
 * records them) with three fixture-only fields: `installed: false` leaves the
 * package off disk, `installedVersion` installs a version the lockfile does not
 * name, and `license` sets the installed package's licence.
 */
function fixture(tasks) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-notices-selftest-'))
  for (const [dir, task] of Object.entries(tasks)) {
    const taskRoot = path.join(root, dir)
    fs.mkdirSync(taskRoot, { recursive: true })
    fs.writeFileSync(path.join(taskRoot, 'task.json'), JSON.stringify({ name: task.name }))
    const lock = { name: 'fixture', lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0' } } }
    for (const [key, pkg] of Object.entries(task.packages)) {
      const { installed = true, installedVersion, license = 'MIT', ...entry } = pkg
      lock.packages[key] = entry
      if (!installed) continue
      const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length)
      fs.mkdirSync(path.join(taskRoot, key), { recursive: true })
      fs.writeFileSync(
        path.join(taskRoot, key, 'package.json'),
        JSON.stringify({ name, version: installedVersion || entry.version, license }),
      )
    }
    fs.writeFileSync(path.join(taskRoot, 'package-lock.json'), JSON.stringify(lock))
  }
  return root
}

function generate(root) {
  const result = spawnSync(process.execPath, [GENERATOR, root], { encoding: 'utf8' })
  const file = path.join(root, 'THIRD_PARTY_NOTICES.md')
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    notices: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null,
  }
}

/** The packages attributed under one task's heading, as 'name@version', or null. */
function attributed(notices, taskName) {
  if (notices === null) return null
  const lines = notices.split('\n')
  const start = lines.indexOf(`## ${taskName}`)
  if (start === -1) return null
  const rows = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 4 || cells[1] === 'Package' || cells[1].startsWith('---')) continue
    rows.push(`${cells[1].replace(/^\[([^\]]+)\]\(.*\)$/, '$1')}@${cells[2]}`)
  }
  return rows
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// What ChangelogV1 resolves in every case below unless a case says otherwise: three
// production packages (one nested, one scoped) and a devDependency with a
// dependency of its own.
const CLOSURE = () => ({
  'node_modules/shipped': { version: '1.2.3' },
  'node_modules/shipped/node_modules/nested': { version: '0.4.0' },
  'node_modules/@scope/scoped': { version: '5.0.0', license: 'Apache-2.0' },
  'node_modules/devtool': { version: '9.9.9', dev: true },
  'node_modules/devtool/node_modules/devdep': { version: '1.1.1', dev: true },
})
const PRODUCTION = ['@scope/scoped@5.0.0', 'nested@0.4.0', 'shipped@1.2.3']
const changelog = (packages) => ({ 'Tasks/Changelog/ChangelogV1': { name: 'PipelineChangelog', packages } })

// --- 1. An unpruned tree: the reported defect -------------------------------
let unpruned
{
  const { status, output, notices } = generate(fixture(changelog(CLOSURE())))
  unpruned = notices
  const rows = attributed(notices, 'PipelineChangelog')
  report(status === 0 && rows !== null, `runs on a tree that still has its devDependencies installed: ${output.trim()}`)
  report(
    rows !== null && !rows.some((r) => r.startsWith('devtool@') || r.startsWith('devdep@')),
    `devDependencies installed beside the production tree are not attributed as bundled: ${JSON.stringify(rows)}`,
  )
  report(same(rows, PRODUCTION), `every production package is attributed, nested and scoped ones included: ${JSON.stringify(rows)}`)
  report(/^Bundled packages: 3$/m.test(notices || ''), 'the count is the production closure, not the install')
  report(/\| @scope\/scoped \| 5\.0\.0 \| Apache-2\.0 \|/.test(notices || ''), 'the licence is the installed package\'s own')
}

// --- 2. The same lockfile, pruned: the file must not depend on which ---------
{
  const packages = CLOSURE()
  packages['node_modules/devtool'].installed = false
  packages['node_modules/devtool/node_modules/devdep'].installed = false
  const { status, notices } = generate(fixture(changelog(packages)))
  report(status === 0 && notices !== null && notices === unpruned, 'a pruned tree and an unpruned tree produce the same file')
}

// --- 3. A production package missing from disk: refuse, do not under-attribute
{
  const packages = CLOSURE()
  packages['node_modules/shipped/node_modules/nested'].installed = false
  const { status, output, notices } = generate(fixture(changelog(packages)))
  report(status !== 0, 'a production package the lockfile names but the tree lacks fails the run')
  report(/nested/.test(output), `the failure names the missing package: ${output.trim()}`)
  report(notices === null, 'no notices file is written from an incomplete tree')
}

// --- 4. ...unless the lockfile marks it optional: npm skips those by platform -
{
  const packages = CLOSURE()
  packages['node_modules/platform-only'] = { version: '2.3.3', optional: true, installed: false }
  const { status, output, notices } = generate(fixture(changelog(packages)))
  report(status === 0, `an optional production package that is not installed is not an error: ${output.trim()}`)
  report(same(attributed(notices, 'PipelineChangelog'), PRODUCTION), 'and it is not attributed, since it is not on disk to be bundled')
}

// --- 5. Installed at a version the lockfile does not name: a stale tree -------
{
  const packages = CLOSURE()
  packages['node_modules/shipped'].installedVersion = '1.2.2'
  const { status, output, notices } = generate(fixture(changelog(packages)))
  report(status !== 0, 'a package installed at another version than the lockfile resolves fails the run')
  report(/1\.2\.2/.test(output) && /1\.2\.3/.test(output), `the failure names both versions: ${output.trim()}`)
  report(notices === null, 'no notices file is written from a stale tree')
}

// --- 6. Tasks are discovered, not listed: a new task cannot go unattributed ---
{
  const root = fixture({
    ...changelog(CLOSURE()),
    'Tasks/Later/LaterV1': { name: 'PipelineLater', packages: { 'node_modules/another': { version: '3.0.0' } } },
  })
  const { status, notices } = generate(root)
  report(status === 0 && same(attributed(notices, 'PipelineLater'), ['another@3.0.0']), 'a task directory the generator was never told about gets its own section')
  report(same(attributed(notices, 'PipelineChangelog'), PRODUCTION), 'and the existing task is unaffected by it')
}

if (failures) {
  console.error(`\n${failures} third-party-notices generator self-test(s) failed.`)
  process.exit(1)
}
console.log('\nOK: the notices generator attributes the production closure the lockfile declares, whatever is installed.')
