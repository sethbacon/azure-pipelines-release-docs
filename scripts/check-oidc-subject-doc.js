#!/usr/bin/env node
'use strict'

// ===========================================================================
// check-oidc-subject-doc.js -- SECURITY.md's documented OIDC subject vs the
// workflow that actually requests the token.
//
// SECURITY.md documents the exact GitHub OIDC subject
// (`repo:OWNER@OWNERID/REPO@REPOID:environment:ENVNAME`) that the Marketplace
// publish job's token carries, so an operator configuring the Microsoft Entra
// federated credential knows what to match it against. Nothing re-checks that
// claim: renaming the `environment:` the publish job runs behind, or this
// repository's declared owner/repo, would silently leave the documented
// subject wrong -- readable as a correct recipe for a credential that no
// longer matches any token this repository's workflows can mint.
//
// This does NOT call Entra or GitHub's API to read the live federated
// credential -- this workflow holds no credential for that call, and inventing
// one would be a second unverified declaration standing in for the first. It
// checks the two things this repository can assert about itself without any
// network call: the `environment:` name the token-requesting job actually
// declares (.github/workflows/release.yml), and the owner/repo this extension
// declares as its own (azure-devops-extension.json's `repository.uri`).
//
// A repository that predates GitHub's 2026-07-15 immutable-subject cutover
// presents the plain `repo:OWNER/REPO:environment:ENVNAME` form instead (see
// SECURITY.md) and is not what this checker's regex matches -- that shape,
// carried by the siblings named there, is out of scope; it is skipped, not
// failed, so this repository will not warn about a shape it does not use.
//
// Usage:  node scripts/check-oidc-subject-doc.js [repoRoot]
// Exit 0 = the doc's subject and the workflow/manifest agree, or SECURITY.md
//          carries no new-format subject block to check.
// Exit 1 = a divergence.
// ===========================================================================

const fs = require('node:fs')
const path = require('node:path')

/** Job blocks (name -> body text) under a top-level `jobs:` key. Job names are
 *  the 2-space-indented keys directly under it; a job's body is everything
 *  indented further, up to the next such key or end of file. */
function extractJobBlocks(workflowText) {
  const lines = workflowText.split('\n')
  const jobsIdx = lines.findIndex((l) => /^jobs:\s*$/.test(l))
  if (jobsIdx === -1) return {}

  const blocks = {}
  let name = null
  let body = []
  for (let i = jobsIdx + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/)
    if (m) {
      if (name) blocks[name] = body.join('\n')
      name = m[1]
      body = []
    } else if (name) {
      body.push(lines[i])
    }
  }
  if (name) blocks[name] = body.join('\n')
  return blocks
}

/** The job(s) whose token actually carries an `environment:` claim: it must
 *  declare BOTH `environment:` and `permissions: id-token: write` -- either
 *  alone does not mint an environment-scoped OIDC token. */
function findOidcEnvironmentJobs(workflowText) {
  const blocks = extractJobBlocks(workflowText)
  const found = []
  for (const [job, body] of Object.entries(blocks)) {
    const envMatch = body.match(/^\s*environment:\s*([A-Za-z0-9_.-]+)\s*$/m)
    const hasIdToken = /^\s*id-token:\s*write\b/m.test(body)
    if (envMatch && hasIdToken) found.push({ job, environment: envMatch[1] })
  }
  return found
}

/** The new-format subject SECURITY.md documents, or null if it doesn't carry
 *  one (e.g. a repository still on the legacy plain-form subject). */
function extractDocSubject(securityMdText) {
  const m = securityMdText.match(/repo:([A-Za-z0-9_.-]+)@\d+\/([A-Za-z0-9_.-]+)@\d+:environment:([A-Za-z0-9_.-]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2], environment: m[3] }
}

/** This repository's own declared owner/repo, from the extension manifest it
 *  ships -- not a live GitHub API call. */
