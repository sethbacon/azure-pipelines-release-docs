#!/usr/bin/env node
'use strict'

// CI gate: does the "Dependency audit" job audit anything?
//
// It did not. `npm audit --omit=dev` evaluated an empty tree, because
// package.json declares NO `dependencies` at all and every package in
// package-lock.json is marked dev — so a required, merge-blocking status check
// reported green having inspected zero packages, indistinguishable from one that
// inspected a real tree and found it clean (#20). What `--omit=dev` excluded is
// not incidental: it is precisely the toolchain that builds and packages the
// published artifact, tfx-cli included.
//
// Dropping the flag fixes today. This script is what stops it coming back, and
// what makes the job's own emptiness impossible to miss:
//
//   1. The lockfile is measured — dev vs non-dev — and the numbers are printed.
//   2. Every `npm audit` invocation in .github/workflows/ is read, its --omit
//      flags applied to those numbers, and an invocation whose covered set is
//      EMPTY fails the gate naming the flag that emptied it.
//   3. A workflow set containing NO `npm audit` at all fails: a scope check with
//      nothing in scope is the same defect one level up.
//   4. A per-task audit must exist. Under this repo's independent-package,
//      no-workspace model the root lockfile resolves only the root's own build
//      tooling; the root job structurally cannot see a task's dependencies, and
//      `for-each-task.js audit` is the only thing that ever will (#54).
//
// Read as text, not parsed as YAML: this repo has no YAML dependency and a gate
// that needs one is a gate that cannot run before `npm ci`. Whole-line comments
// are stripped so prose about `npm audit` is not mistaken for an invocation.
//
// Mutation-proved by scripts/test-gates.js.

const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const errors = []

// ── The tree that would be audited ───────────────────────────────────────────

const lockPath = path.join(root, 'package-lock.json')
let dev = 0
let prod = 0
try {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  for (const [name, entry] of Object.entries(lock.packages || {})) {
    if (name === '') continue // the root project itself
    if (entry.dev) dev += 1
    else prod += 1
  }
} catch (err) {
  errors.push(`package-lock.json: not readable as JSON — ${err.message}`)
}
const total = dev + prod

if (total === 0 && errors.length === 0) {
  errors.push(
    'package-lock.json resolves 0 packages — every `npm audit` below would report "found 0 vulnerabilities" over an ' +
      'empty tree. That sentence is what this gate exists to stop being printed',
  )
}

// ── Every audit invocation in the workflows ──────────────────────────────────

const workflowsDir = path.join(root, '.github', 'workflows')
const workflows = fs.existsSync(workflowsDir)
  ? fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort()
  : []

if (workflows.length === 0) {
  errors.push('.github/workflows/: no workflow files — there is no audit job to check')
}

const invocations = []
let perTaskAudit = null

for (const file of workflows) {
  const rel = `.github/workflows/${file}`
  const lines = fs.readFileSync(path.join(workflowsDir, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    if (/^\s*#/.test(line)) return // prose, not a command
    const where = `${rel}:${index + 1}`
    if (/\bnpm\s+audit\b/.test(line)) invocations.push({ where, line: line.trim() })
    if (/npm\s+run\s+audit:all\b/.test(line) || /for-each-task\.js\s+audit\b/.test(line)) {
      perTaskAudit = perTaskAudit || where
    }
  })
}

if (invocations.length === 0) {
  errors.push(
    'no `npm audit` invocation in any workflow — "Dependency audit" is a required status check on main, and a ' +
      'required check that runs no audit is a green context asserting nothing',
  )
}

for (const { where, line } of invocations) {
  const omitted = [...line.matchAll(/--omit[= ]([a-z]+)/g)].map((m) => m[1])
  // Only `dev` can be counted from the lockfile's own flags; `optional`/`peer`
  // are reported rather than silently treated as harmless.
  const covered = omitted.includes('dev') ? prod : total
  if (covered === 0) {
    errors.push(
      `${where}: \`${line}\` would inspect 0 of ${total} package(s) — ` +
        `${omitted.includes('dev') ? `--omit=dev excludes all ${dev} dev package(s), and there are ${prod} non-dev` : 'the lockfile is empty'}. ` +
        'This is a required status check; drop the flag so it audits the build toolchain that produces the .vsix',
    )
  }
  const unaccounted = omitted.filter((group) => group !== 'dev')
  if (unaccounted.length > 0) {
    console.log(`  note: ${where} also omits ${unaccounted.join(', ')} — not counted here, state the reason in the workflow`)
  }
}

// ── The per-task audit must exist before the tasks do ────────────────────────

let actions = []
try {
  const source = fs.readFileSync(path.join(root, 'scripts', 'for-each-task.js'), 'utf8')
  const block = source.slice(source.indexOf('const ACTIONS = {'), source.indexOf('function npm('))
  actions = [...block.matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1])
} catch (err) {
  errors.push(`scripts/for-each-task.js: not readable — ${err.message}`)
}
if (actions.length > 0 && !actions.includes('audit')) {
  errors.push(
    `scripts/for-each-task.js: ACTIONS defines ${actions.join(', ')} but no 'audit' — under the no-workspace model ` +
      "the root lockfile never resolves a task's dependencies, so nothing would ever audit them (#54)",
  )
}
if (!perTaskAudit) {
  errors.push(
    'no workflow runs the per-task audit (`npm run audit:all`) — the root job audits the root lockfile only, which ' +
      "structurally cannot see a task's dependency tree (#54)",
  )
}

// ── Report ───────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error('Audit scope check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(
  `Audit scope check passed — root lockfile resolves ${total} package(s) (${dev} dev, ${prod} non-dev); ` +
    `${invocations.length} \`npm audit\` invocation(s) across ${workflows.length} workflow(s), each covering a ` +
    `non-empty set; per-task audit wired at ${perTaskAudit}.`,
)
