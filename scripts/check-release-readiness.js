#!/usr/bin/env node
'use strict'

// ===========================================================================
// Preconditions the RELEASE pipeline depends on and no other gate can see.
//
// scripts/check-versions.js and scripts/check-package-composition.js answer
// "is the tree well formed?". This script answers a different question:
// "if a tag were pushed right now, would .github/workflows/release.yml do the
// right thing?" — which depends on facts that live outside the tree the other
// gates read: the release-please configuration that decides whether a tag is
// ever created, and the release workflow's own text.
//
// It runs in release.yml's `guard` job, before anything is built, so a release
// that could not be correct fails in the first job rather than after the .vsix
// has been packaged, signed and attested.
//
// Four checks, each recreated by scripts/test-release-readiness.js:
//
//   1. SOMETHING TO PUBLISH. `tfx extension create` refuses a manifest with an
//      empty `contributions`: "Your extension must define at least one
//      contribution or contribution type." It says nothing about which manifest
//      or why. Today azure-devops-extension.json declares `"contributions": []`
//      — this repository is a scaffold — so the release pipeline exists and
//      cannot yet complete, and that fact should be stated by name in the first
//      job rather than discovered as a tfx error in the fourth.
//
//   2. A DRAFT RELEASE STILL CREATES ITS TAG. release.yml triggers on
//      `push: tags: v*`. GitHub does not materialise a tag ref for a release
//      created in draft state, so `"draft": true` without
//      `"force-tag-creation": true` means no tag is ever created, the release
//      workflow never fires, and release-please — which locates the previous
//      release by tag — re-releases the whole history on every run (#27; seven
//      draft releases, zero tags, the same commits under every heading in
//      CHANGELOG.md). The release-please config schema documents exactly this
//      pairing. This check exists so that regression cannot recur silently: it
//      is the configuration the entire trigger depends on.
//
//   3. SBOM COVERAGE FOLLOWS THE TASK TREE. The SBOM control is only worth the
//      artifacts it actually describes. Tasks/ is empty today, so release.yml
//      generates and attests exactly one extension-level SBOM. The day a task
//      lands, an SBOM step that nobody remembered to add would leave that task's
//      dependency closure undescribed while SECURITY.md still says
//      `sbom-attestation: enforced` — the documentation-overclaim class, arriving
//      by omission. So: every task directory scripts/lib/task-dirs.js enumerates
//      must be named by a `--output-file` in release.yml, and every SBOM
//      release.yml generates must also be attested. Both directions, because an
//      SBOM generated and not attested is a file in an artifact bundle, not a
//      control.
//
//   4. THE SIGNING IDENTITY NAMES THIS REPOSITORY. The publish path was ported
//      from azure-pipelines-terraform and azure-pipelines-packer, and the one
//      value in it that MUST NOT be ported verbatim is
//      `cosign verify-blob --certificate-identity-regexp`, which pins the
//      workflow identity a signature is accepted from. Left pointing at a
//      sibling, the integrity gate stops verifying that these bytes came from
//      this pipeline. A copied constant that still passes its tests is how this
//      estate acquired three hand-copies of one HTTP client; this one is checked.
//
// Usage:  node scripts/check-release-readiness.js [repoRoot] [--json]
// Exit 0 = a release could proceed. Exit 1 = it could not, and why.
// ===========================================================================

const fs = require('node:fs')
const path = require('node:path')

const { discoverTaskDirs } = require('./lib/task-dirs.js')

const JSON_OUTPUT = process.argv.includes('--json')
const ROOT = path.resolve(process.argv.filter((a) => a !== '--json')[2] || path.join(__dirname, '..'))

const RELEASE_WORKFLOW = '.github/workflows/release.yml'

const findings = []
const fail = (kind, where, message) => findings.push({ kind, where, message })

/** An exit 0 over an empty universe is not a pass. Printed, so the two are told apart. */
const enumerated = { taskDirs: 0, sbomsGenerated: 0, sbomsAttested: 0, identityPins: 0 }

function readIfPresent(rel) {
  const full = path.join(ROOT, rel)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n') : null
}

function readJson(rel) {
  const raw = readIfPresent(rel)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch (err) {
    fail('parse', rel, `is not valid JSON: ${err.message}`)
    return null
  }
}

