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

Regenerate with `node scripts/generate-third-party-notices.js` after installing
and pruning each task, which is what the release build does.

## PipelineChangelog

Bundled packages: 54

| Package | Version | Licence |
| --- | --- | --- |
| [@4cloudguru/pipeline-task-core](https://github.com/4cloudguru/pipeline-task-core) | 0.6.3 | Apache-2.0 |
| [@nodelib/fs.scandir](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir) | 2.1.5 | MIT |
| [@nodelib/fs.stat](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat) | 2.0.5 | MIT |
| [@nodelib/fs.walk](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk) | 1.2.8 | MIT |
| [adm-zip](https://github.com/cthackers/adm-zip) | 0.6.0 | MIT |
| agent-base | 6.0.2 | MIT |
| [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) | 5.279.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 5.0.9 | MIT |
| braces | 3.0.3 | MIT |
| cross-spawn | 7.0.6 | MIT |
| debug | 4.4.3 | MIT |
| execa | 5.1.1 | MIT |
| fast-glob | 3.3.3 | MIT |
| [fastq](https://github.com/mcollina/fastq) | 1.20.1 | ISC |
| fill-range | 7.1.1 | MIT |
| follow-redirects | 1.16.0 | MIT |
| get-stream | 6.0.1 | MIT |
| glob-parent | 5.1.2 | ISC |
| https-proxy-agent | 5.0.1 | MIT |
| human-signals | 2.1.0 | Apache-2.0 |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| is-number | 7.0.0 | MIT |
| is-stream | 2.0.1 | MIT |
| [isexe](https://github.com/isaacs/isexe) | 2.0.0 | ISC |
| merge-stream | 2.0.0 | MIT |
| merge2 | 1.4.1 | MIT |
| micromatch | 4.0.8 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mimic-fn | 2.1.0 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| [nodejs-file-downloader](https://github.com/ibrod83/nodejs-file-downloader) | 4.13.0 | ISC |
| npm-run-path | 4.0.1 | MIT |
| onetime | 5.1.2 | MIT |
| path-key | 3.1.1 | MIT |
| picomatch | 2.3.2 | MIT |
| q | 1.5.1 | MIT |
| queue-microtask | 1.2.3 | MIT |
| [reusify](https://github.com/mcollina/reusify) | 1.1.0 | MIT |
| run-parallel | 1.2.0 | MIT |
| sanitize-filename | 1.6.4 | WTFPL OR ISC |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| shelljs | 0.10.0 | BSD-3-Clause |
| [signal-exit](https://github.com/tapjs/signal-exit) | 3.0.7 | ISC |
| strip-final-newline | 2.0.0 | MIT |
| to-regex-range | 5.0.1 | MIT |
| [truncate-utf8-bytes](https://github.com/parshap/truncate-utf8-bytes) | 1.0.2 | WTFPL |
| [utf8-byte-length](https://github.com/parshap/utf8-byte-length) | 1.0.5 | (WTFPL OR MIT) |
| which | 2.0.2 | ISC |

## PipelineMarkdown2Html

Bundled packages: 101

| Package | Version | Licence |
| --- | --- | --- |
| [@nodelib/fs.scandir](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir) | 2.1.5 | MIT |
| [@nodelib/fs.stat](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat) | 2.0.5 | MIT |
| [@nodelib/fs.walk](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk) | 1.2.8 | MIT |
| [adm-zip](https://github.com/cthackers/adm-zip) | 0.6.0 | MIT |
| agent-base | 6.0.2 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) | 5.279.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| [boolbase](https://github.com/fb55/boolbase) | 1.0.0 | ISC |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 5.0.9 | MIT |
| braces | 3.0.3 | MIT |
| cheerio | 1.2.0 | MIT |
| cheerio-select | 2.1.0 | BSD-2-Clause |
| cross-spawn | 7.0.6 | MIT |
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
| escape-string-regexp | 4.0.0 | MIT |
| execa | 5.1.1 | MIT |
| fast-glob | 3.3.3 | MIT |
| [fastq](https://github.com/mcollina/fastq) | 1.20.1 | ISC |
| fill-range | 7.1.1 | MIT |
| follow-redirects | 1.16.0 | MIT |
| get-stream | 6.0.1 | MIT |
| glob-parent | 5.1.2 | ISC |
| highlight.js | 11.12.0 | BSD-3-Clause |
| htmlparser2 | 10.1.0 | MIT |
| htmlparser2 | 12.0.0 | MIT |
| https-proxy-agent | 5.0.1 | MIT |
| human-signals | 2.1.0 | Apache-2.0 |
| iconv-lite | 0.6.3 | MIT |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| is-number | 7.0.0 | MIT |
| is-plain-object | 5.0.0 | MIT |
| is-stream | 2.0.1 | MIT |
| [isexe](https://github.com/isaacs/isexe) | 2.0.0 | ISC |
| js-yaml | 4.3.1 | MIT |
| [launder](https://github.com/apostrophecms/apostrophe) | 1.7.1 | MIT |
| linkify-it | 5.0.2 | MIT |
| markdown-it | 14.3.0 | MIT |
| mdurl | 2.0.0 | MIT |
| merge-stream | 2.0.0 | MIT |
| merge2 | 1.4.1 | MIT |
| micromatch | 4.0.8 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mimic-fn | 2.1.0 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.18 | MIT |
| [nodejs-file-downloader](https://github.com/ibrod83/nodejs-file-downloader) | 4.13.0 | ISC |
| npm-run-path | 4.0.1 | MIT |
| [nth-check](https://github.com/fb55/nth-check) | 2.1.1 | BSD-2-Clause |
| onetime | 5.1.2 | MIT |
| [parse-srcset](https://github.com/albell/parse-srcset) | 1.0.2 | MIT |
| parse5 | 7.3.0 | MIT |
| parse5-htmlparser2-tree-adapter | 7.1.0 | MIT |
| parse5-parser-stream | 7.1.2 | MIT |
| path-key | 3.1.1 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 2.3.2 | MIT |
| postcss | 8.5.23 | MIT |
| [punycode.js](https://github.com/mathiasbynens/punycode.js) | 2.3.1 | MIT |
| q | 1.5.1 | MIT |
| queue-microtask | 1.2.3 | MIT |
| [reusify](https://github.com/mcollina/reusify) | 1.1.0 | MIT |
| run-parallel | 1.2.0 | MIT |
| [safer-buffer](https://github.com/ChALkeR/safer-buffer) | 2.1.2 | MIT |
| sanitize-filename | 1.6.4 | WTFPL OR ISC |
| [sanitize-html](https://github.com/apostrophecms/apostrophe) | 2.17.7 | MIT |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| shelljs | 0.10.0 | BSD-3-Clause |
| [signal-exit](https://github.com/tapjs/signal-exit) | 3.0.7 | ISC |
| source-map-js | 1.2.1 | BSD-3-Clause |
| strip-final-newline | 2.0.0 | MIT |
| to-regex-range | 5.0.1 | MIT |
| [truncate-utf8-bytes](https://github.com/parshap/truncate-utf8-bytes) | 1.0.2 | WTFPL |
| uc.micro | 2.1.0 | MIT |
| [undici](https://github.com/nodejs/undici) | 7.29.0 | MIT |
| [utf8-byte-length](https://github.com/parshap/utf8-byte-length) | 1.0.5 | (WTFPL OR MIT) |
| whatwg-encoding | 3.1.1 | MIT |
| whatwg-mimetype | 4.0.0 | MIT |
| which | 2.0.2 | ISC |

## PipelinePublishKbArticle

Bundled packages: 94

| Package | Version | Licence |
| --- | --- | --- |
| [@4cloudguru/pipeline-task-core](https://github.com/4cloudguru/pipeline-task-core) | 0.6.0 | Apache-2.0 |
| [@nodelib/fs.scandir](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir) | 2.1.5 | MIT |
| [@nodelib/fs.stat](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat) | 2.0.5 | MIT |
| [@nodelib/fs.walk](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk) | 1.2.8 | MIT |
| [adm-zip](https://github.com/cthackers/adm-zip) | 0.6.0 | MIT |
| agent-base | 6.0.2 | MIT |
| [azure-pipelines-task-lib](https://github.com/Microsoft/azure-pipelines-task-lib) | 5.279.0 | MIT |
| balanced-match | 4.0.4 | MIT |
| [boolbase](https://github.com/fb55/boolbase) | 1.0.0 | ISC |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 5.0.9 | MIT |
| braces | 3.0.3 | MIT |
| cheerio | 1.2.0 | MIT |
| cheerio-select | 2.1.0 | BSD-2-Clause |
| cross-spawn | 7.0.6 | MIT |
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
| escape-string-regexp | 4.0.0 | MIT |
| execa | 5.1.1 | MIT |
| fast-glob | 3.3.3 | MIT |
| [fastq](https://github.com/mcollina/fastq) | 1.20.1 | ISC |
| fill-range | 7.1.1 | MIT |
| follow-redirects | 1.16.0 | MIT |
| get-stream | 6.0.1 | MIT |
| glob-parent | 5.1.2 | ISC |
| htmlparser2 | 10.1.0 | MIT |
| htmlparser2 | 12.0.0 | MIT |
| https-proxy-agent | 5.0.1 | MIT |
| human-signals | 2.1.0 | Apache-2.0 |
| iconv-lite | 0.6.3 | MIT |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| is-number | 7.0.0 | MIT |
| is-plain-object | 5.0.0 | MIT |
| is-stream | 2.0.1 | MIT |
| [isexe](https://github.com/isaacs/isexe) | 2.0.0 | ISC |
| [launder](https://github.com/apostrophecms/apostrophe) | 1.7.1 | MIT |
| merge-stream | 2.0.0 | MIT |
| merge2 | 1.4.1 | MIT |
| micromatch | 4.0.8 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mimic-fn | 2.1.0 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.18 | MIT |
| [nodejs-file-downloader](https://github.com/ibrod83/nodejs-file-downloader) | 4.13.0 | ISC |
| npm-run-path | 4.0.1 | MIT |
| [nth-check](https://github.com/fb55/nth-check) | 2.1.1 | BSD-2-Clause |
| onetime | 5.1.2 | MIT |
| [parse-srcset](https://github.com/albell/parse-srcset) | 1.0.2 | MIT |
| parse5 | 7.3.0 | MIT |
| parse5-htmlparser2-tree-adapter | 7.1.0 | MIT |
| parse5-parser-stream | 7.1.2 | MIT |
| path-key | 3.1.1 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 2.3.2 | MIT |
| postcss | 8.5.23 | MIT |
| q | 1.5.1 | MIT |
| queue-microtask | 1.2.3 | MIT |
| [reusify](https://github.com/mcollina/reusify) | 1.1.0 | MIT |
| run-parallel | 1.2.0 | MIT |
| [safer-buffer](https://github.com/ChALkeR/safer-buffer) | 2.1.2 | MIT |
| sanitize-filename | 1.6.4 | WTFPL OR ISC |
| [sanitize-html](https://github.com/apostrophecms/apostrophe) | 2.17.7 | MIT |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| shelljs | 0.10.0 | BSD-3-Clause |
| [signal-exit](https://github.com/tapjs/signal-exit) | 3.0.7 | ISC |
| source-map-js | 1.2.1 | BSD-3-Clause |
| strip-final-newline | 2.0.0 | MIT |
| to-regex-range | 5.0.1 | MIT |
| [truncate-utf8-bytes](https://github.com/parshap/truncate-utf8-bytes) | 1.0.2 | WTFPL |
| [undici](https://github.com/nodejs/undici) | 7.29.0 | MIT |
| [utf8-byte-length](https://github.com/parshap/utf8-byte-length) | 1.0.5 | (WTFPL OR MIT) |
| whatwg-encoding | 3.1.1 | MIT |
| whatwg-mimetype | 4.0.0 | MIT |
| which | 2.0.2 | ISC |
