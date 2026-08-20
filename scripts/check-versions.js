#!/usr/bin/env node
'use strict'

// CI gate: every task.json must carry a well-formed Major/Minor/Patch version,
// a unique GUID, and a name matching the estate's `Pipeline` prefix convention
// (the prefix is what lets this extension install side-by-side with others), and
// the extension version must agree with the one release-please is tracking.
//
// The task enumeration now comes from scripts/lib/task-dirs.js rather than being
// open-coded here. It used to be one of three independent walks of Tasks/ — this
// one and for-each-task.js each looked exactly two directory levels deep while
// copy-build.js recursed the whole tree, so content the gates never saw was
// still packaged (issue #37). Layout is enforced by
// scripts/check-package-composition.js, which uses the same module.

const fs = require('node:fs')
const path = require('node:path')

const { discoverTaskDirs } = require('./lib/task-dirs.js')

const root = path.join(__dirname, '..')
const errors = []

function taskManifests() {
  return discoverTaskDirs(root).map((dir) => path.join(root, dir, 'task.json'))
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

// The manifest version is only SHAPE-checked above, and shape is not agreement.
// release-please owns the version: .release-please-manifest.json drives the tag
// and the changelog, and .release-please-config.json's extra-files entry
// propagates it into azure-devops-extension.json's $.version, which is what
// becomes the Marketplace version. A hand-edit of either file, or a
// release-please run that only half-lands, leaves the published package
// versioned differently from the tag and the changelog with nothing to say so
// (issue #29).
const releasePleaseManifestPath = path.join(root, '.release-please-manifest.json')
let releasePleaseVersion = null
try {
  releasePleaseVersion = JSON.parse(fs.readFileSync(releasePleaseManifestPath, 'utf8'))['.']
} catch (err) {
  errors.push(`.release-please-manifest.json: not readable as JSON — ${err.message}`)
}
if (releasePleaseVersion !== null && releasePleaseVersion !== undefined) {
  if (releasePleaseVersion !== extension.version) {
    errors.push(
      `version disagreement: azure-devops-extension.json says ${JSON.stringify(extension.version)} but ` +
        `.release-please-manifest.json['.'] says ${JSON.stringify(releasePleaseVersion)} — ` +
        'the published Marketplace version and the tag/changelog would diverge',
    )
  }
} else {
  errors.push(".release-please-manifest.json: missing the '.' package entry that drives this repo's version")
}

if (errors.length > 0) {
  console.error('Version check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`Version check passed (${seenIds.size} task(s)).`)
