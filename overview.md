# Pipeline Tasks for Release & Documentation

Release engineering and documentation publishing tasks for Azure Pipelines: conventional-commit
changelog and version management, Markdown to HTML conversion, and ServiceNow knowledge base
publishing.

> **Status: scaffold.** No tasks are published in this extension yet. `Markdown2Html` and
> `PublishKbArticle` currently ship inside
> [Pipeline Tasks for Terraform](https://marketplace.visualstudio.com/items?itemName=sethbacon.pipeline-tasks-terraform)
> and are being moved here so that documentation-publishing threat classes — stored XSS in published
> HTML, ServiceNow query injection — can be versioned, reviewed and trusted separately from Terraform
> execution. This listing is stated as absent rather than described as if it existed.

## Planned tasks

| Task | What it does |
| --- | --- |
| `PipelineMarkdown2Html` | Converts Markdown to sanitised HTML for publication. |
| `PipelinePublishKbArticle` | Creates or updates a ServiceNow knowledge base article. |

Task names carry the `Pipeline` prefix so this extension installs side-by-side with the Terraform
extension during the migration.

## Requirements

- An Azure Pipelines agent with Node 24 (a `Node20_1` fallback handler is provided).
- The extension requests the `vso.build` scope only.

## Support

Source, issues and the security policy live at
[sethbacon/azure-pipelines-release-docs](https://github.com/sethbacon/azure-pipelines-release-docs).
Report suspected vulnerabilities privately via GitHub Security Advisories, not as a public issue.

Licensed under the Apache License 2.0.
