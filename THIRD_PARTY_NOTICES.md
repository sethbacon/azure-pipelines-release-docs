# Third-party notices

The `.vsix` this repository publishes bundles each task's pruned production
`node_modules`, so the packages below ship inside it. They remain under their own
licences and copyrights; nothing here relicenses them.

This file is REQUIRED by `scripts/check-package-composition.js` once any task
bundles dependencies (`requiredWhenBundling`), and the release build runs that
gate after `npm ci` and `npm prune --production` — so an unattributed bundle
fails the release rather than shipping quietly.

The authoritative, machine-readable inventory is the per-task CycloneDX SBOM
attested against the published `.vsix` (`sbom-changelogv1.cdx.json`,
`sbom-markdown2htmlv1.cdx.json`, `sbom-publishkbarticlev1.cdx.json`). This file
is the human-readable attribution for the same closure.

Regenerate with `node scripts/generate-third-party-notices.js` after `npm run deps`.
Membership is each task's lockfile minus its dev-only entries, which is what
`npm prune --omit=dev` leaves, so the result is the same whether or not the tree
has been pruned.

A dependency update moves a lockfile and not this file, so between releases it
can trail `main`. It is regenerated on the Release PR
(`.github/workflows/release-pr-minor-bumps.yml`), and the release build runs the
generator with `--check` and refuses a copy that does not match what it bundles.

## PipelineChangelog

Bundled packages: 37

