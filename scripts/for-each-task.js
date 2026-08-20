#!/usr/bin/env node
'use strict'

// Runs one npm action across every task directory (Tasks/<Name>/<Name>V<n>).
// Tasks are independent npm packages, so there is no workspace to lean on.
//
// The enumeration comes from scripts/lib/task-dirs.js, which is also what
// check-versions.js validates and what copy-build.js packages — one definition
// of "a task" instead of three (issue #37).

const { execFileSync } = require('node:child_process')
const path = require('node:path')

const { discoverTaskDirs } = require('./lib/task-dirs.js')

const ACTIONS = {
  ci: (dir) => npm(['--prefix', dir, 'ci', '--no-update-notifier', '--no-progress']),
  prune: (dir) => npm(['--prefix', dir, 'prune', '--omit=dev', '--no-update-notifier', '--no-progress']),
  compile: (dir) => tsc(['-b', path.join(dir, 'tsconfig.json')]),
  test: (dir) => npm(['--prefix', dir, 'test']),
}

function npm(args) {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit' })
}

function tsc(args) {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), ...args], { stdio: 'inherit' })
}

function taskDirs() {
  return discoverTaskDirs(path.join(__dirname, '..'))
}

const action = process.argv[2]
if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
  console.error(`Usage: for-each-task.js <${Object.keys(ACTIONS).join('|')}>`)
  process.exit(2)
}

const dirs = taskDirs()
if (dirs.length === 0) {
  console.log('No tasks found under Tasks/ — nothing to do.')
  process.exit(0)
}

for (const dir of dirs) {
  console.log(`\n=== ${action}: ${dir} ===`)
  ACTIONS[action](dir)
}
