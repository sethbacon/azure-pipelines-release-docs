#!/usr/bin/env node
'use strict'

// Runs one npm action across every task directory (Tasks/<Name>/<Name>V<n>).
// Tasks are independent npm packages, so there is no workspace to lean on.

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

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
  const root = path.join(__dirname, '..', 'Tasks')
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((group) =>
      fs
        .readdirSync(path.join(root, group.name), { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, group.name, e.name, 'task.json')))
        .map((e) => path.join('Tasks', group.name, e.name)),
    )
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
