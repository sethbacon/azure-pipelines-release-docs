#!/usr/bin/env node
// SHARED-WORKFLOW EGRESS-POLICY DRIFT GUARD (#23).
//
// Defect this closes
// -------------------
//   release-please.yml and signature-replay.yml both delegate their
//   credential-bearing job (release-please / replay) to a reusable workflow
//   defined in 4cloudguru/shared-workflows, pinned by commit SHA. Six places in
//   THIS repo's own comments and SECURITY.md asserted, as an already-true
//   property, that both jobs run `egress-policy: block` with an explicit
//   endpoint allowlist. The actual pinned commit runs `egress-policy: audit`
//   with no allowlist at all -- a real (if reasoned: "first run, no baseline
//   yet") hardening gap, made worse by five files confidently telling a
//   reviewer not to look here.
//
// What this script enforces
// --------------------------
//   For each entry below, fetch the reusable workflow's actual source AT THE
//   EXACT PINNED SHA this repo's own `uses:` line names, and compare its
//   REAL egress-policy for the named job against the EXPECTED value declared
//   here. A mismatch fails: either the shared workflow's owner flipped audit
//   <-> block and every doc/comment in this repo describing it is now the one
//   that's stale, or the expectation below needs updating to match a
//   deliberate, reviewed change. Either way, this makes the claim self-
//   checking instead of five hand-written assertions that can silently drift
//   from what the pinned code actually does.
//
// Network: this reads a PUBLIC repository (4cloudguru/shared-workflows) over
// HTTPS from raw.githubusercontent.com -- no token, no distributed secret.
//
//     node scripts/check-shared-workflow-egress.js
//
// Exit 0 = every expectation matches the pinned commit's real policy.
// Exit 1 = a mismatch, or the pin/policy line could not be found at all
//          (fails closed rather than silently skipping the check).

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || process.cwd());

// name -> { callerFile, jobName, expectedPolicy }
// jobName is the reusable workflow's OWN top-level job key (not the caller's
// alias for it), since that is what the egress-policy line sits under.
const EXPECTATIONS = [
    {
        label: 'release-please',
        callerFile: '.github/workflows/release-please.yml',
        workflowPath: '.github/workflows/release-please.yml',
        jobName: 'release-please',
        expectedPolicy: 'audit',
    },
    {
        label: 'signature-replay (replay)',
        callerFile: '.github/workflows/signature-replay.yml',
        workflowPath: '.github/workflows/signature-replay.yml',
        jobName: 'replay',
        expectedPolicy: 'audit',
    },
];

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'check-shared-workflow-egress' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
                res.resume();
                return;
            }
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
}

/** Extracts `owner/repo/path@sha` from this repo's own caller workflow. */
function findPin(callerFile) {
    const source = fs.readFileSync(path.join(ROOT, callerFile), 'utf8');
    const m = source.match(/uses:\s*(4cloudguru\/shared-workflows)\/([^@\s]+)@([0-9a-f]{40})/);
    if (!m) return null;
    return { repo: m[1], workflowPath: m[2], sha: m[3] };
}

/**
 * Reads the `egress-policy:` value for the named job in a reusable workflow's
 * source, scoped to that job's own step list (a file can have jobs with
 * different policies; a match anywhere in the file would attribute the wrong
 * one).
 */
function egressPolicyForJob(source, jobName) {
    const jobsIndex = source.indexOf('\njobs:');
    if (jobsIndex < 0) return null;
    const jobRe = new RegExp(`\\n  ${jobName}:\\n`);
    const jobMatch = jobRe.exec(source.slice(jobsIndex));
    if (!jobMatch) return null;
    const jobStart = jobsIndex + jobMatch.index + jobMatch[0].length;
    // The next line at the SAME two-space indent (another top-level job key)
    // ends this job's block; end of file ends it otherwise.
    const nextJob = source.slice(jobStart).match(/\n {2}\S[^\n]*:\n/);
    const jobEnd = nextJob ? jobStart + nextJob.index : source.length;
    const jobText = source.slice(jobStart, jobEnd);
    const policy = jobText.match(/egress-policy:\s*(\w+)/);
    return policy ? policy[1] : null;
}

async function main() {
    const failures = [];
    for (const exp of EXPECTATIONS) {
        const pin = findPin(exp.callerFile);
        if (!pin) {
            failures.push(`${exp.label}: could not find a 4cloudguru/shared-workflows SHA pin in ${exp.callerFile}`);
            continue;
        }
        const url = `https://raw.githubusercontent.com/${pin.repo}/${pin.sha}/${pin.workflowPath}`;
        let source;
        try {
            source = await fetch(url);
        } catch (err) {
            failures.push(`${exp.label}: could not fetch ${url}: ${err.message}`);
            continue;
        }
        const actual = egressPolicyForJob(source, exp.jobName);
        if (!actual) {
            failures.push(`${exp.label}: could not find an egress-policy line for job '${exp.jobName}' at ${pin.sha} -- the reusable workflow's shape changed; update this script's job-scoping, don't skip the check.`);
            continue;
        }
        if (actual !== exp.expectedPolicy) {
            failures.push(
                `${exp.label}: pinned commit ${pin.sha} runs egress-policy '${actual}', but this repo's own docs/comments say '${exp.expectedPolicy}'. ` +
                `Either the shared workflow's owner changed it (update every comment describing it, and this script's expectedPolicy) or this expectation is stale.`,
            );
            continue;
        }
        console.log(`OK: ${exp.label} @ ${pin.sha} runs egress-policy: ${actual}, matching what this repo documents.`);
    }

    if (failures.length > 0) {
        console.error(`FAIL: ${failures.length} shared-workflow egress-policy claim(s) do not match the pinned commit's real code.`);
        for (const f of failures) console.error(`  ${f}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(`FAIL: ${err.stack || err}`);
    process.exit(1);
});