/**
 * release.yml with whole-line comments removed, matching
 * scripts/check-docs-claims.js. These workflows are heavily commented and a
 * check that fired on a comment would make describing a control accurately into
 * a build failure. Only YAML that actually runs is searched.
 */
const workflowText = (() => {
  const raw = readIfPresent(RELEASE_WORKFLOW)
  if (raw === null) return null
  return raw
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
})()

/* ------------------------------------------------------------------ *
 * 1. The extension has something to publish.
 * ------------------------------------------------------------------ */

const manifest = readJson('azure-devops-extension.json')
if (!manifest) {
  fail('manifest', 'azure-devops-extension.json', 'not found — there is no extension to release')
} else {
  const contributions = Array.isArray(manifest.contributions) ? manifest.contributions : []
  const contributionTypes = Array.isArray(manifest.contributionTypes) ? manifest.contributionTypes : []
  if (contributions.length === 0 && contributionTypes.length === 0) {
    fail(
      'nothing-to-publish',
      'azure-devops-extension.json',
      'declares no contributions and no contributionTypes, so `tfx extension create` will refuse to build a .vsix ' +
        '("Your extension must define at least one contribution or contribution type"). This repository is still a ' +
        'scaffold: the release path is wired and reviewed, and the first release becomes possible when the first task ' +
        'lands and adds its ms.vss-distributed-task.task contribution',
    )
  }
}

/* ------------------------------------------------------------------ *
 * 2. A draft release must still create its tag.
 * ------------------------------------------------------------------ */

const rpConfig = readJson('.release-please-config.json')
if (!rpConfig) {
  fail('release-please', '.release-please-config.json', 'not found — nothing creates the tag release.yml triggers on')
} else {
  const packages = rpConfig.packages && typeof rpConfig.packages === 'object' ? rpConfig.packages : {}
  const names = Object.keys(packages)
  if (names.length === 0) {
    fail('release-please', '.release-please-config.json', 'declares no packages — release-please would cut no release at all')
  }
  for (const name of names) {
    const pkgCfg = packages[name] || {}
    // Top-level values are defaults for every package; a package-level value wins.
    const draft = pkgCfg.draft ?? rpConfig.draft ?? false
    const forceTag = pkgCfg['force-tag-creation'] ?? rpConfig['force-tag-creation'] ?? false
    if (draft && !forceTag) {
      fail(
        'release-please',
        `.release-please-config.json -> packages["${name}"]`,
        'sets `draft: true` without `force-tag-creation: true`. GitHub does not create a Git tag for a draft release, so ' +
          'no `v*` tag is ever pushed: release.yml (which triggers on `push: tags`) never fires, and release-please — ' +
          'which finds the previous release by tag — re-releases the entire history on every run. Both sibling ' +
          'extensions pair the two options; this repository did not, and produced seven draft releases and zero tags (#27)',
      )
    }
  }
}

/* ------------------------------------------------------------------ *
 * 3. SBOM coverage follows the task tree.
 * ------------------------------------------------------------------ */

