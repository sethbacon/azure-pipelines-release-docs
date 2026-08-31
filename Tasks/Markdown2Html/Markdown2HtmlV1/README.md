# Markdown to HTML Converter

### Overview

Converts Markdown files to HTML for publishing as ServiceNow knowledge base articles — parses YAML front matter, renders via `markdown-it` with `highlight.js` syntax highlighting, and resolves `{% include %}`-style file includes.

### Why this task does not depend on `@4cloudguru/pipeline-task-core`

Unlike ChangelogV1 (Azure DevOps REST API calls) and PublishKbArticleV1 (ServiceNow REST API calls), this task never makes an outbound network request. `mode: frontMatter` and `mode: filelist` both read local Markdown files, render and sanitize them in-process, and write a local HTML file — there is no HTTP client, no credential/token handling, and no egress to authorize. `@4cloudguru/pipeline-task-core` exists to share exactly those primitives (HTTP client, retry, egress allowlisting, URL secret redaction, proxy configuration) across tasks that have that surface; Markdown2HtmlV1 has none of it, so the dependency is deliberately omitted rather than an oversight.

### Known limitation: MathML and SVG foreign content is removed

As a mutation-XSS (mXSS) hardening measure, the HTML sanitizer **removes** MathML content (`<math>`, `<annotation-xml>`) and SVG foreign-content elements (`<foreignObject>`, `<mglyph>`, `<malignmark>`) from the rendered output, along with anything nested inside them. These are HTML-integration points that can smuggle active content past a sanitizer.

Real-world SVG exports from tools such as mermaid and draw.io use `<foreignObject>` to embed HTML labels, so those labels are stripped during conversion. If diagram text must survive conversion, export diagrams using plain SVG `<text>` elements instead of `<foreignObject>` HTML labels.
