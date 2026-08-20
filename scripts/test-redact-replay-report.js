#!/usr/bin/env node
'use strict'

// Mutation self-test for scripts/redact-replay-report.js.
//
// Same contract as every other gate in this repository, and it matters more
// here than usual: a redactor that has quietly stopped redacting produces
// output that looks exactly like a correctly redacted one until someone reads
// it — by which point it has already been published from a public repository.
//
// So every case below plants a CANARY site string in the input and asserts it
// is absent from both outputs, rather than asserting an exit code. The first
// case also asserts the canary was present in the input, so a test that stopped
// planting it cannot pass vacuously.
//
// Cases:
//   clean            a report in the shape replay.py writes today
//   nested           the same sites one level deeper — the redactor walks, it
//                    does not index, so a layout change must not un-redact
//   log-lines        REGRESSED/UNADDRESSED lines dropped from the human render
//   empty-residual   a report with zero per-issue records is refused (#24)
//   no-residual      a report this redactor cannot recognise is refused
//   missing-json     --json absent after exit 0/1 is refused
//   gate-error       exit 2 writes no report; that is a pass, with a note

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const REDACT = path.join(__dirname, 'redact-replay-report.js')
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-docs-redact-'))

const CANARY = 'azure-pipelines-packer:Tasks/PackerTask/PackerTaskV1/src/secret.ts:42'
const CANARY_TWO = 'terraform-registry-backend:internal/auth/jwt.go:118'

let failures = 0
const report = (ok, message) => {
  if (ok) console.log(`  OK   ${message}`)
  else {
    console.error(`  FAIL ${message}`)
    failures += 1
  }
}

function reportJson() {
  return {
    exit: 1,
    residual: [
      {
        issue: 393,
        signature_id: 'premask-emission',
        ran_in: ['azure-pipelines-packer', 'azure-pipelines-terraform'],
        skipped: [['terraform-registry-backend', "kind 'go-service' is outside this signature's applicability"]],
        matched: [CANARY, 'azure-pipelines-terraform:Tasks/X/src/y.ts:7'],
        regressed: [CANARY],
        unaddressed: [],
        caveats: ['the analyser could not resolve one import'],
        residual: [CANARY],
        failed: true,
      },
      {
        issue: 401,
        signature_id: 'output-boundary',
        ran_in: ['terraform-registry-backend'],
        skipped: [],
        matched: [CANARY_TWO],
        regressed: [],
        unaddressed: [CANARY_TWO],
        caveats: [],
        residual: [CANARY_TWO],
        failed: true,
      },
    ],
    pins: [{ issue: 12, module: '@4cloudguru/pipeline-task-core', fixed_in: '0.7.1', findings: [], checked: ['azure-pipelines-packer'], failed: false }],
  }
}

function renderText() {
  return [
    '='.repeat(78),
    'SIGNATURE REPLAY',
    '='.repeat(78),
    '',
    'CHECK 1 -- residual',
    '-'.repeat(78),
    '[FAIL] #393 premasked secrets reach the log',
    '       signature premask-emission ran in azure-pipelines-packer | matched 2 site(s)',
    `       REGRESSED  ${CANARY}  (recorded as fixed, still matches)`,
    `       UNADDRESSED ${CANARY_TWO}`,
    '       note: the analyser could not resolve one import',
    '',
    'CHECK 2 -- consumer pin freshness',
    '-'.repeat(78),
    '[ok] #12 @4cloudguru/pipeline-task-core fixed in 0.7.1 | checked azure-pipelines-packer',
    '',
  ].join('\n')
}

/**
 * Runs the redactor over one fixture. `json` may be an object, or null to
 * write no --json file at all.
 */
function run(label, { json, text, status = 1 }) {
  const dir = path.join(workRoot, label)
  fs.mkdirSync(dir, { recursive: true })
  const inJson = path.join(dir, 'raw.json')
  const inText = path.join(dir, 'raw.txt')
  const outJson = path.join(dir, 'public.json')
  const outText = path.join(dir, 'public.txt')
  if (json !== null) fs.writeFileSync(inJson, JSON.stringify(json, null, 2))
  if (text !== null) fs.writeFileSync(inText, text)
  const result = spawnSync(
    process.execPath,
    [REDACT, '--in-text', inText, '--in-json', inJson, '--out-text', outText, '--out-json', outJson, '--status', String(status)],
    { encoding: 'utf8' },
  )
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
    json: fs.existsSync(outJson) ? fs.readFileSync(outJson, 'utf8') : null,
    text: fs.existsSync(outText) ? fs.readFileSync(outText, 'utf8') : null,
  }
}

function expectRefusal(label, fixture, expected) {
  const r = run(label, fixture)
  if (r.status === 0) {
    report(false, `${label}: the redactor exited 0 and published\n${r.output}`)
    return
  }
  if (!r.output.includes(expected)) {
    report(false, `${label}: refused but never mentioned ${JSON.stringify(expected)}\n${r.output}`)
    return
  }
  if (r.json !== null || r.text !== null) {
    report(false, `${label}: refused but still wrote an output file`)
    return
  }
  report(true, `${label}: exits ${r.status} naming ${JSON.stringify(expected)} and writes nothing`)
}

