#!/usr/bin/env node
'use strict'

// Self-test for check-oidc-subject-doc.js. Builds small in-memory fixtures
// (this checker's inputs are plain text/JSON, so no throwaway git repo or
// directory tree is needed) and calls the exported `run()` against a
// throwaway directory written from them, asserting it passes on agreement and
// fails -- naming the actual drift -- on each of the ways the doc and the
// workflow/manifest can fall out of sync.

const fs = require('fs')
const os = require('os')
const path = require('path')
const checker = require('./check-oidc-subject-doc.js')

let failures = 0
const report = (ok, msg) => {
  if (ok) console.log(`  OK   ${msg}`)
  else {
    console.error(`  FAIL ${msg}`)
    failures += 1
  }
}

const SECURITY_MD = (env) => `# Security Policy

## Supply chain controls

\`\`\`
repo:sethbacon@14307877/azure-pipelines-release-docs@1331298995:environment:${env}
\`\`\`
`

const RELEASE_YML = (job, env) => `name: Release
on:
  push:
    tags: ['v*']
jobs:
  ${job}:
    runs-on: ubuntu-latest
    environment: ${env}
    permissions:
      id-token: write
    steps:
      - run: echo publish
`

const RELEASE_YML_NO_ID_TOKEN = (job, env) => `name: Release
on:
  push:
    tags: ['v*']
jobs:
  ${job}:
    runs-on: ubuntu-latest
    environment: ${env}
    permissions:
      contents: read
    steps:
      - run: echo publish
`

const MANIFEST = (owner, repo) => JSON.stringify({ repository: { uri: `https://github.com/${owner}/${repo}` } }, null, 2)

function fixture({ securityMd, releaseYml, manifest }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oidc-subject-doc-selftest-'))
  fs.writeFileSync(path.join(root, 'SECURITY.md'), securityMd)
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
  if (releaseYml !== null) fs.writeFileSync(path.join(root, '.github', 'workflows', 'release.yml'), releaseYml)
  fs.writeFileSync(path.join(root, 'azure-devops-extension.json'), manifest)
  return root
}

function runQuiet(root) {
  const originalLog = console.log
  const originalError = console.error
  const lines = []
  console.log = (m) => lines.push(String(m))
  console.error = (m) => lines.push(String(m))
  let ok
  try {
    ok = checker.run(root)
  } finally {
    console.log = originalLog
    console.error = originalError
  }
  return { ok, output: lines.join('\n') }
}

// --- 1. Agreement passes -----------------------------------------------
{
  const root = fixture({
    securityMd: SECURITY_MD('marketplace'),
    releaseYml: RELEASE_YML('publish-marketplace', 'marketplace'),
    manifest: MANIFEST('sethbacon', 'azure-pipelines-release-docs'),
  })
  const { ok, output } = runQuiet(root)
  report(ok === true, `agreement passes: ${output.split('\n').pop()}`)
}

// --- 2. Environment renamed in the workflow but not in the doc: caught --
{
  const root = fixture({
    securityMd: SECURITY_MD('marketplace'),
    releaseYml: RELEASE_YML('publish-marketplace', 'marketplace-prod'),
    manifest: MANIFEST('sethbacon', 'azure-pipelines-release-docs'),
  })
  const { ok, output } = runQuiet(root)
  report(ok === false, 'environment rename in the workflow is caught')
  report(/marketplace-prod/.test(output), `failure names the actual workflow environment: ${output}`)
}

// --- 3. No job carries BOTH environment: and id-token: write: caught ----
{
  const root = fixture({
    securityMd: SECURITY_MD('marketplace'),
    releaseYml: RELEASE_YML_NO_ID_TOKEN('publish-marketplace', 'marketplace'),
    manifest: MANIFEST('sethbacon', 'azure-pipelines-release-docs'),
  })
  const { ok, output } = runQuiet(root)
  report(ok === false, 'a job with environment: but no id-token: write is not accepted as a match')
  report(/no job in release\.yml/.test(output), `failure explains no OIDC-environment job exists: ${output}`)
}

// --- 4. Owner/repo drift between the doc and the manifest: caught -------
{
  const root = fixture({
    securityMd: SECURITY_MD('marketplace'),
    releaseYml: RELEASE_YML('publish-marketplace', 'marketplace'),
    manifest: MANIFEST('sethbacon', 'renamed-repo'),
  })
  const { ok, output } = runQuiet(root)
  report(ok === false, 'owner/repo drift between SECURITY.md and the manifest is caught')
  report(/renamed-repo/.test(output), `failure names the manifest's actual repo: ${output}`)
}

// --- 5. Legacy plain-form subject (no owner/repo id suffixes): skipped --
// Negative control for the extractDocSubject regex's scoping: it must not
// match the legacy `repo:OWNER/REPO:environment:X` shape (no `@ID` on either
// side), the form the pre-cutover sibling repositories use, and must not
// mistake a workflow/manifest MISMATCH for one of THOSE as a failure -- the
// check has nothing to compare because it found no new-format subject at all.
{
  const root = fixture({
    securityMd: '```\nrepo:sethbacon/azure-pipelines-release-docs:environment:marketplace\n```\n',
    releaseYml: RELEASE_YML('publish-marketplace', 'totally-different-environment'),
    manifest: MANIFEST('someone-else', 'a-different-repo'),
  })
  const { ok, output } = runQuiet(root)
  report(ok === true, `legacy plain-form subject is skipped, not falsely matched or failed: ${output}`)
}

// --- 6. No SECURITY.md at all: skipped, not failed ----------------------
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oidc-subject-doc-selftest-nofile-'))
  const { ok } = runQuiet(root)
  report(ok === true, 'a repository with no SECURITY.md is skipped, not failed')
}

// --- Unit coverage on the pure extractors, independent of run()'s wiring --
{
  const jobs = checker.findOidcEnvironmentJobs(RELEASE_YML('publish-marketplace', 'marketplace'))
  report(
    jobs.length === 1 && jobs[0].job === 'publish-marketplace' && jobs[0].environment === 'marketplace',
    `findOidcEnvironmentJobs finds the one job carrying both environment: and id-token: write: ${JSON.stringify(jobs)}`,
  )
}
{
  const jobs = checker.findOidcEnvironmentJobs(RELEASE_YML_NO_ID_TOKEN('publish-marketplace', 'marketplace'))
  report(jobs.length === 0, `findOidcEnvironmentJobs requires id-token: write, not environment: alone: ${JSON.stringify(jobs)}`)
}
{
  const subject = checker.extractDocSubject(SECURITY_MD('marketplace'))
  report(
    !!subject && subject.owner === 'sethbacon' && subject.repo === 'azure-pipelines-release-docs' && subject.environment === 'marketplace',
    `extractDocSubject parses the new-format subject: ${JSON.stringify(subject)}`,
  )
}
{
  const subject = checker.extractDocSubject('repo:sethbacon/azure-pipelines-release-docs:environment:marketplace')
  report(subject === null, `extractDocSubject does not match the legacy plain-form subject: ${JSON.stringify(subject)}`)
}

console.log(failures === 0 ? `OK: all check-oidc-subject-doc.js self-test cases passed.` : `FAILED: ${failures} check-oidc-subject-doc.js self-test case(s).`)
process.exit(failures === 0 ? 0 : 1)
