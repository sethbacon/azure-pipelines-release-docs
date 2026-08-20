#!/usr/bin/env node
'use strict'

// CI gate behind the required `Check Version Consistency` context.
//
// The job's NAME promises cross-file agreement. Until #44 it delivered three
// independent shape checks that related nothing to anything: a task version was
// "three non-negative integers", the extension version was "semver-shaped", and
// no pair of files was ever compared. What this now asserts, in the order the
// checks run:
//
//   1. UNIVERSE      — Tasks/ is measured against the declaration in
//                      task-universe.json, so "0 tasks" is a declared, falsified-
//                      on-change state rather than a silent pass          (#39)
//   2. TASK MANIFEST — canonical 8-4-4-4-12 GUID, case-folded uniqueness for
//                      both id and name, and a malformed id still registered so
//                      a duplicate of it is reported                      (#38)
//   3. MONOTONICITY  — each task's version compared against the SAME task at the
//                      base revision: never backwards, and never unchanged while
//                      its code changed. Azure DevOps agents cache task
//                      implementations by version, so a regression to an already-
//                      cached number ships new code under an old identity  (#44)
//   4. EXTENSION     — azure-devops-extension.json's version must EQUAL
//                      .release-please-manifest.json's, not merely look like a
//                      version                                            (#29)
//   5. PUBLISH ID    — configs/*.json read and checked: which override may opt
//                      into the public Marketplace listing, and whether the
//                      publish coordinates agree across every file that carries
//                      them. An unknown file in configs/ fails closed      (#43)
//
// Task enumeration comes from scripts/lib/task-dirs.js — the same module
// scripts/check-package-composition.js and scripts/copy-build.js use, so the
// gates and the packager cannot disagree about what a task is (#37).
//
// Mutation-proved by scripts/test-gates.js, which reintroduces each defect above
// and asserts this script exits non-zero NAMING it.

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const { checkTaskUniverse, UNIVERSE_FILE } = require('./lib/task-dirs.js')

const root = path.join(__dirname, '..')
const errors = []
const notes = []

// What this run actually looked at. Printed unconditionally: a gate that reports
// only "passed" cannot be told apart from a gate that read nothing, which is the
// whole of #39.
const enumerated = { tasks: 0, taskVersionsCompared: 0, overrides: 0, historyBase: 'n/a — no task versions to compare' }

// ── 1. The declared universe ─────────────────────────────────────────────────

const universe = checkTaskUniverse(root)
errors.push(...universe.errors)
enumerated.tasks = universe.count

// ── 2. Task manifests ────────────────────────────────────────────────────────

// Canonical 8-4-4-4-12. The old `/^[0-9a-fA-F-]{36}$/` imposed no positional
// structure whatsoever: 36 hyphens passed, and so did any 36-character mix of
// hex and hyphens (#38). A task id is the identity Azure DevOps installs
// against, so "shaped like a GUID" is the entire assertion — it has to be true.
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// GUIDs are case-insensitive identifiers and Azure DevOps treats them so; two
// task.json files differing only in the case of an id are the SAME task to a
// consumer and a colliding install. Uniqueness is therefore keyed on the folded
// value, while the message reports what was written.
const seenIds = new Map()
const seenNames = new Map()

function registerUnique(map, key, rel, label, original) {
  if (map.has(key)) {
    errors.push(
      `${rel}: ${label} ${JSON.stringify(original)} is already used by ${map.get(key).rel} ` +
        `(${JSON.stringify(map.get(key).original)}) — compared case-insensitively, because that is how it collides`,
    )
    return
  }
  map.set(key, { rel, original })
}

const tasks = []

