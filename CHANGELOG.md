# Changelog

> **0.1.0 through 0.1.6 were never released.** Each exists only as a *draft* GitHub Release, and
> GitHub does not create a Git tag for a draft, so this repository has no tags at all
> (`git ls-remote --tags origin` is empty). Unable to find a previous release to anchor on,
> release-please re-read the whole history on every run: that is why the same commits appear under
> every heading below, why the `compare/v0.1.5...v0.1.6` links do not resolve, and why the version
> advanced on pushes that shipped nothing. `force-tag-creation` is now set alongside `draft` in
> `.release-please-config.json`, so the next release cuts a real tag and the entry after this one
> lists only new commits. Nothing was ever published to the Visual Studio Marketplace under any of
> these versions.

## [1.1.1](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v1.1.0...v1.1.1) (2026-09-04)


### Bug Fixes

* centralize the Marketplace publish and close [#23](https://github.com/sethbacon/azure-pipelines-release-docs/issues/23) for this job ([#170](https://github.com/sethbacon/azure-pipelines-release-docs/issues/170)) ([d5dea3f](https://github.com/sethbacon/azure-pipelines-release-docs/commit/d5dea3fc89a6f46200159058c80799297c7f3566))
* stop tfx's routine preamble from masking a real publish failure ([#168](https://github.com/sethbacon/azure-pipelines-release-docs/issues/168)) ([7a1a526](https://github.com/sethbacon/azure-pipelines-release-docs/commit/7a1a526903300376b5033fda69e4b7e123e871a0))

## [1.1.0](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v1.0.2...v1.1.0) (2026-08-31)


### Features

* **ci:** adopt the shared Dependabot CI-health check ([#154](https://github.com/sethbacon/azure-pipelines-release-docs/issues/154)) ([a997061](https://github.com/sethbacon/azure-pipelines-release-docs/commit/a9970614e9d37ede8f026bf7fbbf3c92009b77d7))


### Bug Fixes

* **release-docs:** reconcile drifted task metadata and prune dead coverage-gate entries ([#147](https://github.com/sethbacon/azure-pipelines-release-docs/issues/147)) ([de1b130](https://github.com/sethbacon/azure-pipelines-release-docs/commit/de1b1303115dc51a62b2d140331575960415e9e0))
* **security:** close early-throw and git argv gaps in release-docs tasks ([#151](https://github.com/sethbacon/azure-pipelines-release-docs/issues/151)) ([7ea15f1](https://github.com/sethbacon/azure-pipelines-release-docs/commit/7ea15f1a8bddab37421d1b40990179f44a401409))
* **security:** correct error-handling gaps in ChangelogV1/PublishKbArticleV1 ([#126](https://github.com/sethbacon/azure-pipelines-release-docs/issues/126), [#130](https://github.com/sethbacon/azure-pipelines-release-docs/issues/130)) ([#155](https://github.com/sethbacon/azure-pipelines-release-docs/issues/155)) ([8a11b11](https://github.com/sethbacon/azure-pipelines-release-docs/commit/8a11b113e05fd931c65a8b0f10e8d3f80b5a13e5))
* **security:** document converter.ts containment decision, add getKbCategories injection test ([#123](https://github.com/sethbacon/azure-pipelines-release-docs/issues/123), [#127](https://github.com/sethbacon/azure-pipelines-release-docs/issues/127)) ([#157](https://github.com/sethbacon/azure-pipelines-release-docs/issues/157)) ([f409395](https://github.com/sethbacon/azure-pipelines-release-docs/commit/f409395a4e01e9867c34255b468c33428bdd7060))
* **security:** reject unrecognized PublishKbArticle service-connection auth schemes ([#148](https://github.com/sethbacon/azure-pipelines-release-docs/issues/148)) ([b49c88e](https://github.com/sethbacon/azure-pipelines-release-docs/commit/b49c88ea790acccb2e99f7f10056ce70f8d195f6))
* **security:** scope path containment to content-supplied paths only ([#145](https://github.com/sethbacon/azure-pipelines-release-docs/issues/145)) ([4a4900d](https://github.com/sethbacon/azure-pipelines-release-docs/commit/4a4900debbfdadb1f0e56796649d953807c896bb))
* **security:** wire coverage into CI, document README credentials, populate PROVENANCE ([#125](https://github.com/sethbacon/azure-pipelines-release-docs/issues/125), [#128](https://github.com/sethbacon/azure-pipelines-release-docs/issues/128), [#129](https://github.com/sethbacon/azure-pipelines-release-docs/issues/129)) ([#158](https://github.com/sethbacon/azure-pipelines-release-docs/issues/158)) ([898f7e1](https://github.com/sethbacon/azure-pipelines-release-docs/commit/898f7e1ad60f282d7c903ebe88905ab96a8f4512))


### Documentation

* **security:** document manifestPath's operator-only provenance ([#159](https://github.com/sethbacon/azure-pipelines-release-docs/issues/159)) ([711f079](https://github.com/sethbacon/azure-pipelines-release-docs/commit/711f0790cad81bf25ee1a8e45132f107012a493f))
* **security:** reflect the marketplace environment's resolved self-review decision ([#152](https://github.com/sethbacon/azure-pipelines-release-docs/issues/152)) ([5c6021d](https://github.com/sethbacon/azure-pipelines-release-docs/commit/5c6021d2abc8377a658e7e7d7ae67332c95151d0))
* update overview, SECURITY, and README for the implemented extension ([#149](https://github.com/sethbacon/azure-pipelines-release-docs/issues/149)) ([6ed951e](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6ed951e4e5d7f05235a2b2a1ba4c581f016dfa10))

## [1.0.2](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v1.0.1...v1.0.2) (2026-08-28)


### Bug Fixes

* **gates:** bound the proxy-parity walk by ROOT, not by the script's own location ([#144](https://github.com/sethbacon/azure-pipelines-release-docs/issues/144)) ([d579a80](https://github.com/sethbacon/azure-pipelines-release-docs/commit/d579a80ab73270769395baf0a89c3392b67f0c6d))
* **release:** stop piping gh into head, which exits 141 and leaves the release drafted ([#142](https://github.com/sethbacon/azure-pipelines-release-docs/issues/142)) ([5acffc8](https://github.com/sethbacon/azure-pipelines-release-docs/commit/5acffc8b8b29d5bea071d21938fbc9f94c90b0a3))
* symlink-aware path containment for Markdown2Html/PublishKbArticle ([#141](https://github.com/sethbacon/azure-pipelines-release-docs/issues/141)) ([da4fd47](https://github.com/sethbacon/azure-pipelines-release-docs/commit/da4fd4741ed8cf991525c18a18fc05cbc19f09b5))

## [1.0.1](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v1.0.0...v1.0.1) (2026-08-27)


### Bug Fixes

* **security:** correct false egress-policy claims for release-please/replay ([#23](https://github.com/sethbacon/azure-pipelines-release-docs/issues/23)) ([#139](https://github.com/sethbacon/azure-pipelines-release-docs/issues/139)) ([f4fca69](https://github.com/sethbacon/azure-pipelines-release-docs/commit/f4fca69b21520564376deb011c7817a64da27e1d))
* **security:** give the egress-authorization gate real sink coverage ([#124](https://github.com/sethbacon/azure-pipelines-release-docs/issues/124)) ([#138](https://github.com/sethbacon/azure-pipelines-release-docs/issues/138)) ([779e041](https://github.com/sethbacon/azure-pipelines-release-docs/commit/779e041f1dd3c51a073a761761e5a7f48452a1b4))

## [1.0.0](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.2.3...v1.0.0) (2026-08-25)


### Bug Fixes

* **ci:** adopt packer's check-minor-bumps, which detects runtime dependency changes ([#116](https://github.com/sethbacon/azure-pipelines-release-docs/issues/116)) ([af2c462](https://github.com/sethbacon/azure-pipelines-release-docs/commit/af2c4628fa77e4e7f26730d08e755ff99e0f63cd))
* **ci:** resolve a delegated sink's origin before attributing it to a package ([#118](https://github.com/sethbacon/azure-pipelines-release-docs/issues/118)) ([8d856e9](https://github.com/sethbacon/azure-pipelines-release-docs/commit/8d856e9148c4aeae973dca3e0234990514f3c4fe))


### Chores

* **release:** declare 1.0.0 ([#121](https://github.com/sethbacon/azure-pipelines-release-docs/issues/121)) ([b6b6c70](https://github.com/sethbacon/azure-pipelines-release-docs/commit/b6b6c70ac5b83d61aafb9ee324101ce4a70e8646))

## [0.2.3](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.2.2...v0.2.3) (2026-08-24)


### Bug Fixes

* **test:** stop a symlink failure from turning into a suite failure ([#114](https://github.com/sethbacon/azure-pipelines-release-docs/issues/114)) ([5bb0b32](https://github.com/sethbacon/azure-pipelines-release-docs/commit/5bb0b32e1c4c858e9b868c8f0b3d708901d803ae))

## [0.2.2](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.2.1...v0.2.2) (2026-08-24)


### Bug Fixes

* **gates:** adopt the cross-file resolution the sibling gate already has ([#111](https://github.com/sethbacon/azure-pipelines-release-docs/issues/111)) ([4d6318d](https://github.com/sethbacon/azure-pipelines-release-docs/commit/4d6318da1a93e1d161fab4c5111dd94b24082010)), closes [#108](https://github.com/sethbacon/azure-pipelines-release-docs/issues/108)

## [0.2.1](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.2.0...v0.2.1) (2026-08-24)


### Bug Fixes

* **gates:** report how many source files were read, not just what was found ([#106](https://github.com/sethbacon/azure-pipelines-release-docs/issues/106)) ([79803f5](https://github.com/sethbacon/azure-pipelines-release-docs/commit/79803f55f2bc60bca3aeb7298021bc877f44beeb))
* **security:** validate the boundaries the suite replay found unguarded ([#110](https://github.com/sethbacon/azure-pipelines-release-docs/issues/110)) ([d633658](https://github.com/sethbacon/azure-pipelines-release-docs/commit/d6336583011d223bdfaa4bf538a4aa047d5c87ce))


### Documentation

* record the OIDC subject that differs from the siblings' ([#104](https://github.com/sethbacon/azure-pipelines-release-docs/issues/104)) ([22c6efb](https://github.com/sethbacon/azure-pipelines-release-docs/commit/22c6efb87401603242973e9832a5274c5302228f))

## [0.2.0](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.6...v0.2.0) (2026-08-24)


### Features

* build the release and marketplace publish path ([#63](https://github.com/sethbacon/azure-pipelines-release-docs/issues/63)) ([492ab4c](https://github.com/sethbacon/azure-pipelines-release-docs/commit/492ab4c36bd66cccb2eb5202ce0f9c3598c5f782)), closes [#26](https://github.com/sethbacon/azure-pipelines-release-docs/issues/26) [#57](https://github.com/sethbacon/azure-pipelines-release-docs/issues/57) [#27](https://github.com/sethbacon/azure-pipelines-release-docs/issues/27)
* **changelog:** add the release task this extension is named for ([#103](https://github.com/sethbacon/azure-pipelines-release-docs/issues/103)) ([eff32af](https://github.com/sethbacon/azure-pipelines-release-docs/commit/eff32afa89a153499e677203e87fbea3d2fa5be7))
* **ci:** gate the two sanitizer modules that already claimed to be gated ([#91](https://github.com/sethbacon/azure-pipelines-release-docs/issues/91)) ([122779c](https://github.com/sethbacon/azure-pipelines-release-docs/commit/122779c790688c872c73004bca2caf75393b1f9b))
* **ci:** one version gate for all three extensions, with the checks each was missing ([#90](https://github.com/sethbacon/azure-pipelines-release-docs/issues/90)) ([4233c46](https://github.com/sethbacon/azure-pipelines-release-docs/commit/4233c46a040ed4c6c10b3db05405202495b24062))
* **ci:** take the shared security and hardening definitions, and stop forking the gate ([#94](https://github.com/sethbacon/azure-pipelines-release-docs/issues/94)) ([f3522d7](https://github.com/sethbacon/azure-pipelines-release-docs/commit/f3522d7ca891e43ddd8bf7edb8da1ea0f2821c60))
* migrate Markdown2Html and PublishKbArticle in from the Terraform extension ([#71](https://github.com/sethbacon/azure-pipelines-release-docs/issues/71)) ([de548dd](https://github.com/sethbacon/azure-pipelines-release-docs/commit/de548dd30b7d2c898498bec3cd8dab55cccdb54b))
* **release:** give each task its own SBOM, and check that before the tag ([#99](https://github.com/sethbacon/azure-pipelines-release-docs/issues/99)) ([9a6057c](https://github.com/sethbacon/azure-pipelines-release-docs/commit/9a6057c31574c7480365b22d2140d2e2def5564d))


### Bug Fixes

* **ci:** refuse to run signature-replay when Dependabot edited the workflow ([#67](https://github.com/sethbacon/azure-pipelines-release-docs/issues/67)) ([9ea5c6b](https://github.com/sethbacon/azure-pipelines-release-docs/commit/9ea5c6b794eeee3b2b077e92c3e3ca073719c94c))
* **ci:** reject a provenance marker declared twice ([#93](https://github.com/sethbacon/azure-pipelines-release-docs/issues/93)) ([e32ac58](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e32ac58c8a5faa5c0ef0398acb040058637d43a4))
* **ci:** repair the mojibake introduced when the gates were ported ([#87](https://github.com/sethbacon/azure-pipelines-release-docs/issues/87)) ([10b2ed3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/10b2ed3b6484a1d48ab543163c91e4d58b22f7ea))
* **ci:** run the class signatures this repository already carries ([#88](https://github.com/sethbacon/azure-pipelines-release-docs/issues/88)) ([d79b252](https://github.com/sethbacon/azure-pipelines-release-docs/commit/d79b252a0778275e24af437a716e804d797b66ca))
* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))
* **release:** a slow validation is not a failed publish ([#68](https://github.com/sethbacon/azure-pipelines-release-docs/issues/68)) ([93a380d](https://github.com/sethbacon/azure-pipelines-release-docs/commit/93a380dde8b38260aa6f96b11716606d1924548b))
* **release:** create the tag, so the release pipeline can actually start ([#100](https://github.com/sethbacon/azure-pipelines-release-docs/issues/100)) ([95444d6](https://github.com/sethbacon/azure-pipelines-release-docs/commit/95444d63b46c7b395b5e8f4bc9c40a2241aa381f))


### Dependencies

* bump actions/checkout ([#86](https://github.com/sethbacon/azure-pipelines-release-docs/issues/86)) ([e4f53d3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e4f53d3d04d10f2e3e50b133be6afc5d3de0080a))
* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))
* bump step-security/harden-runner from 2.20.0 to 2.21.0 ([#14](https://github.com/sethbacon/azure-pipelines-release-docs/issues/14)) ([6eececf](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6eececf29897159bc95061ddccfb7ba5709fc84a))
* bump tfx-cli from 0.23.2 to 0.23.4 in the dev-dependencies group ([#10](https://github.com/sethbacon/azure-pipelines-release-docs/issues/10)) ([405dc77](https://github.com/sethbacon/azure-pipelines-release-docs/commit/405dc772a63fe92535ad2b5c1e74f4bd411759fc))
* bump the github-actions-dependencies group across 1 directory with 4 updates ([#66](https://github.com/sethbacon/azure-pipelines-release-docs/issues/66)) ([ba8a356](https://github.com/sethbacon/azure-pipelines-release-docs/commit/ba8a356138fd95b450571e088ba7b156b5a45cd3))
* bump the markdown2html-dependencies group across 1 directory with 7 updates ([#97](https://github.com/sethbacon/azure-pipelines-release-docs/issues/97)) ([465670c](https://github.com/sethbacon/azure-pipelines-release-docs/commit/465670ce74916214f8db68ab8ef23bad21ad2a05))
* bump the publishkbarticle-dependencies group across 1 directory with 6 updates ([#98](https://github.com/sethbacon/azure-pipelines-release-docs/issues/98)) ([c946f0e](https://github.com/sethbacon/azure-pipelines-release-docs/commit/c946f0e3fd6f82b7b5fbbc085dffa8cda2c05a00))


### Documentation

* correct the package scope, the moved repo link and the release claim ([#9](https://github.com/sethbacon/azure-pipelines-release-docs/issues/9)) ([6060b84](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6060b84b4726beae5bb49ec0b7d1b1fadfdf70a6))
* record the cutover window, which this file said was undecided ([#101](https://github.com/sethbacon/azure-pipelines-release-docs/issues/101)) ([b52a59f](https://github.com/sethbacon/azure-pipelines-release-docs/commit/b52a59f99e5eafa6d868edf0796f84af1a1af20c))
* **security:** record the shared-workflow trust relationship, and fix what it invalidated ([#77](https://github.com/sethbacon/azure-pipelines-release-docs/issues/77)) ([65a1db8](https://github.com/sethbacon/azure-pipelines-release-docs/commit/65a1db8ee3eec4af82c5ca12bc5e0bd11e1d66b1))
* state the supply-chain controls this repo actually has, and gate the claim ([#61](https://github.com/sethbacon/azure-pipelines-release-docs/issues/61)) ([6e8e4fe](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6e8e4feedf622e7909224990979c32f5ae4fda8f))


### Refactor

* **ci:** make the publish script one file again, not three headers ([#92](https://github.com/sethbacon/azure-pipelines-release-docs/issues/92)) ([aa9e485](https://github.com/sethbacon/azure-pipelines-release-docs/commit/aa9e4859ff660420019c3773c3825806ed752666))
* **ci:** take the sibling's CI-job section, the one this file said to port ([#95](https://github.com/sethbacon/azure-pipelines-release-docs/issues/95)) ([b653129](https://github.com/sethbacon/azure-pipelines-release-docs/commit/b6531290b525ef32d285e063b53879b98fe33b19))


### Security

* close the ten zizmor findings, and make the gate able to fail ([#79](https://github.com/sethbacon/azure-pipelines-release-docs/issues/79)) ([2b42d5e](https://github.com/sethbacon/azure-pipelines-release-docs/commit/2b42d5ed7d47e1719e6d0a69a402dfbedd76ea6f))
* compose the .vsix by allowlist and gate what would ship ([#60](https://github.com/sethbacon/azure-pipelines-release-docs/issues/60)) ([dc9a83d](https://github.com/sethbacon/azure-pipelines-release-docs/commit/dc9a83ddbc80491630afb866482be43001817464))
* enforce the workflow-hardening conventions, and end the replay token's life before foreign code runs ([#64](https://github.com/sethbacon/azure-pipelines-release-docs/issues/64)) ([35bc549](https://github.com/sethbacon/azure-pipelines-release-docs/commit/35bc549f66ddcd9387a00f061600fa9be9c01a8c))
* guard the squash, the update scope, the npm spawn and the advisory layer ([#65](https://github.com/sethbacon/azure-pipelines-release-docs/issues/65)) ([422f3fa](https://github.com/sethbacon/azure-pipelines-release-docs/commit/422f3fa9536749df2fc0793db719e4c52eaa974f)), closes [#49](https://github.com/sethbacon/azure-pipelines-release-docs/issues/49) [#25](https://github.com/sethbacon/azure-pipelines-release-docs/issues/25) [#45](https://github.com/sethbacon/azure-pipelines-release-docs/issues/45) [#58](https://github.com/sethbacon/azure-pipelines-release-docs/issues/58)
* make the required gates fail when they examine nothing ([#62](https://github.com/sethbacon/azure-pipelines-release-docs/issues/62)) ([9dddb3f](https://github.com/sethbacon/azure-pipelines-release-docs/commit/9dddb3f00e0afd35f82d51d3ad48c689b125179e)), closes [#44](https://github.com/sethbacon/azure-pipelines-release-docs/issues/44) [#39](https://github.com/sethbacon/azure-pipelines-release-docs/issues/39) [#38](https://github.com/sethbacon/azure-pipelines-release-docs/issues/38) [#20](https://github.com/sethbacon/azure-pipelines-release-docs/issues/20) [#54](https://github.com/sethbacon/azure-pipelines-release-docs/issues/54) [#56](https://github.com/sethbacon/azure-pipelines-release-docs/issues/56) [#43](https://github.com/sethbacon/azure-pipelines-release-docs/issues/43)

## [0.1.6](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.5...v0.1.6) (2026-08-19)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))
* bump step-security/harden-runner from 2.20.0 to 2.21.0 ([#14](https://github.com/sethbacon/azure-pipelines-release-docs/issues/14)) ([6eececf](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6eececf29897159bc95061ddccfb7ba5709fc84a))
* bump tfx-cli from 0.23.2 to 0.23.4 in the dev-dependencies group ([#10](https://github.com/sethbacon/azure-pipelines-release-docs/issues/10)) ([405dc77](https://github.com/sethbacon/azure-pipelines-release-docs/commit/405dc772a63fe92535ad2b5c1e74f4bd411759fc))


### Documentation

* correct the package scope, the moved repo link and the release claim ([#9](https://github.com/sethbacon/azure-pipelines-release-docs/issues/9)) ([6060b84](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6060b84b4726beae5bb49ec0b7d1b1fadfdf70a6))

## [0.1.5](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.4...v0.1.5) (2026-08-19)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))
* bump step-security/harden-runner from 2.20.0 to 2.21.0 ([#14](https://github.com/sethbacon/azure-pipelines-release-docs/issues/14)) ([6eececf](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6eececf29897159bc95061ddccfb7ba5709fc84a))
* bump tfx-cli from 0.23.2 to 0.23.4 in the dev-dependencies group ([#10](https://github.com/sethbacon/azure-pipelines-release-docs/issues/10)) ([405dc77](https://github.com/sethbacon/azure-pipelines-release-docs/commit/405dc772a63fe92535ad2b5c1e74f4bd411759fc))


### Documentation

* correct the package scope, the moved repo link and the release claim ([#9](https://github.com/sethbacon/azure-pipelines-release-docs/issues/9)) ([6060b84](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6060b84b4726beae5bb49ec0b7d1b1fadfdf70a6))

## [0.1.4](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.3...v0.1.4) (2026-08-13)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))

## [0.1.3](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.2...v0.1.3) (2026-08-12)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))

## [0.1.2](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.1...v0.1.2) (2026-08-12)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))

## [0.1.1](https://github.com/sethbacon/azure-pipelines-release-docs/compare/v0.1.0...v0.1.1) (2026-08-12)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))

## 0.1.0 (2026-08-12)


### Bug Fixes

* **ci:** use pull_request, not pull_request_target ([6331ea3](https://github.com/sethbacon/azure-pipelines-release-docs/commit/6331ea360bc8f2ef44b0f3aa59ad219c40a7cde3))


### Dependencies

* bump step-security/harden-runner from 2.20.0 to 2.20.1 ([#2](https://github.com/sethbacon/azure-pipelines-release-docs/issues/2)) ([e2df398](https://github.com/sethbacon/azure-pipelines-release-docs/commit/e2df39853844345632a8b4cd8def2eb187163ca6))
