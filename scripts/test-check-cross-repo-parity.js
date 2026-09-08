#!/usr/bin/env node
'use strict'
// Self-test for check-cross-repo-parity.js.
//
// There is no upstream checkout to run the real gate against on a pull
// request -- that only exists inside the scheduled cross-repo-parity job in
// weekly-security.yml -- so what runs on every pull request is this file,
// proving the COMPARISON LOGIC itself against a synthetic fixture pair rather
// than the real script never being exercised at all until Monday.
//
// Every case builds a local fixture repo and a fixture "upstream" checkout as
// real directories, runs the real script over them as a SUBPROCESS, and
// asserts on the --json verdict.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const SCRIPT = path.join(__dirname, 'check-cross-repo-parity.js')

let failures = 0
const report = (ok, msg) => {
    if (ok) console.log(`  OK   ${msg}`)
    else { console.error(`  FAIL ${msg}`); failures += 1 }
}

const header = (status, extra) => [
    `// @shared-module: copied from ${extra?.upstreamName ?? 'fixture-upstream'} (${extra?.upstreamPath ?? 'Tasks/Fixture/FixtureV1/src/module.ts'})`,
    `// @shared-module-policy: ${extra?.policy ?? 'keep in sync'}`,
    `// @shared-module-status: ${status}`,
    '',
].join('\n')
const BODY = [
    '/**',
    ' * Fixture module body.',
    ' */',
    'export function guard(x) {',
    '    return x.length > 0',
    '}',
    '',
].join('\n')

/** A fixture repo tree carrying the real script + lib, one PROVENANCE entry, and a copy. */
function fixtureRepo(name, { localContent, entryDir, entryUpstream }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `cross-repo-parity-${name}-`))
    fs.mkdirSync(path.join(root, 'scripts', 'lib'), { recursive: true })
    fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'check-cross-repo-parity.js'))
    fs.writeFileSync(
        path.join(root, 'scripts', 'lib', 'shared-modules.js'),
        [
            `const MODULE_SRC = '${entryDir ?? 'Tasks/Fixture/FixtureV1/src'}'`,
            `const UPSTREAM = '${entryUpstream ?? 'fixture-upstream'}'`,
            'const FAMILIES = []',
            "const PROVENANCE = [{ dir: MODULE_SRC, file: 'module.ts', upstream: UPSTREAM }]",
            'module.exports = { FAMILIES, PROVENANCE }',
            '',
        ].join('\n'),
    )
    const srcDir = path.join(root, entryDir ?? 'Tasks/Fixture/FixtureV1/src')
    fs.mkdirSync(srcDir, { recursive: true })
    if (localContent !== null) fs.writeFileSync(path.join(srcDir, 'module.ts'), localContent)
    return root
}

/** A fixture "upstream" checkout: just the file at the given relative path, no header. */
function fixtureUpstream(name, { upstreamContent, relDir }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `cross-repo-parity-${name}-upstream-`))
    const srcDir = path.join(root, relDir ?? 'Tasks/Fixture/FixtureV1/src')
    fs.mkdirSync(srcDir, { recursive: true })
    if (upstreamContent !== null) fs.writeFileSync(path.join(srcDir, 'module.ts'), upstreamContent)
    return root
}

function run(repoRoot, upstreamRoot) {
    const args = [path.join(repoRoot, 'scripts', 'check-cross-repo-parity.js')]
    if (upstreamRoot !== undefined) args.push(upstreamRoot)
    args.push('--json')
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: repoRoot })
    try { return { ...JSON.parse(r.stdout), status: r.status } } catch { return { sites: [], failures: -1, status: r.status, raw: r.stdout + r.stderr } }
}

// ── 1. identical body, header present locally -> IN-SYNC, exit 0
{
    const repo = fixtureRepo('identical', { localContent: header('IN-SYNC') + BODY })
    const upstream = fixtureUpstream('identical', { upstreamContent: BODY })
    const out = run(repo, upstream)
    report(out.status === 0 && out.failures === 0 && out.sites.length === 1 && out.sites[0].verdict === 'IN-SYNC',
        `identical body -> IN-SYNC (got ${JSON.stringify(out.sites)})`)
}

// ── 2. header-only difference (policy prose changes, body and status do not) -> still IN-SYNC
{
    const repo = fixtureRepo('header-only', { localContent: header('IN-SYNC', { policy: 'a completely different policy sentence' }) + BODY })
    const upstream = fixtureUpstream('header-only', { upstreamContent: BODY })
    const out = run(repo, upstream)
    report(out.status === 0 && out.sites.length === 1 && out.sites[0].verdict === 'IN-SYNC',
        `header-only difference -> still IN-SYNC (got ${JSON.stringify(out.sites)})`)
}