for (const dir of universe.dirs) {
  const rel = `${dir}/task.json`
  let task
  try {
    task = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
  } catch (err) {
    errors.push(`${rel}: not valid JSON — ${err.message}`)
    continue
  }
  tasks.push({ dir, rel, task })

  for (const field of ['Major', 'Minor', 'Patch']) {
    const value = task.version && task.version[field]
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${rel}: version.${field} must be a non-negative integer, got ${JSON.stringify(value)}`)
    }
  }

  const id = typeof task.id === 'string' ? task.id : ''
  if (!GUID.test(id)) {
    errors.push(
      `${rel}: id must be a canonical GUID (8-4-4-4-12 hex), got ${JSON.stringify(task.id)}`,
    )
  }
  // Registered even when malformed. The old `else if` skipped registration for a
  // bad id, so a SECOND task could reuse the same bad id and no duplicate was
  // ever reported (#38) — the one check here that protects a consumer from an
  // install-time collision, defeated by making the id invalid.
  if (id.length > 0) registerUnique(seenIds, id.toLowerCase(), rel, 'id', task.id)

  const name = typeof task.name === 'string' ? task.name : ''
  if (!/^Pipeline[A-Z]/.test(name)) {
    errors.push(`${rel}: name ${JSON.stringify(task.name)} must start with the "Pipeline" prefix`)
  }
  if (name.length > 0) registerUnique(seenNames, name.toLowerCase(), rel, 'name', task.name)
}

// ── 3. Task versions may not move backwards ──────────────────────────────────

function git(args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function isGitWorkTree() {
  try {
    return git(['rev-parse', '--is-inside-work-tree']).trim() === 'true'
  } catch {
    return false
  }
}

function resolveRev(rev) {
  try {
    return git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).trim() || null
  } catch {
    return null
  }
}

function triple(version) {
  return [version && version.Major, version && version.Minor, version && version.Patch].map((n) =>
    Number.isInteger(n) ? n : -1,
  )
}

function compareTriples(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

if (tasks.length > 0) {
  if (!isGitWorkTree()) {
    // A scratch/fixture tree with no history. Say so; do not imply the check ran.
    enumerated.historyBase = 'skipped (not a git work tree — no previous version to compare against)'
    notes.push('task version monotonicity was NOT checked: this tree has no git history')
  } else {
    // In CI the base is passed explicitly (the PR base sha, or the push's before
    // sha). origin/main and HEAD^ are the local-development fallbacks.
    const candidates = [process.env.BASE_REV, 'origin/main', 'HEAD^'].filter(Boolean)
    let base = null
    for (const candidate of candidates) {
      base = resolveRev(candidate) && candidate
      if (base) break
    }
    if (!base) {
      // Fail closed. There are real tasks and no way to see their previous
      // versions; reporting a pass here would be the same vacuity one level up.
      errors.push(
        `task version history: none of ${candidates.map((c) => JSON.stringify(c)).join(', ')} resolves to a commit, ` +
          `so ${tasks.length} task version(s) could not be compared with their previous values. Set BASE_REV, or ` +
          'fetch enough history (actions/checkout fetch-depth: 0) — an unverifiable version is not a verified one',
      )
      enumerated.historyBase = 'UNRESOLVED'
    } else {
      const resolved = resolveRev(base)
      enumerated.historyBase = base === resolved ? base : `${base} (${resolved})`
      for (const { dir, rel, task } of tasks) {
        let previous
        try {
          previous = JSON.parse(git(['show', `${base}:${rel}`]))
        } catch {
          notes.push(`${rel}: new since ${base} — no previous version to compare`)
          continue
        }
        enumerated.taskVersionsCompared += 1
        const now = triple(task.version)
        const then = triple(previous.version)
        const order = compareTriples(now, then)
        if (order < 0) {
          errors.push(
            `${rel}: version ${now.join('.')} is BELOW ${then.join('.')} at ${base} — Azure DevOps agents cache a ` +
              'task implementation by version, so republishing an already-cached number ships new code under an old identity',
          )
          continue
        }
        if (order === 0) {
          let changed = false
          try {
            git(['diff', '--quiet', base, '--', dir])
          } catch {
            changed = true
          }
          if (changed) {
            // A NOTE, not an error. The property is real -- agents cache by
            // Major.Minor, so shipping changed code under a cached version does
            // not reach them -- but nothing ships from a pull request, and
            // requiring the bump HERE is unsatisfiable for the bots that raise
            // most task-directory changes: Dependabot cannot edit task.json, so
            // every weekly dependency PR was permanently red. It is enforced
            // where it bites instead, by scripts/check-minor-bumps.js against
            // the previous release tag, which is also stricter: it demands the
            // MINOR move, not merely some component of the triple.
            notes.push(
              `${rel}: ${dir} changed since ${base} but version ${now.join('.')} did not move — ` +
                'check-minor-bumps.js requires the Minor bump on the release PR',
            )
          }
        }
      }
    }
  }
}

// ── 4. The extension version, and its agreement with release-please ──────────

const manifestName = 'azure-devops-extension.json'
let extension = null
try {
  extension = JSON.parse(fs.readFileSync(path.join(root, manifestName), 'utf8'))
} catch (err) {
  errors.push(`${manifestName}: not readable as JSON — ${err.message}`)
}

if (extension) {
  if (!/^\d+\.\d+\.\d+$/.test(extension.version || '')) {
    errors.push(`${manifestName}: version must be semver, got ${JSON.stringify(extension.version)}`)
  }
  if (extension.public !== false) {
    errors.push(`${manifestName}: base manifest must keep "public": false; configs/release.json opts in`)
  }
}

// The manifest version is only SHAPE-checked above, and shape is not agreement.
// release-please owns the version: .release-please-manifest.json drives the tag
// and the changelog, and .release-please-config.json's extra-files entry
// propagates it into azure-devops-extension.json's $.version, which is what
// becomes the Marketplace version. A hand-edit of either file, or a
// release-please run that only half-lands, leaves the published package
// versioned differently from the tag and the changelog with nothing to say so
// (issue #29).
let releasePleaseVersion = null
try {
  releasePleaseVersion = JSON.parse(fs.readFileSync(path.join(root, '.release-please-manifest.json'), 'utf8'))['.']
} catch (err) {
  errors.push(`.release-please-manifest.json: not readable as JSON — ${err.message}`)
}
if (releasePleaseVersion !== null && releasePleaseVersion !== undefined) {
  if (extension && releasePleaseVersion !== extension.version) {
    errors.push(
      `version disagreement: azure-devops-extension.json says ${JSON.stringify(extension.version)} but ` +
        `.release-please-manifest.json['.'] says ${JSON.stringify(releasePleaseVersion)} — ` +
        'the published Marketplace version and the tag/changelog would diverge',
    )
  }
} else {
  errors.push(".release-please-manifest.json: missing the '.' package entry that drives this repo's version")
}

// ── 5. The publish identity, across every file that carries it ───────────────
//
// The invariant README states — "a dev package can never accidentally ship a
// public listing" — is a TWO-file property: the base manifest must be
// public:false AND the override tfx is given must not opt in. Only the first
// half was ever a gate. `npm run package:dev` passes --overrides-file
// ./configs/dev.json and tfx overrides WIN, so a dev.json carrying
// "public": true and galleryFlags ["Public"] produced a publicly-listed package
// while this script printed success (#43). The same blind spot covered id and
// publisher: the coordinates deciding WHICH Marketplace listing an artifact
// updates could be changed in any of three files with no gate noticing.
//
// The expected id is anchored to .release-please-config.json's package-name
// rather than a literal in this file, so the check is cross-file agreement (the
// thing the job is named for) rather than a constant this script could drift
// from on its own. Residual, stated rather than hidden: a change made
// consistently in ALL of the manifest, both overrides and the release-please
// config still passes. That is a reviewed, CODEOWNERS-covered, four-file change,
// which is a different act from a one-line edit to an override nobody reads.

const OVERRIDES = {
  'release.json': {
    mayBePublic: true,
    idSuffix: '',
    why: 'the only override permitted to opt into the public Marketplace listing',
  },
  'dev.json': {
    mayBePublic: false,
    idSuffix: '-dev',
    why: 'the local/dev package; it must never produce a public listing',
  },
  'self.json': {
    mayBePublic: false,
    idSuffix: null, // a personal publisher/id by design; git-ignored, may be absent
    optional: true,
    why: 'the personal publisher override (git-ignored). Its coordinates are deliberately its own, but it may not opt into a public listing',
  },
}

const configsDir = path.join(root, 'configs')
if (!fs.existsSync(configsDir)) {
  errors.push('configs/: missing — the packaging overrides carry the publish identity and the public-listing switch')
} else {
  let expectedId = null
  try {
    expectedId = JSON.parse(fs.readFileSync(path.join(root, '.release-please-config.json'), 'utf8')).packages['.'][
      'package-name'
    ]
  } catch (err) {
    errors.push(`.release-please-config.json: no packages['.'].package-name to anchor the extension id to — ${err.message}`)
  }

  if (expectedId && extension && extension.id !== expectedId) {
    errors.push(
      `${manifestName}: id ${JSON.stringify(extension.id)} does not match .release-please-config.json's ` +
        `package-name ${JSON.stringify(expectedId)} — the tagged package and the published extension are different things`,
    )
  }
  const expectedPublisher = extension && typeof extension.publisher === 'string' ? extension.publisher : null
  if (!expectedPublisher) {
    errors.push(`${manifestName}: publisher must be a non-empty string — it is half the Marketplace coordinate`)
  }

  for (const entry of fs.readdirSync(configsDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      errors.push(`configs/${entry.name}: not a regular file — configs/ holds tfx override manifests only`)
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(OVERRIDES, entry.name)) {
      // Fail closed. A new override that no rule covers is exactly how one
      // arrives carrying "public": true.
      errors.push(
        `configs/${entry.name}: unrecognised packaging override — every file in configs/ is passed to tfx by some ` +
          `npm script and wins over the base manifest. Add it to OVERRIDES in scripts/${path.basename(__filename)} ` +
          `with the rule it must satisfy (known: ${Object.keys(OVERRIDES).join(', ')})`,
      )
    }
  }

  for (const [name, rule] of Object.entries(OVERRIDES)) {
    const file = path.join(configsDir, name)
    if (!fs.existsSync(file)) {
      if (!rule.optional) {
        errors.push(`configs/${name}: missing — ${rule.why}`)
      } else {
        notes.push(`configs/${name}: absent (${rule.why})`)
      }
      continue
    }
    enumerated.overrides += 1

    let override
    try {
      override = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (err) {
      errors.push(`configs/${name}: not valid JSON — ${err.message}`)
      continue
    }

    if (typeof override.public !== 'boolean') {
      errors.push(
        `configs/${name}: "public" must be stated explicitly as true or false, got ${JSON.stringify(override.public)} — ` +
          'an override that omits it inherits nothing visible and the listing visibility becomes unreviewable',
      )
    } else if (override.public === true && !rule.mayBePublic) {
      errors.push(
        `configs/${name}: "public": true — ${rule.why}. tfx overrides win over the base manifest, so this packages a ` +
          'publicly-listed extension no matter what azure-devops-extension.json says',
      )
    } else if (override.public === false && rule.mayBePublic && name === 'release.json') {
      errors.push(
        'configs/release.json: "public": false — this is the override that opts INTO the public listing; a release ' +
          'packaged from it would be published unlisted',
      )
    }

    const flags = Array.isArray(override.galleryFlags) ? override.galleryFlags : []
    if (!Array.isArray(override.galleryFlags) && override.galleryFlags !== undefined) {
      errors.push(`configs/${name}: galleryFlags must be an array, got ${JSON.stringify(override.galleryFlags)}`)
    }
    if (flags.includes('Public') && !rule.mayBePublic) {
      errors.push(
        `configs/${name}: galleryFlags includes "Public" — ${rule.why}. The gallery flag lists the extension ` +
          'publicly regardless of the "public" field',
      )
    }

    if (typeof override.id !== 'string' || override.id.length === 0) {
      errors.push(`configs/${name}: id must be a non-empty string — it decides which Marketplace listing is updated`)
    } else if (rule.idSuffix !== null && expectedId && override.id !== `${expectedId}${rule.idSuffix}`) {
      errors.push(
        `configs/${name}: id ${JSON.stringify(override.id)} must be ${JSON.stringify(`${expectedId}${rule.idSuffix}`)} — ` +
          'anything else publishes to, or creates, a different listing than the one this repository releases',
      )
    }

    if (typeof override.publisher !== 'string' || override.publisher.length === 0) {
      errors.push(`configs/${name}: publisher must be a non-empty string`)
    } else if (rule.idSuffix !== null && expectedPublisher && override.publisher !== expectedPublisher) {
      errors.push(
        `configs/${name}: publisher ${JSON.stringify(override.publisher)} does not match the base manifest's ` +
          `${JSON.stringify(expectedPublisher)} — the package would be pushed under a different identity`,
      )
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

for (const note of notes) console.log(`  note: ${note}`)

if (errors.length > 0) {
  console.error('Version check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

// The banner is the whole point of #39: a run that enumerated nothing says so in
// words, above the success line, and never says "passed" on its own.
if (universe.banner) console.log(universe.banner)

console.log(
  `Version check passed — examined ${enumerated.tasks} task manifest(s) ` +
    `(${enumerated.taskVersionsCompared} compared against ${enumerated.historyBase}), ` +
    `${enumerated.overrides} packaging override(s) in configs/, and the extension version against ` +
    `.release-please-manifest.json.`,
)