try {
  // ── clean ────────────────────────────────────────────────────────────────
  {
    const json = reportJson()
    const text = renderText()
    // The test would pass vacuously if it stopped planting the canary.
    const planted = JSON.stringify(json).includes(CANARY) && text.includes(CANARY)
    report(planted, 'clean: the fixture actually contains the site string the redactor must remove')

    const r = run('clean', { json, text })
    if (r.status !== 0) {
      report(false, `clean: exited ${r.status} on a report it should redact\n${r.output}`)
    } else {
      report(!r.json.includes(CANARY) && !r.json.includes(CANARY_TWO), 'clean: no site string survives into the artifact')
      report(!r.text.includes(CANARY) && !r.text.includes(CANARY_TWO), 'clean: no site string survives into the log')
      const parsed = JSON.parse(r.json)
      const first = parsed.residual[0]
      report(first.matched_count === 2 && first.regressed_count === 1 && first.unaddressed_count === 0, 'clean: site lists become exact counts')
      report(
        Array.isArray(first.ran_in) && first.ran_in.length === 2 && first.skipped.length === 1 && first.caveats.length === 1,
        'clean: ran_in / skipped / caveats — the anti-blindness evidence — are kept in full',
      )
      report(parsed.pins.length === 1 && parsed.redacted === true, 'clean: check 2 and the redaction marker survive')
      report(r.text.includes('REDACTED for publication') && r.text.includes('replay.py'), 'clean: the log says what was withheld and how to reproduce it')
      report(r.text.includes('[FAIL] #393') && r.text.includes('matched 2 site(s)'), 'clean: the per-issue verdict lines are kept')
      // The footer is the evidence a reader sees, so its arithmetic is asserted
      // rather than assumed: it once said "0 site(s) across 0 list(s)" on a run
      // that had just redacted 243 across 84, because it was composed before
      // the walk that counts them.
      report(
        r.text.includes('2 site line(s) removed from this log and 7 site(s) across 8 list(s) reduced to counts'),
        'clean: the footer counts what was actually removed, not zero',
      )
    }
  }

  // ── the top-level record array must survive its own name ────────────────
  // `residual` names both a site list (inside a record) and the array OF
  // records. Collapsing the second to a count publishes an artifact that
  // proves nothing; the first run of this test caught exactly that.
  {
    const r = run('record-array', { json: reportJson(), text: renderText() })
    const parsed = r.status === 0 ? JSON.parse(r.json) : null
    report(
      parsed !== null && Array.isArray(parsed.residual) && parsed.residual.length === 2 && parsed.residual_count === undefined,
      'record-array: the top-level array of per-issue records is not mistaken for a site list',
    )
  }

  // ── nested: the shape moved, the redactor must still walk to it ──────────
  {
    const json = { exit: 1, residual: [{ issue: 1, signature_id: 's', detail: { deeper: { regressed: [CANARY] } } }], pins: [] }
    const r = run('nested', { json, text: renderText() })
    if (r.status !== 0) report(false, `nested: exited ${r.status}\n${r.output}`)
    else report(!r.json.includes(CANARY), 'nested: a site list two levels below the documented shape is still redacted')
  }

  // ── log-lines ────────────────────────────────────────────────────────────
  {
    const r = run('log-lines', { json: reportJson(), text: renderText() })
    report(r.status === 0 && !/^\s*(REGRESSED|UNADDRESSED)\b/m.test(r.text), 'log-lines: REGRESSED/UNADDRESSED lines are dropped from the human render')
  }

  // ── refusals ─────────────────────────────────────────────────────────────
  expectRefusal('empty-residual', { json: { exit: 0, residual: [], pins: [] }, text: renderText(), status: 0 }, 'examined nothing')
  expectRefusal('no-residual', { json: { exit: 0, findings: [] }, text: renderText(), status: 0 }, 'no `residual` array')
  expectRefusal('missing-json', { json: null, text: renderText(), status: 1 }, 'absent after a replay that exited 1')
  expectRefusal('missing-text', { json: reportJson(), text: null, status: 1 }, 'there is no report to redact')

  // ── gate error: exit 2 legitimately produces no report ───────────────────
  {
    const r = run('gate-error', { json: null, text: null, status: 2 })
    if (r.status !== 0) report(false, `gate-error: exited ${r.status} on a replay that failed before writing a report\n${r.output}`)
    else report(JSON.parse(r.json).exit === 2, 'gate-error: exit 2 publishes a marker rather than a fabricated clean report')
  }
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\ntest-redact-replay-report: ${failures} case(s) failed.`)
  process.exit(1)
}
console.log('\ntest-redact-replay-report: no planted site string survived redaction, and every unredactable report was refused.')
