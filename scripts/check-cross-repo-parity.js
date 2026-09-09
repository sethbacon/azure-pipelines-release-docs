#!/usr/bin/env node
// CROSS-REPOSITORY SHARED-MODULE PARITY (azure-pipelines-terraform#1112 finding 1,
// deferred until this repository's first published release -- v1.0.2 shipped
// 2026-08-30, so the trigger is met).
//
// Defect class
// ------------
//   scripts/lib/shared-modules.js's PROVENANCE list already names every module
//   copied from another repository, because a cross-repo byte diff "cannot be
//   byte-compared here" (its own comment) -- the upstream tree is never checked
//   out in a normal pull-request build. What check-shared-modules.js CAN and
//   does check from inside this repo alone is the provenance HEADER: that a
//   copy still says where it came from. The BODY -- the actual sanitizer/guard
//   logic -- has had nothing checking it against the real upstream, so a fix
//   made to azure-pipelines-terraform's copy reached this repository's copy
//   only if someone remembered to apply it here too by hand.
//
// What this script enforces
// --------------------------
//   Given a checkout of the upstream repository a PROVENANCE entry's header
//   names, compares that entry's local file -- BELOW its own leading comment
//   block, which is this repository's bookkeeping and never part of the
//   shared logic -- against the upstream file, also below ITS leading comment
//   block (the upstream file is routinely also a canonical copy of an in-repo
//   FAMILIES group there and carries its own unrelated explanatory header). A
//   body that no longer matches byte-for-byte (line endings normalised) is
//   reported as a diverged copy, naming the file -- UNLESS the local header's
//   own `@shared-module-status` already reads DIVERGED, a structured
//   declaration that the maintainer has already recorded this copy as
//   legitimately differing (this repository's own check-shared-modules.js
//   verifies that header exists and is well-formed, never that IN-SYNC is
//   textually true, so this gate does not require byte identity of a copy
//   that never claimed it).
//
//   The upstream RELATIVE PATH is read from the local file's own header --
//   `@shared-module: copied from <repo> (<path>)`, the exact parenthetical
//   check-shared-modules.js's markersFor() requires -- rather than assumed to
//   equal the entry's own `dir`/`file`: a sibling extension's PROVENANCE list
//   proves those two are not always the same path (its own directory names
//   never match azure-pipelines-terraform's for the same module), so this
//   gate does not assume it here either, even though today's two entries
//   happen to agree.
//
//   This gate does not run standalone on every pull request: the upstream
//   checkout it needs is only ever brought in by the scheduled
//   `cross-repo-parity` job in weekly-security.yml. What DOES run on every pull
//   request is this file's self-test, scripts/test-check-cross-repo-parity.js,
//   from a synthetic fixture pair -- proving the comparison logic itself, since
//   there is no upstream checkout to run the real thing against in ci.yml.
//
// Usage: node scripts/check-cross-repo-parity.js <path-to-upstream-checkout> [--json]
// Exit 0 = every PROVENANCE copy matches its upstream body (or self-declares
// DIVERGED). Exit 1 = at least one undeclared divergence (or its local/
// upstream file is missing, or the header disagrees with the PROVENANCE
// entry on which repo it came from), or PROVENANCE is empty -- a check that
// would compare nothing must say so, not pass silently.

const fs = require('fs')
const path = require('path')

const { PROVENANCE } = require('./lib/shared-modules.js')

const JSON_OUTPUT = process.argv.includes('--json')
const upstreamArg = process.argv.slice(2).find((a) => a !== '--json')

if (!upstreamArg) {
    console.error('Usage: node scripts/check-cross-repo-parity.js <path-to-upstream-checkout> [--json]')
    process.exit(1)
}
const UPSTREAM_ROOT = path.resolve(upstreamArg)

// The exact shape check-shared-modules.js's markersFor() requires.
const PROVENANCE_HEADER = /@shared-module:\s*copied from\s+(\S+)\s*\(([^)]+)\)/
const STATUS_HEADER = /@shared-module-status:\s*(IN-SYNC|DIVERGED)\b/

