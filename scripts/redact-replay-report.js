#!/usr/bin/env node
'use strict'

// ===========================================================================
// The signature replay's output, made publishable from a PUBLIC repository.
//
// THE PROBLEM (#24). `replay.py` produces a per-issue map of the estate's
// KNOWN-DEFECTIVE, NOT-YET-FIXED sites — `regressed` (a recorded fix that
// stopped holding) and `unaddressed` (a sibling instance nobody has filed) —
// across fifteen repositories, derived from a ledger that lives in the private
// security-orchestration repo. This repository is public, so a workflow-run
// artifact of that map is downloadable by anyone.
//
// AND THE HALF THE FINDING MISSED. #24 recommends reading the findings "from
// the step's own log output" instead. On a public repository the step log is
// public too, and `replay.py`'s human render prints every `REGRESSED <site>`
// and `UNADDRESSED <site>` line to stdout. Dropping the artifact and keeping
// the log would have moved the same data from one world-readable surface to
// another. So BOTH are redacted here, by the same rules, or neither is.
//
// WHAT IS KEPT, AND WHY IT IS NOT "JUST DELETE THE ARTIFACT". The report is
// what makes a required, merge-blocking check auditable: a green `replay` is
// worth nothing until you can see WHICH signatures ran, in WHICH repos, and
// what they SKIPPED — a signature that enumerated nothing exits clean and looks
// exactly like one that enumerated everything and found nothing. That evidence
// (`signature_id`, `ran_in`, `skipped`, `caveats`, per-set COUNTS, `failed`,
// `exit`) is not sensitive and is preserved in full. What is dropped is the
// site-level lists — the part that is a prioritised to-do list for an attacker
// and useless to a reviewer who can reproduce it locally in one command.
//
// This also rules out "upload only on failure": the run whose report matters
// most for the blind-versus-clean question is the GREEN one, and the run whose
// report is most sensitive is the failing one. Failure-only inverts both.
// And "restrict who can download it" is not an option that exists: Actions
// artifacts inherit repository read access and there is no per-artifact ACL.
//
// Usage:
//   node scripts/redact-replay-report.js \
//     --in-text <raw stdout> --in-json <raw --json report> \
//     --out-text <redacted> --out-json <redacted> --status <replay exit code>
//
// Exit 0 = redacted outputs written. Exit 1 = the report could not be redacted
// safely, which fails the replay job rather than publishing an unredacted one.
//
// Mutation-proved by scripts/test-redact-replay-report.js, which runs in the
// same job immediately before the replay.
// ===========================================================================

const fs = require('node:fs')

// Keys whose values are site identifiers — `<repo>:<path>:<line>` and friends.
//
// `residual` is in this set AND is the name of the report's top-level array of
// per-issue records. The two are told apart by their contents, not their name:
// a site list is a list of STRINGS, a record list is a list of objects. Getting
// that wrong collapses the whole report to `residual_count: 2` and publishes an
// artifact that proves nothing — which is what the first run of the self-test
// caught, and why scripts/test-redact-replay-report.js asserts the record array
// survives.
const SITE_KEYS = new Set(['matched', 'regressed', 'unaddressed', 'residual', 'sites'])
const isSiteList = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string')

/** Lines of the human render that name individual sites. */
const SITE_LINE = /^\s*(REGRESSED|UNADDRESSED)\b/

const REPRODUCE = [
  'Site-level detail is withheld: this repository is PUBLIC, and both this log and this run\'s',
  'artifacts are readable by anyone (#24). The full report is reproducible by anyone who can',
  'read the private ledger:',
  '',
  '  python security-orchestration/remediation/replay/replay.py \\',
  '    --ledger security-orchestration/remediation/signatures/ledger.json \\',
  '    --repos-root suite --verify-linked-issues',
]

function argOf(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1]
}