| Package | Version | Licence |
| --- | --- | --- |
| [@4cloudguru/pipeline-task-ado](https://github.com/4cloudguru/pipeline-task-ado) | 0.11.1 | Apache-2.0 |
| [@4cloudguru/pipeline-task-core](https://github.com/4cloudguru/pipeline-task-core) | 0.9.3 | Apache-2.0 |
| agent-base | 6.0.2 | MIT |
| [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) | 5.281.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 5.0.12 | MIT |
| debug | 4.4.3 | MIT |
| [es-errors](https://github.com/ljharb/es-errors) | 1.3.0 | MIT |
| follow-redirects | 1.16.0 | MIT |
| [fs.realpath](https://github.com/isaacs/fs.realpath) | 1.0.0 | ISC |
| [function-bind](https://github.com/Raynos/function-bind) | 1.1.2 | MIT |
| glob | 7.2.3 | ISC |
| [hasown](https://github.com/inspect-js/hasOwn) | 2.0.4 | MIT |
| https-proxy-agent | 5.0.1 | MIT |
| [inflight](https://github.com/npm/inflight) | 1.0.6 | ISC |
| inherits | 2.0.4 | ISC |
| interpret | 1.4.0 | MIT |
| [is-core-module](https://github.com/inspect-js/is-core-module) | 2.17.0 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| [nodejs-file-downloader](https://github.com/ibrod83/nodejs-file-downloader) | 4.13.0 | ISC |
| once | 1.4.0 | ISC |
| path-is-absolute | 1.0.1 | MIT |
| [path-parse](https://github.com/jbgutierrez/path-parse) | 1.0.7 | MIT |
| q | 1.5.1 | MIT |
| rechoir | 0.6.2 | MIT |
| resolve | 1.22.12 | MIT |
| sanitize-filename | 1.6.4 | WTFPL OR ISC |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | ISC |
| shelljs | 0.8.5 | BSD-3-Clause |
| [supports-preserve-symlinks-flag](https://github.com/inspect-js/node-supports-preserve-symlinks-flag) | 1.0.0 | MIT |
| [truncate-utf8-bytes](https://github.com/parshap/truncate-utf8-bytes) | 1.0.2 | WTFPL |
| [undici](https://github.com/nodejs/undici) | 6.29.0 | MIT |
| [utf8-byte-length](https://github.com/parshap/utf8-byte-length) | 1.0.5 | (WTFPL OR MIT) |
| [wrappy](https://github.com/npm/wrappy) | 1.0.2 | ISC |

## PipelineMarkdown2Html

Bundled packages: 82

| Package | Version | Licence |
| --- | --- | --- |
| agent-base | 6.0.2 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) | 5.281.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| [boolbase](https://github.com/fb55/boolbase) | 1.0.0 | ISC |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 5.0.12 | MIT |
| cheerio | 1.2.0 | MIT |
| cheerio-select | 2.1.0 | BSD-2-Clause |
| css-select | 5.2.2 | BSD-2-Clause |
| [css-what](https://github.com/fb55/css-what) | 6.2.2 | BSD-2-Clause |
| [dayjs](https://github.com/iamkun/dayjs) | 1.11.21 | MIT |
| debug | 4.4.3 | MIT |
| deepmerge | 4.3.1 | MIT |
| dom-serializer | 2.0.0 | MIT |
| dom-serializer | 3.1.1 | MIT |
| domelementtype | 2.3.0 | BSD-2-Clause |
| domelementtype | 3.0.0 | BSD-2-Clause |
| domhandler | 5.0.3 | BSD-2-Clause |
| domhandler | 6.0.1 | BSD-2-Clause |
| domutils | 3.2.2 | BSD-2-Clause |
| domutils | 4.0.2 | BSD-2-Clause |
| encoding-sniffer | 0.2.1 | MIT |
| entities | 4.5.0 | BSD-2-Clause |
| entities | 6.0.1 | BSD-2-Clause |
| [entities](https://github.com/fb55/entities) | 7.0.1 | BSD-2-Clause |
| [entities](https://github.com/fb55/entities) | 8.0.0 | BSD-2-Clause |
| [es-errors](https://github.com/ljharb/es-errors) | 1.3.0 | MIT |
| escape-string-regexp | 4.0.0 | MIT |
| follow-redirects | 1.16.0 | MIT |
| [fs.realpath](https://github.com/isaacs/fs.realpath) | 1.0.0 | ISC |
| [function-bind](https://github.com/Raynos/function-bind) | 1.1.2 | MIT |
| glob | 7.2.3 | ISC |
| [hasown](https://github.com/inspect-js/hasOwn) | 2.0.4 | MIT |
| highlight.js | 11.12.0 | BSD-3-Clause |
| htmlparser2 | 10.1.0 | MIT |
| htmlparser2 | 12.0.0 | MIT |
| https-proxy-agent | 5.0.1 | MIT |
| iconv-lite | 0.6.3 | MIT |
| [inflight](https://github.com/npm/inflight) | 1.0.6 | ISC |
| inherits | 2.0.4 | ISC |
| interpret | 1.4.0 | MIT |
| [is-core-module](https://github.com/inspect-js/is-core-module) | 2.17.0 | MIT |
| is-plain-object | 5.0.0 | MIT |
| js-yaml | 4.3.2 | MIT |
| [launder](https://github.com/apostrophecms/apostrophe) | 1.7.1 | MIT |
| linkify-it | 5.0.2 | MIT |
| markdown-it | 14.3.2 | MIT |
| mdurl | 2.0.0 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.18 | MIT |
| [nodejs-file-downloader](https://github.com/ibrod83/nodejs-file-downloader) | 4.13.0 | ISC |
| [nth-check](https://github.com/fb55/nth-check) | 2.1.1 | BSD-2-Clause |
| once | 1.4.0 | ISC |
| [parse-srcset](https://github.com/albell/parse-srcset) | 1.0.2 | MIT |
| parse5 | 7.3.0 | MIT |
| parse5-htmlparser2-tree-adapter | 7.1.0 | MIT |
| parse5-parser-stream | 7.1.2 | MIT |
| path-is-absolute | 1.0.1 | MIT |
| [path-parse](https://github.com/jbgutierrez/path-parse) | 1.0.7 | MIT |
| picocolors | 1.1.1 | ISC |
| postcss | 8.5.23 | MIT |
| [punycode.js](https://github.com/mathiasbynens/punycode.js) | 2.3.1 | MIT |
| q | 1.5.1 | MIT |
| rechoir | 0.6.2 | MIT |
| resolve | 1.22.12 | MIT |
| [safer-buffer](https://github.com/ChALkeR/safer-buffer) | 2.1.2 | MIT |
| sanitize-filename | 1.6.4 | WTFPL OR ISC |
| [sanitize-html](https://github.com/apostrophecms/apostrophe) | 2.17.7 | MIT |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | ISC |
| shelljs | 0.8.5 | BSD-3-Clause |
| source-map-js | 1.2.2 | BSD-3-Clause |
| [supports-preserve-symlinks-flag](https://github.com/inspect-js/node-supports-preserve-symlinks-flag) | 1.0.0 | MIT |
| [truncate-utf8-bytes](https://github.com/parshap/truncate-utf8-bytes) | 1.0.2 | WTFPL |
| uc.micro | 2.1.0 | MIT |
| [undici](https://github.com/nodejs/undici) | 7.30.0 | MIT |
| [utf8-byte-length](https://github.com/parshap/utf8-byte-length) | 1.0.5 | (WTFPL OR MIT) |
| whatwg-encoding | 3.1.1 | MIT |
| whatwg-mimetype | 4.0.0 | MIT |
| [wrappy](https://github.com/npm/wrappy) | 1.0.2 | ISC |

## PipelinePublishKbArticle

Bundled packages: 77

| Package | Version | Licence |
| --- | --- | --- |
| [@4cloudguru/pipeline-task-ado](https://github.com/4cloudguru/pipeline-task-ado) | 0.11.1 | Apache-2.0 |
| [@4cloudguru/pipeline-task-core](https://github.com/4cloudguru/pipeline-task-core) | 0.9.3 | Apache-2.0 |
| agent-base | 6.0.2 | MIT |
| [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) | 5.281.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| [boolbase](https://github.com/fb55/boolbase) | 1.0.0 | ISC |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 5.0.12 | MIT |
| cheerio | 1.2.0 | MIT |
| cheerio-select | 2.1.0 | BSD-2-Clause |
| css-select | 5.2.2 | BSD-2-Clause |
| [css-what](https://github.com/fb55/css-what) | 6.2.2 | BSD-2-Clause |
| [dayjs](https://github.com/iamkun/dayjs) | 1.11.21 | MIT |
| debug | 4.4.3 | MIT |
| deepmerge | 4.3.1 | MIT |
| dom-serializer | 2.0.0 | MIT |
| dom-serializer | 3.1.1 | MIT |
| domelementtype | 2.3.0 | BSD-2-Clause |
| domelementtype | 3.0.0 | BSD-2-Clause |
| domhandler | 5.0.3 | BSD-2-Clause |
| domhandler | 6.0.1 | BSD-2-Clause |
| domutils | 3.2.2 | BSD-2-Clause |
| domutils | 4.0.2 | BSD-2-Clause |
| encoding-sniffer | 0.2.1 | MIT |
| entities | 4.5.0 | BSD-2-Clause |
| entities | 6.0.1 | BSD-2-Clause |
| [entities](https://github.com/fb55/entities) | 7.0.1 | BSD-2-Clause |
| [entities](https://github.com/fb55/entities) | 8.0.0 | BSD-2-Clause |
| [es-errors](https://github.com/ljharb/es-errors) | 1.3.0 | MIT |
| escape-string-regexp | 4.0.0 | MIT |
| follow-redirects | 1.16.0 | MIT |
| [fs.realpath](https://github.com/isaacs/fs.realpath) | 1.0.0 | ISC |
| [function-bind](https://github.com/Raynos/function-bind) | 1.1.2 | MIT |
| glob | 7.2.3 | ISC |
| [hasown](https://github.com/inspect-js/hasOwn) | 2.0.4 | MIT |
| htmlparser2 | 10.1.0 | MIT |
| htmlparser2 | 12.0.0 | MIT |
| https-proxy-agent | 5.0.1 | MIT |
| iconv-lite | 0.6.3 | MIT |
| [inflight](https://github.com/npm/inflight) | 1.0.6 | ISC |
| inherits | 2.0.4 | ISC |
| interpret | 1.4.0 | MIT |
| [is-core-module](https://github.com/inspect-js/is-core-module) | 2.17.0 | MIT |
| is-plain-object | 5.0.0 | MIT |
| [launder](https://github.com/apostrophecms/apostrophe) | 1.7.1 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.18 | MIT |
| [nodejs-file-downloader](https://github.com/ibrod83/nodejs-file-downloader) | 4.13.0 | ISC |
| [nth-check](https://github.com/fb55/nth-check) | 2.1.1 | BSD-2-Clause |
| once | 1.4.0 | ISC |
| [parse-srcset](https://github.com/albell/parse-srcset) | 1.0.2 | MIT |
| parse5 | 7.3.0 | MIT |
| parse5-htmlparser2-tree-adapter | 7.1.0 | MIT |
| parse5-parser-stream | 7.1.2 | MIT |
| path-is-absolute | 1.0.1 | MIT |
| [path-parse](https://github.com/jbgutierrez/path-parse) | 1.0.7 | MIT |
| picocolors | 1.1.1 | ISC |
| postcss | 8.5.23 | MIT |
| q | 1.5.1 | MIT |
| rechoir | 0.6.2 | MIT |
| resolve | 1.22.12 | MIT |
| [safer-buffer](https://github.com/ChALkeR/safer-buffer) | 2.1.2 | MIT |
| sanitize-filename | 1.6.4 | WTFPL OR ISC |
| [sanitize-html](https://github.com/apostrophecms/apostrophe) | 2.17.7 | MIT |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | ISC |
| shelljs | 0.8.5 | BSD-3-Clause |
| source-map-js | 1.2.2 | BSD-3-Clause |
| [supports-preserve-symlinks-flag](https://github.com/inspect-js/node-supports-preserve-symlinks-flag) | 1.0.0 | MIT |
| [truncate-utf8-bytes](https://github.com/parshap/truncate-utf8-bytes) | 1.0.2 | WTFPL |
| [undici](https://github.com/nodejs/undici) | 6.29.0 | MIT |
| [undici](https://github.com/nodejs/undici) | 7.29.1 | MIT |
| [utf8-byte-length](https://github.com/parshap/utf8-byte-length) | 1.0.5 | (WTFPL OR MIT) |
| whatwg-encoding | 3.1.1 | MIT |
| whatwg-mimetype | 4.0.0 | MIT |
| [wrappy](https://github.com/npm/wrappy) | 1.0.2 | ISC |
