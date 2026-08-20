#!/usr/bin/env node
'use strict'

// Runs one npm action across every task directory (Tasks/<Family>/<TaskDirVn>).
// Tasks are independent npm packages, so there is no workspace to lean on.
//
// The enumeration comes from scripts/lib/task-dirs.js, which is also what
// check-versions.js validates and what copy-build.js packages — one definition
// of "a task" instead of three (issue #37).
//
// Two properties this script did not have:
//
//   * A FLOOR. `dirs.length === 0` printed "nothing to do" and exited 0, so
//     `npm run deps`, `npm run compile` and `npm run test:all` each reported
//     success on every CI run to date having executed nothing, on both matrix
//     legs, indistinguishable from a run that compiled and tested N tasks
//     (#39). The count is now measured against the declaration in
//     task-universe.json: a declared-empty tree still exits 0, loudly, and stops
//     doing so the moment the declaration is stale.
//
//   * An `audit` action. Under this repo's independent-package, no-workspace
//     model the root lockfile resolves only the root's own build tooling, so a
//     per-task `npm audit` is the ONLY way a task's dependency tree is ever
//     audited at all (#54). Reserved now, wired into CI now, rather than being
//     invented on the day the first task's dependencies land.

const { execFileSync } = require('node:child_process')
const path = require('node:path')

const { checkTaskUniverse } = require('./lib/task-dirs.js')

const root = path.join(__dirname, '..')

const ACTIONS = {
  // --ignore-scripts: `npm ci` runs dependency preinstall/install/postinstall/
  // prepare by default, so without it every transitive package in a task's
  // lockfile gets arbitrary code execution on the runner. The ROOT install one
  // line above this in CI is hardened and this one was not — the flag was
  // present in the hardened sibling this file was copied from and lost in the
  // copy (#21). It matters most on `build:release`, where `copy` walks each
  // task directory into ./build and tfx packages that as the .vsix.
  ci: (dir) => npm(['--prefix', dir, 'ci', '--ignore-scripts', '--no-update-notifier', '--no-progress']),
  prune: (dir) => npm(['--prefix', dir, 'prune', '--omit=dev', '--no-update-notifier', '--no-progress']),
  compile: (dir) => tsc(['-b', path.join(dir, 'tsconfig.json')]),
  test: (dir) => npm(['--prefix', dir, 'test']),
  // Run from INSIDE the task directory rather than with --prefix: `npm audit`
  // resolves the tree it audits from the working directory, and a --prefix that
  // it quietly ignores would audit the ROOT tree while reporting a task's name —
  // a per-task gate that examines the wrong package is worse than none.
  // --audit-level=high matches the root job; no --omit, because a task's
  // devDependencies build the code that ships (#20, #54).
  audit: (dir) => npm(['audit', '--audit-level=high', '--no-update-notifier', '--no-progress'], { cwd: path.join(root, dir) }),
}

function npm(args, options = {}) {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit', ...options })
}

function tsc(args) {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), ...args], { stdio: 'inherit' })
}

const action = process.argv[2]
if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
  console.error(`Usage: for-each-task.js <${Object.keys(ACTIONS).join('|')}>`)
  process.exit(2)
}

const universe = checkTaskUniverse(root)
if (universe.errors.length > 0) {
  console.error(`for-each-task.js ${action}: the tasks on disk are not the tasks that were declared:`)
  for (const error of universe.errors) console.error(`  - ${error}`)
  process.exit(1)
}

if (universe.count === 0) {
  console.log(universe.banner)
  console.log(`No tasks under Tasks/ — '${action}' ran against nothing.`)
  process.exit(0)
}

for (const dir of universe.dirs) {
  console.log(`\n=== ${action}: ${dir} ===`)
  ACTIONS[action](dir)
}

console.log(`\n${action}: completed over ${universe.count} task(s) — ${universe.dirs.join(', ')}.`)
