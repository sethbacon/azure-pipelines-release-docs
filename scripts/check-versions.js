#!/usr/bin/env node
'use strict'

// CI gate: every task.json must carry a well-formed Major/Minor/Patch version,
// a unique GUID, and a name matching the estate's `Pipeline` prefix convention
// (the prefix is what lets this extension install side-by-side with others).

const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const errors = []

function taskManifests() {
  const tasksRoot = path.join(root, 'Tasks')
  if (!fs.existsSync(tasksRoot)) return []
  return fs
    .readdirSync(tasksRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((group) =>
      fs
        .readdirSync(path.join(tasksRoot, group.name), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(tasksRoot, group.name, e.name, 'task.json'))
        .filter((p) => fs.existsSync(p)),
    )
}

const seenIds = new Map()
const seenNames = new Map()

for (const manifest of taskManifests()) {
  const rel = path.relative(root, manifest)
  let task
  try {
    task = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  } catch (err) {
    errors.push(`${rel}: not valid JSON — ${err.message}`)
    continue
  }

  for (const field of ['Major', 'Minor', 'Patch']) {
    const value = task.version && task.version[field]
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${rel}: version.${field} must be a non-negative integer, got ${JSON.stringify(value)}`)
    }
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(task.id || '')) {
    errors.push(`${rel}: id must be a GUID, got ${JSON.stringify(task.id)}`)
  } else if (seenIds.has(task.id)) {
    errors.push(`${rel}: id ${task.id} is already used by ${seenIds.get(task.id)}`)
  } else {
    seenIds.set(task.id, rel)
  }

  if (!/^Pipeline[A-Z]/.test(task.name || '')) {
    errors.push(`${rel}: name ${JSON.stringify(task.name)} must start with the "Pipeline" prefix`)
  } else if (seenNames.has(task.name)) {
    errors.push(`${rel}: name ${task.name} is already used by ${seenNames.get(task.name)}`)
  } else {
    seenNames.set(task.name, rel)
  }
}

const manifestPath = path.join(root, 'azure-devops-extension.json')
const extension = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(extension.version || '')) {
  errors.push(`azure-devops-extension.json: version must be semver, got ${JSON.stringify(extension.version)}`)
}
if (extension.public !== false) {
  errors.push('azure-devops-extension.json: base manifest must keep "public": false; configs/release.json opts in')
}

if (errors.length > 0) {
  console.error('Version check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`Version check passed (${seenIds.size} task(s)).`)
