#!/usr/bin/env node
'use strict'

// Assembles ./build — the root tfx packages from. Copies each task's compiled
// output plus the manifest assets, excluding dev-only files.

const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const build = path.join(root, 'build')

const ROOT_ASSETS = ['azure-devops-extension.json', 'LICENSE', 'overview.md', 'THIRD_PARTY_NOTICES.md']
const EXCLUDED_DIRS = new Set(['Tests', 'node_modules/.cache'])
const EXCLUDED_FILES = new Set(['tsconfig.json', 'tsconfig.tests.json', '.npmrc'])

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue
    if (entry.isFile() && (EXCLUDED_FILES.has(entry.name) || entry.name.endsWith('.ts'))) continue
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

fs.rmSync(build, { recursive: true, force: true })
fs.mkdirSync(build, { recursive: true })

for (const asset of ROOT_ASSETS) {
  const from = path.join(root, asset)
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(build, asset))
}

const images = path.join(root, 'images')
if (fs.existsSync(images)) copyDir(images, path.join(build, 'images'))

const tasksRoot = path.join(root, 'Tasks')
if (fs.existsSync(tasksRoot)) copyDir(tasksRoot, path.join(build, 'Tasks'))

console.log(`Build assembled at ${path.relative(root, build)}`)
