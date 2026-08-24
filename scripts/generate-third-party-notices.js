// Generate THIRD_PARTY_NOTICES.md from the ACTUAL pruned production trees, so
// the attribution matches what is bundled rather than what someone remembered.
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'C:/dev/wt/rd-changelog';
const TASKS = [
  ['PipelineChangelog', 'Tasks/Changelog/ChangelogV1'],
  ['PipelineMarkdown2Html', 'Tasks/Markdown2Html/Markdown2HtmlV1'],
  ['PipelinePublishKbArticle', 'Tasks/PublishKbArticle/PublishKbArticleV1'],
];

function collect(nodeModules) {
  const found = new Map();
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === '.bin' || e.name === '.cache') continue;
      const full = path.join(dir, e.name);
      if (e.name.startsWith('@')) { visit(full); continue; }
      const pkgFile = path.join(full, 'package.json');
      if (fs.existsSync(pkgFile)) {
        try {
          const p = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
          if (p.name && p.version) {
            const license = typeof p.license === 'string'
              ? p.license
              : (p.license && p.license.type) || (Array.isArray(p.licenses) && p.licenses.map((l) => l.type).join(' OR ')) || 'see package';
            const repo = typeof p.repository === 'string' ? p.repository : (p.repository && p.repository.url) || '';
            found.set(`${p.name}@${p.version}`, { name: p.name, version: p.version, license, repo: repo.replace(/^git\+/, '').replace(/\.git$/, '') });
          }
        } catch { /* unreadable package.json: skipped, and absent from the notice */ }
      }
      const nested = path.join(full, 'node_modules');
      if (fs.existsSync(nested)) visit(nested);
    }
  };
  visit(nodeModules);
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
out.push('Regenerate with `node scripts/generate-third-party-notices.js` after installing');
out.push('and pruning each task, which is what the release build does.');
out.push('');

let total = 0;
for (const [taskName, rel] of TASKS) {
  const nm = path.join(ROOT, rel, 'node_modules');
  out.push(`## ${taskName}`);
  out.push('');
  if (!fs.existsSync(nm)) {
    out.push('_Dependencies not installed when this file was generated._');
    out.push('');
    continue;
  }
  const pkgs = collect(nm);
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

fs.writeFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), out.join('\n'));
console.log(`wrote THIRD_PARTY_NOTICES.md (${total} bundled package entries)`);