// ── 3. diverged body, IN-SYNC declared -> DIVERGED, exit 1
{
    const repo = fixtureRepo('diverged', { localContent: header('IN-SYNC') + BODY })
    const upstream = fixtureUpstream('diverged', { upstreamContent: BODY.replace('length > 0', 'length > 1') })
    const out = run(repo, upstream)
    report(out.status === 1 && out.failures === 1 && out.sites[0].verdict === 'DIVERGED',
        `diverged body -> DIVERGED, exit 1 (got status ${out.status}, ${JSON.stringify(out.sites)})`)
}

// ── 4. missing local copy -> MISSING-LOCAL, not silently skipped
{
    const repo = fixtureRepo('missing-local', { localContent: null })
    const upstream = fixtureUpstream('missing-local', { upstreamContent: BODY })
    const out = run(repo, upstream)
    report(out.status === 1 && out.sites[0].verdict === 'MISSING-LOCAL',
        `missing local copy -> MISSING-LOCAL (got ${JSON.stringify(out.sites)})`)
}

// ── 5. missing upstream file -> MISSING-UPSTREAM, not silently skipped
{
    const repo = fixtureRepo('missing-upstream', { localContent: header('IN-SYNC') + BODY })
    const upstream = fixtureUpstream('missing-upstream', { upstreamContent: null })
    const out = run(repo, upstream)
    report(out.status === 1 && out.sites[0].verdict === 'MISSING-UPSTREAM',
        `missing upstream file -> MISSING-UPSTREAM (got ${JSON.stringify(out.sites)})`)
}

// ── 6. no PROVENANCE entries at all must not pass vacuously
{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-repo-parity-vacuous-'))
    fs.mkdirSync(path.join(root, 'scripts', 'lib'), { recursive: true })
    fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'check-cross-repo-parity.js'))
    fs.writeFileSync(path.join(root, 'scripts', 'lib', 'shared-modules.js'), 'module.exports = { FAMILIES: [], PROVENANCE: [] }\n')
    const upstream = fixtureUpstream('vacuous', { upstreamContent: BODY })
    const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-cross-repo-parity.js'), upstream], { encoding: 'utf8', cwd: root })
    report(r.status === 1 && /declares no PROVENANCE entries/.test(r.stderr),
        `empty PROVENANCE -> refuses to pass vacuously (exit ${r.status})`)
}

// ── 7. no upstream path given at all -> usage error, not a silent pass
{
    const repo = fixtureRepo('no-arg', { localContent: header('IN-SYNC') + BODY })
    const r = spawnSync(process.execPath, [path.join(repo, 'scripts', 'check-cross-repo-parity.js')], { encoding: 'utf8', cwd: repo })
    report(r.status === 1 && /Usage:/.test(r.stderr), `no upstream path argument -> usage error (exit ${r.status})`)
}

// ── 8. self-declared DIVERGED, body genuinely differs -> not a failure, and the
// upstream is never even consulted (no upstream file at all still passes).
{
    const repo = fixtureRepo('self-declared', { localContent: header('DIVERGED', { policy: 'this copy deliberately differs; see the task issue' }) + BODY })
    const upstream = fixtureUpstream('self-declared', { upstreamContent: null })
    const out = run(repo, upstream)
    report(out.status === 0 && out.failures === 0 && out.sites[0].verdict === 'SELF-DECLARED-DIVERGED',
        `self-declared DIVERGED -> not a failure, upstream not required (got status ${out.status}, ${JSON.stringify(out.sites)})`)
}

// ── 9. the upstream RELATIVE PATH comes from the header, not from dir/file --
// a sibling extension's own PROVENANCE list proves those two are not always
// the same path (different directory naming conventions per repository).
{
    const repo = fixtureRepo('header-path', {
        localContent: header('IN-SYNC', { upstreamPath: 'Tasks/Other/OtherV1/src/module.ts' }) + BODY,
        entryDir: 'Tasks/Fixture/FixtureV1/src', // deliberately NOT Tasks/Other/OtherV1/src
    })
    const upstream = fixtureUpstream('header-path', { upstreamContent: BODY, relDir: 'Tasks/Other/OtherV1/src' })
    const out = run(repo, upstream)
    report(out.status === 0 && out.sites[0].verdict === 'IN-SYNC',
        `upstream path resolved from the header, not from the PROVENANCE entry's dir (got ${JSON.stringify(out.sites)})`)
}

// ── 10. header names a different upstream repo than the PROVENANCE entry --
// reported, not silently trusting either one.
{
    const repo = fixtureRepo('header-mismatch', {
        localContent: header('IN-SYNC', { upstreamName: 'some-other-repo' }) + BODY,
        entryUpstream: 'fixture-upstream',
    })
    const upstream = fixtureUpstream('header-mismatch', { upstreamContent: BODY })
    const out = run(repo, upstream)
    report(out.status === 1 && out.sites[0].verdict === 'HEADER-MISMATCH',
        `header/PROVENANCE upstream-repo disagreement -> reported (got ${JSON.stringify(out.sites)})`)
}

if (failures > 0) {
    console.error(`\ncheck-cross-repo-parity.js self-test: ${failures} case(s) failed.`)
    process.exit(1)
}
console.log('\ncheck-cross-repo-parity.js self-test: all cases passed.')
