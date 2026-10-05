// Generate THIRD_PARTY_NOTICES.md for the production closure each task's
// lockfile declares, so the attribution matches what the release build bundles
// rather than what happens to be installed or what someone remembered.
const fs = require('fs');
const path = require('path');
const { discoverTaskDirs } = require('./lib/task-dirs.js');

// Defaults to the repository this script lives in. It used to default to one
// contributor's absolute Windows path, so running it anywhere else wrote the
// file into a directory that does not exist and crashed.
const ROOT = process.argv[2] || path.resolve(__dirname, '..');

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
  console.error('THIRD_PARTY_NOTICES.md not written: the installed tree is not the one the lockfile describes.');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), out.join('\n'));
console.log(`wrote THIRD_PARTY_NOTICES.md (${total} bundled package entries)`);