function read(full) {
    if (!fs.existsSync(full)) return { ok: false, full }
    return { ok: true, full, content: fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n') }
}

// Strips a file's leading run of single-line `//` comments -- its OWN
// bookkeeping, whichever repository it sits in. Both real copies today put a
// JSDoc block (`/**`) immediately after their comment block, which is not a
// `//` line and so ends the strip.
function stripHeader(content) {
    const lines = content.split('\n')
    let i = 0
    while (i < lines.length && /^\s*\/\//.test(lines[i])) i++
    return lines.slice(i).join('\n')
}

if (!Array.isArray(PROVENANCE) || PROVENANCE.length === 0) {
    console.error('FAIL: scripts/lib/shared-modules.js declares no PROVENANCE entries, so this gate would pass without comparing anything.')
    process.exit(1)
}

const sites = []
for (const { dir, file, upstream } of PROVENANCE) {
    const rel = path.join(dir, file)
    const localFull = path.resolve(dir, file)
    const local = read(localFull)

    if (!local.ok) {
        sites.push({ file: rel, verdict: 'MISSING-LOCAL', detail: `local copy not found at ${localFull}` })
        continue
    }

    const headerMatch = PROVENANCE_HEADER.exec(local.content)
    const upstreamRepo = headerMatch ? headerMatch[1] : upstream
    const upstreamRel = headerMatch ? headerMatch[2].trim() : rel
    if (headerMatch && upstream && upstream !== upstreamRepo) {
        sites.push({
            file: rel,
            verdict: 'HEADER-MISMATCH',
            detail: `PROVENANCE lists upstream '${upstream}' but the file's own @shared-module header names '${upstreamRepo}'`,
        })
        continue
    }

    const statusMatch = STATUS_HEADER.exec(local.content)
    if (statusMatch && statusMatch[1] === 'DIVERGED') {
        sites.push({
            file: rel,
            verdict: 'SELF-DECLARED-DIVERGED',
            detail: 'header already declares @shared-module-status: DIVERGED -- byte parity not required',
        })
        continue
    }

    const upstreamFull = path.resolve(UPSTREAM_ROOT, upstreamRel)
    const remote = read(upstreamFull)
    if (!remote.ok) {
        sites.push({ file: rel, verdict: 'MISSING-UPSTREAM', detail: `${upstreamRepo} has no file at ${upstreamFull}` })
        continue
    }

    if (stripHeader(local.content) !== stripHeader(remote.content)) {
        sites.push({ file: rel, verdict: 'DIVERGED', detail: `body differs from ${upstreamRepo}:${upstreamRel}, and the header does not declare this copy DIVERGED` })
    } else {
        sites.push({ file: rel, verdict: 'IN-SYNC', detail: `matches ${upstreamRepo}:${upstreamRel}` })
    }
}

const failures = sites.filter((s) => s.verdict !== 'IN-SYNC' && s.verdict !== 'SELF-DECLARED-DIVERGED')

if (JSON_OUTPUT) {
    console.log(JSON.stringify({ sites, failures: failures.length }, null, 2))
    process.exit(failures.length ? 1 : 0)
}

for (const s of sites) {
    console.log(`${s.verdict === 'IN-SYNC' || s.verdict === 'SELF-DECLARED-DIVERGED' ? 'OK' : 'FAIL'}: ${s.file} [${s.verdict}] -- ${s.detail}`)
}
if (failures.length) {
    console.error(`\nFAIL: ${failures.length} cross-repository cop${failures.length === 1 ? 'y' : 'ies'} diverged from upstream without declaring it.`)
    console.error('      Apply the same fix to both copies, update this copy from the upstream body (keep the local header), or mark the header @shared-module-status: DIVERGED with a reason.')
    process.exit(1)
}
console.log(`\nOK: all ${sites.length} cross-repository cop${sites.length === 1 ? 'y' : 'ies'} match upstream body-for-body or self-declare DIVERGED.`)