const inText = argOf('in-text')
const inJson = argOf('in-json')
const outText = argOf('out-text')
const outJson = argOf('out-json')
const status = Number(argOf('status') ?? '0')

const errors = []
const die = (message) => errors.push(message)

if (!inText || !inJson || !outText || !outJson) {
  console.error('usage: redact-replay-report.js --in-text F --in-json F --out-text F --out-json F --status N')
  process.exit(2)
}

/* ------------------------------------------------------------------ *
 * The machine-readable report.
 * ------------------------------------------------------------------ */

/**
 * Replaces every site list anywhere in the structure with its cardinality,
 * whatever shape the report has. Written to walk rather than to index: this
 * script lives in a different repository from the dataclass it reads, so a
 * redactor that knew the exact layout would silently stop redacting the day
 * that layout moved — and silently-stopped-redacting is the one failure mode
 * that must not be possible here.
 */
let redactedLists = 0
let redactedSites = 0

function redact(value) {
  if (Array.isArray(value)) return value.map(redact)
  if (value === null || typeof value !== 'object') return value
  const out = {}
  for (const [key, inner] of Object.entries(value)) {
    if (SITE_KEYS.has(key) && isSiteList(inner)) {
      redactedLists += 1
      redactedSites += inner.length
      out[`${key}_count`] = inner.length
      continue
    }
    out[key] = redact(inner)
  }
  return out
}

let report = null
if (fs.existsSync(inJson)) {
  try {
    report = JSON.parse(fs.readFileSync(inJson, 'utf8'))
  } catch (err) {
    die(`${inJson}: not readable as JSON (${err.message}) — refusing to publish an un-redacted report`)
  }
} else if (status === 0 || status === 1) {
  // replay.py writes --json on both a clean run and a finding run; only a gate
  // error (exit 2) returns before writing one.
  die(`${inJson}: absent after a replay that exited ${status}. The report this job publishes cannot be produced, and an empty artifact would read as a clean run`)
}

if (report !== null) {
  const residual = Array.isArray(report.residual) ? report.residual : null
  if (residual === null) {
    die(`${inJson}: has no \`residual\` array — this redactor cannot confirm it is redacting a replay report, so it will not publish one`)
  } else if (residual.length === 0) {
    die(
      `${inJson}: \`residual\` is empty. A replay that produced zero per-issue records examined nothing, and an ` +
        'artifact saying so would be indistinguishable from a clean estate',
    )
  }
}

/* ------------------------------------------------------------------ *
 * The human render.
 * ------------------------------------------------------------------ */

let droppedLines = 0
let text = ''
if (fs.existsSync(inText)) {
  const lines = fs.readFileSync(inText, 'utf8').split('\n')
  const kept = []
  for (const line of lines) {
    if (SITE_LINE.test(line)) {
      droppedLines += 1
      continue
    }
    kept.push(line)
  }
  text = kept.join('\n')
} else if (status === 0 || status === 1) {
  die(`${inText}: absent after a replay that exited ${status} — there is no report to redact`)
}

/* ------------------------------------------------------------------ */

if (errors.length > 0) {
  console.error('redact-replay-report: refusing to publish.')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

const footer = [
  '',
  '-'.repeat(78),
  `REDACTED for publication: ${droppedLines} site line(s) removed from this log and ` +
    `${redactedSites} site(s) across ${redactedLists} list(s) reduced to counts in the artifact.`,
  ...REPRODUCE,
  '-'.repeat(78),
  '',
].join('\n')

fs.writeFileSync(outText, `${text}${footer}`, 'utf8')
fs.writeFileSync(
  outJson,
  `${JSON.stringify(
    report === null
      ? { exit: status, redacted: true, note: 'replay exited before producing a report; see the job log' }
      : { ...redact(report), redacted: true },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(
  `redact-replay-report: ${droppedLines} site line(s) dropped from the log, ${redactedSites} site(s) across ` +
    `${redactedLists} list(s) reduced to counts in the artifact.`,
)
