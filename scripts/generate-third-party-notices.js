// Generate THIRD_PARTY_NOTICES.md for the production closure each task's
// lockfile declares, so the attribution matches what the release build bundles
// rather than what happens to be installed or what someone remembered.
const fs = require('fs');
const path = require('path');
const { discoverTaskDirs } = require('./lib/task-dirs.js');

// `--check` compares instead of writing: it exits non-zero when the committed
// file is not what this script would write today, and leaves the file alone.
// A dependency bump moves a lockfile without touching the notices, so the file
// is expected to drift on main between releases; it is regenerated on the
// Release PR, and this is what the Release PR's CI and the release build run to
// refuse a copy that was not.
const args = process.argv.slice(2);
const CHECK = args.includes('--check');

// Defaults to the repository this script lives in. It used to default to one
// contributor's absolute Windows path, so running it anywhere else wrote the
// file into a directory that does not exist and crashed.
const ROOT = args.find((arg) => arg !== '--check') || path.resolve(__dirname, '..');

// A tree the lockfile does not describe is reported and nothing is written:
// a notice generated from the wrong tree is wrong in a way no reader can see.
const problems = [];

// The release build bundles what `npm ci` then `npm prune --omit=dev` leaves:
// every lockfile entry not flagged `dev`. Membership is read from the lockfile
// for that reason. This used to walk node_modules and list whatever was there,
// so only a pruned tree gave the right answer -- run on an unpruned one it
// attributed every devDependency as bundled (317 packages for PipelineChangelog
// when 37 ship), and the only gate on the file is that it exists.
// The installed package.json still supplies the licence and the repository.
function collect(rel) {
  if (!fs.existsSync(path.join(ROOT, rel, 'node_modules'))) {
    problems.push(`${rel}: dependencies are not installed (run \`npm run deps\`)`);
    return [];
  }
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, rel, 'package-lock.json'), 'utf8'));
  const found = new Map();
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (key === '' || entry.dev) continue;
    const pkgFile = path.join(ROOT, rel, key, 'package.json');
    if (!fs.existsSync(pkgFile)) {
      // npm leaves an optional dependency out when the platform does not match.
      if (!entry.optional && !entry.devOptional) {
        problems.push(`${rel}/${key}: the lockfile resolves ${entry.version} but it is not installed (run \`npm run deps\`)`);
      }
      continue;
    }
    const p = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    if (p.version !== entry.version) {
      problems.push(`${rel}/${key}: installed at ${p.version} but the lockfile resolves ${entry.version} (run \`npm run deps\`)`);
      continue;
    }
    const license = typeof p.license === 'string'
      ? p.license
      : (p.license && p.license.type) || (Array.isArray(p.licenses) && p.licenses.map((l) => l.type).join(' OR ')) || 'see package';
    const repo = typeof p.repository === 'string' ? p.repository : (p.repository && p.repository.url) || '';
    found.set(`${p.name}@${p.version}`, { name: p.name, version: p.version, license, repo: repo.replace(/^git\+/, '').replace(/\.git$/, '') });
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

const out = [];
out.push('# Third-party notices');
out.push('');
out.push('The `.vsix` this repository publishes bundles each task\'s pruned production');
out.push('`node_modules`, so the packages below ship inside it. They remain under their own');
out.push('licences and copyrights; nothing here relicenses them.');
out.push('');
out.push('This file is REQUIRED by `scripts/check-package-composition.js` once any task');
out.push('bundles dependencies (`requiredWhenBundling`), and the release build runs that');
out.push('gate after `npm ci` and `npm prune --production` — so an unattributed bundle');
out.push('fails the release rather than shipping quietly.');
out.push('');
out.push('The authoritative, machine-readable inventory is the per-task CycloneDX SBOM');
out.push('attested against the published `.vsix` (`sbom-changelogv1.cdx.json`,');
out.push('`sbom-markdown2htmlv1.cdx.json`, `sbom-publishkbarticlev1.cdx.json`). This file');
out.push('is the human-readable attribution for the same closure.');
out.push('');
out.push('Regenerate with `node scripts/generate-third-party-notices.js` after `npm run deps`.');
out.push('Membership is each task\'s lockfile minus its dev-only entries, which is what');
out.push('`npm prune --omit=dev` leaves, so the result is the same whether or not the tree');
out.push('has been pruned.');
out.push('');
out.push('A dependency update moves a lockfile and not this file, so between releases it');
out.push('can trail `main`. It is regenerated on the Release PR');
out.push('(`.github/workflows/release-pr-minor-bumps.yml`), and the release build runs the');
out.push('generator with `--check` and refuses a copy that does not match what it bundles.');
out.push('');

let total = 0;
// The same enumeration every gate and the packager use, so a task cannot be
// bundled without being attributed here.
for (const rel of discoverTaskDirs(ROOT)) {
  const taskName = JSON.parse(fs.readFileSync(path.join(ROOT, rel, 'task.json'), 'utf8')).name;
  const pkgs = collect(rel);
  out.push(`## ${taskName}`);
  out.push('');
  total += pkgs.length;
  out.push(`Bundled packages: ${pkgs.length}`);
  out.push('');
  out.push('| Package | Version | Licence |');
  out.push('| --- | --- | --- |');
  for (const p of pkgs) {
    const link = p.repo && /^https?:/.test(p.repo) ? `[${p.name}](${p.repo})` : p.name;
    out.push(`| ${link} | ${p.version} | ${p.license} |`);
  }
  out.push('');
}

if (problems.length) {
  console.error(`THIRD_PARTY_NOTICES.md not ${CHECK ? 'checked' : 'written'}: the installed tree is not the one the lockfile describes.`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const file = path.join(ROOT, 'THIRD_PARTY_NOTICES.md');
const text = out.join('\n');

if (CHECK) {
  // A Windows checkout holds the same notices with CRLF line endings.
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current !== text) {
    if (current === null) {
      console.error('THIRD_PARTY_NOTICES.md is missing.');
    } else {
      console.error('THIRD_PARTY_NOTICES.md is out of date: it is not what the lockfiles bundle today.');
      const have = current.split('\n');
      const want = text.split('\n');
      const at = want.findIndex((line, i) => line !== have[i]);
      const line = at === -1 ? want.length : at;
      console.error(`  first difference at line ${line + 1}:`);
      console.error(`    file      : ${have[line] === undefined ? '(end of file)' : have[line]}`);
      console.error(`    lockfiles : ${want[line] === undefined ? '(end of file)' : want[line]}`);
    }
    console.error('Regenerate it with `node scripts/generate-third-party-notices.js` after `npm run deps`.');
    console.error('On a Release PR .github/workflows/release-pr-minor-bumps.yml does that and pushes the result.');
    process.exit(1);
  }
  console.log(`THIRD_PARTY_NOTICES.md is current (${total} bundled package entries)`);
} else {
  fs.writeFileSync(file, text);
  console.log(`wrote THIRD_PARTY_NOTICES.md (${total} bundled package entries)`);
}
