# Mattermost File Preview plugin

Previews attachments that Mattermost only offers to download, inside its own file preview window:

- **CSV / TSV**: table with sticky header, sort by any column (numbers by value, `1.234,56` included), accent-insensitive filter and pages of 100 rows. Detects the separator (`;`, `,`, tab, `|`) and Windows-1252 files saved by Excel. Up to 20 MB.
- **ZIP**: folder tree with sizes, compressed sizes and dates, a filter over the full paths and a lock on password-protected entries. Only the archive's central directory is downloaded (HTTP range requests), so a 60 MB zip costs a few KB. Reads Zip64, UTF-8 names and the code page 850 names written by Windows.
- **HTML**: the page rendered, scripts included, with a tab for its source. Up to 10 MB.

Follows the user's theme and language (English and Spanish).

## How HTML pages are isolated

Most attached pages run scripts, often from a CDN. A `srcdoc` iframe would inherit Mattermost's
`script-src 'self'` and break them, so the server part serves the page at
`/plugins/com.github.adriadam10.file-preview/html/{file_id}` with
`Content-Security-Policy: sandbox allow-scripts …`. The page gets an opaque origin: its scripts
run, but cannot read Mattermost's cookies or local storage or call its API as the viewer. The
iframe carries the same `sandbox` attribute in case a proxy drops the header.

The route answers only to logged-in users with read access to the channel the file was posted
in, the same check as downloading it; anything else gets a 404.

## Build

Only Docker is needed:

```sh
./build.sh
# -> dist/com.github.adriadam10.file-preview-<version>.tar.gz
```

## CI and releases

- Every push and PR runs the tests and the build; the plugin `.tar.gz` is attached to the run as an artifact.
- Pushing a tag `vX.Y.Z` (matching `version` in `plugin.json`) publishes a GitHub release with the plugin.
- Dependabot checks npm, Go modules and GitHub Actions weekly. Patch/minor updates merge automatically once CI passes; majors wait for review.

## Install

System Console → Plugins → Plugin Management → Upload Plugin, or with `mmctl`:

```sh
mmctl plugin install-url https://github.com/adriadam10/mattermost-plugin-file-preview/releases/download/vX.Y.Z/com.github.adriadam10.file-preview-X.Y.Z.tar.gz
mmctl plugin enable com.github.adriadam10.file-preview
```

Requires Mattermost 12.0 or later. Works in the browser and the desktop app; the mobile apps keep their own previews.
