# Pipeline Tasks for Release & Documentation

Release engineering and documentation-publishing tasks for Azure Pipelines: conventional-commit
changelog and semantic-version management, Markdown to HTML conversion, and ServiceNow knowledge
base publishing.

`Markdown2Html` and `PublishKbArticle` were migrated out of
[Pipeline Tasks for Terraform](https://marketplace.visualstudio.com/items?itemName=sethbacon.pipeline-tasks-terraform)
so that documentation-publishing threat classes — stored XSS in published HTML, ServiceNow query
injection — are versioned, reviewed and trusted separately from Terraform execution.

This extension provides:

- **PipelineChangelog** -- Derive the next semantic version from conventional commits, update
  `CHANGELOG.md` and version files, and open or update a release pull request
- **PipelineMarkdown2Html** -- Convert Markdown files to HTML for publishing as ServiceNow
  knowledge base articles
- **PipelinePublishKbArticle** -- Publish or update a knowledge base article in ServiceNow

## Tasks

### PipelineChangelog

Reads conventional commits since the last release tag, computes the next semantic version, prepends
a release section to `CHANGELOG.md`, stamps version files, and opens or updates a release pull
request — the release-please shape, for a repository Azure DevOps hosts. Handles two Azure
DevOps-specific commit shapes release-please itself never has to: the `Merged PR 1234: ` squash-merge
subject prefix, and a pull-request description that Azure DevOps caps (and rejects rather than
truncates) at 4000 characters. Authenticates as the pipeline's own identity via `SystemVssConnection`.

### PipelineMarkdown2Html

Converts Markdown files to HTML for publishing as ServiceNow knowledge base articles — parses YAML
front matter, renders via `markdown-it` with `highlight.js` syntax highlighting, and resolves
`{% include %}`-style file includes. The rendered HTML is passed through a sanitizer as a
mutation-XSS hardening measure.

### PipelinePublishKbArticle

Publishes or updates a knowledge base article in ServiceNow — create, update, workflow-state
transition, and image-attachment sync with content-hash-based idempotency. A pre-publish security
gate rejects script tags, inline event-handler attributes, dangerous URI schemes, and other
stored-XSS vectors in the article body; those checks fail closed and are never bypassed by the
`force` input.

Task names carry the `Pipeline` prefix so this extension installs side-by-side with the Terraform
extension during the migration window.

## Requirements

- An Azure Pipelines agent with Node 24 (a `Node20_1` fallback handler is provided). Tested on
  Windows and Linux agents.
- The extension requests the `vso.build` scope only.

## Support

Source, issues and the security policy live at
[sethbacon/azure-pipelines-release-docs](https://github.com/sethbacon/azure-pipelines-release-docs).
Report suspected vulnerabilities privately via GitHub Security Advisories, not as a public issue.

Licensed under the Apache License 2.0.