/** Lowercased and stripped of separators, so `sbom-publish-kb-article-v1.cdx.json` matches `PublishKbArticleV1`. */
function normalise(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const taskDirs = discoverTaskDirs(ROOT)
enumerated.taskDirs = taskDirs.length

if (workflowText === null) {
  fail('workflow', RELEASE_WORKFLOW, 'not found — the release pipeline this script exists to check is absent')
} else {
  const generated = [...workflowText.matchAll(/--output-file\s+(\S+\.cdx\.json)/g)].map((m) => m[1].replace(/^.*\//, ''))
  const attested = [...workflowText.matchAll(/sbom-path:\s*["']?([^"'\s]+\.cdx\.json)["']?/g)].map((m) => m[1].replace(/^.*\//, ''))
  enumerated.sbomsGenerated = generated.length
  enumerated.sbomsAttested = attested.length

  if (generated.length === 0) {
    fail('sbom', RELEASE_WORKFLOW, 'generates no CycloneDX SBOM at all, so the `sbom-attestation` control describes nothing')
  }

  for (const file of generated) {
    if (!attested.includes(file)) {
      fail(
        'sbom',
        `${RELEASE_WORKFLOW} -> ${file}`,
        'is generated but no `actions/attest` step names it in `sbom-path`. An SBOM that is produced and not attested ' +
          'travels with the release as an unsigned file rather than as a verifiable claim about the .vsix',
      )
    }
  }

  // Every task must be described by an SBOM of its own, and the extension-level
  // SBOM must exist on top of those — the shape both siblings publish.
  const taskCovered = new Set()
  for (const dir of taskDirs) {
    const leaf = normalise(dir.split('/').pop())
    const hit = generated.find((file) => normalise(file).includes(leaf))
    if (hit) {
      taskCovered.add(hit)
    } else {
      fail(
        'sbom',
        `${RELEASE_WORKFLOW} -> ${dir}`,
        `no SBOM is generated for this task: no \`--output-file\` in the release workflow names it. Add a generation ` +
          `step (\`sbom-${dir.split('/').pop().toLowerCase()}.cdx.json\`) and the matching \`actions/attest\` step, the ` +
          'way the sibling extensions carry one pair per task',
      )
    }
  }

  const extensionLevel = generated.filter((file) => !taskCovered.has(file))
  if (generated.length > 0 && extensionLevel.length === 0) {
    fail(
      'sbom',
      RELEASE_WORKFLOW,
      'every SBOM it generates belongs to a task; none describes the extension itself. The .vsix carries root-level ' +
        'content too, so one extension-level SBOM is generated in addition to the per-task ones',
    )
  }
}

/* ------------------------------------------------------------------ *
 * 4. The signing identity names this repository.
 * ------------------------------------------------------------------ */

const pkg = readJson('package.json')
const slug = (() => {
  const url = (pkg && pkg.repository && pkg.repository.url) || ''
  const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url)
  return m ? m[1] : null
})()

if (workflowText !== null) {
  if (!slug) {
    fail('signing-identity', 'package.json', 'no `repository.url` naming a GitHub repository, so the signing identity cannot be checked against it')
  } else {
    const pins = [...workflowText.matchAll(/--certificate-identity-regexp\s+'([^']*)'/g)].map((m) => m[1])
    enumerated.identityPins = pins.length
    if (pins.length === 0) {
      fail(
        'signing-identity',
        RELEASE_WORKFLOW,
        'runs no `cosign verify-blob --certificate-identity-regexp`, so nothing checks that the .vsix about to be ' +
          'published is the .vsix this pipeline signed',
      )
    }
    // A regexp is escaped (`github\.com`), so compare on the escape-stripped text.
    const owner = slug.split('/')[0]
    const name = slug.split('/')[1]
    for (const pin of pins) {
      const flat = pin.replace(/\\/g, '')
      if (!flat.includes(`${owner}/${name}/`)) {
        fail(
          'signing-identity',
          `${RELEASE_WORKFLOW} -> ${pin}`,
          `pins the accepted signer to a workflow identity that is not this repository (${slug}). Ported verbatim from a ` +
            'sibling extension, this gate verifies a signature the sibling made and stops attesting anything about these bytes',
        )
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Vacuity guards.
 * ------------------------------------------------------------------ */

if (workflowText !== null && enumerated.sbomsGenerated === 0 && enumerated.identityPins === 0) {
  fail('vacuity', RELEASE_WORKFLOW, 'neither an SBOM nor a signature-verification step was found; checks 3 and 4 would both report nothing for the wrong reason')
}

/* ------------------------------------------------------------------ */

const summary =
  `enumerated: ${enumerated.taskDirs} task director(ies), ${enumerated.sbomsGenerated} SBOM(s) generated, ` +
  `${enumerated.sbomsAttested} attested, ${enumerated.identityPins} signer-identity pin(s).`

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ enumerated, findings, failures: findings.length }, null, 2))
  process.exit(findings.length ? 1 : 0)
}

console.log(summary)

if (findings.length) {
  console.error('')
  for (const f of findings) console.error(`FAIL [${f.kind}] ${f.where}: ${f.message}`)
  console.error(`\n${findings.length} release precondition(s) do not hold.`)
  process.exit(1)
}

console.log('OK: a tagged release could proceed.')