function extractManifestOwnerRepo(azureExtensionText) {
  let manifest
  try {
    manifest = JSON.parse(azureExtensionText)
  } catch {
    return null
  }
  const uri = manifest && manifest.repository && manifest.repository.uri
  if (typeof uri !== 'string') return null
  const m = uri.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)\/?$/)
  return m ? { owner: m[1], repo: m[2] } : null
}

function run(root) {
  const errors = []
  const notes = []

  const securityMdPath = path.join(root, 'SECURITY.md')
  const releaseYmlPath = path.join(root, '.github', 'workflows', 'release.yml')
  const manifestPath = path.join(root, 'azure-devops-extension.json')

  if (!fs.existsSync(securityMdPath)) {
    console.log('check-oidc-subject-doc: no SECURITY.md -- nothing to check.')
    return true
  }
  const securityMd = fs.readFileSync(securityMdPath, 'utf8')
  const docSubject = extractDocSubject(securityMd)

  if (!docSubject) {
    console.log('check-oidc-subject-doc: SECURITY.md documents no new-format OIDC subject -- nothing to check.')
    return true
  }

  if (!fs.existsSync(releaseYmlPath)) {
    errors.push(`SECURITY.md documents an OIDC subject (environment '${docSubject.environment}') but .github/workflows/release.yml does not exist.`)
  } else {
    const releaseYml = fs.readFileSync(releaseYmlPath, 'utf8')
    const jobs = findOidcEnvironmentJobs(releaseYml)
    if (jobs.length === 0) {
      errors.push(
        `SECURITY.md documents an OIDC subject for environment '${docSubject.environment}', but no job in ` +
          'release.yml declares both `environment:` and `permissions: id-token: write` -- no token this workflow ' +
          'can mint would carry that environment claim.',
      )
    } else if (!jobs.some((j) => j.environment === docSubject.environment)) {
      errors.push(
        `SECURITY.md's documented OIDC subject names environment '${docSubject.environment}', but release.yml's ` +
          `OIDC-token job(s) declare ${jobs.map((j) => `'${j.environment}' (job ${j.job})`).join(', ')} -- update ` +
          'whichever one is stale.',
      )
    } else {
      notes.push(`environment '${docSubject.environment}' matches job ${jobs.find((j) => j.environment === docSubject.environment).job} in release.yml.`)
    }
  }

  if (!fs.existsSync(manifestPath)) {
    errors.push(`SECURITY.md documents an OIDC subject for owner/repo '${docSubject.owner}/${docSubject.repo}', but azure-devops-extension.json does not exist.`)
  } else {
    const ownerRepo = extractManifestOwnerRepo(fs.readFileSync(manifestPath, 'utf8'))
    if (!ownerRepo) {
      errors.push('azure-devops-extension.json has no readable `repository.uri` to compare the documented OIDC subject against.')
    } else if (ownerRepo.owner !== docSubject.owner || ownerRepo.repo !== docSubject.repo) {
      errors.push(
        `SECURITY.md's documented OIDC subject names owner/repo '${docSubject.owner}/${docSubject.repo}', but ` +
          `azure-devops-extension.json's repository.uri names '${ownerRepo.owner}/${ownerRepo.repo}' -- a rename or ` +
          'transfer moved one without the other.',
      )
    } else {
      notes.push(`owner/repo '${docSubject.owner}/${docSubject.repo}' matches azure-devops-extension.json's repository.uri.`)
    }
  }

  for (const note of notes) console.log(`  note: ${note}`)

  if (errors.length > 0) {
    console.error('check-oidc-subject-doc FAILED:')
    for (const e of errors) console.error(`  - ${e}`)
    return false
  }
  console.log('OK: SECURITY.md\'s documented OIDC subject agrees with release.yml and azure-devops-extension.json.')
  return true
}

module.exports = { extractJobBlocks, findOidcEnvironmentJobs, extractDocSubject, extractManifestOwnerRepo, run }

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
  process.exit(run(root) ? 0 : 1)
}
