# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gist Editor is a VS Code extension that enables users to manage GitHub Gists directly from VS Code. Users can create, view, edit, and save gists without leaving the editor. The extension displays gists in two sidebar views: personal gists and starred gists.

## Architecture Overview

### Core Components

**GitHubService** ([src/githubService.ts](src/githubService.ts))
- Singleton service that manages all GitHub API interactions
- Handles authentication via personal access tokens (stored in VS Code global config)
- API methods: `getMyGists()`, `getStarredGists()`, `getGist()`, `createGist()`, `updateGist()`, `deleteGist()`
- Token is stored securely in `gistEditor.githubToken` VS Code configuration

**GistContentProvider** ([src/extension.ts:7-49](src/extension.ts#L7-L49))
- Custom `TextDocumentContentProvider` for the custom `gist://` URI scheme
- Provides file content when users open gist files
- Maintains an in-memory cache of gists to reduce API calls
- Cache is invalidated when files are saved

**Tree View System** ([src/extension.ts:51-173](src/extension.ts#L51-L173))
- `GistProvider`: Tree data provider implementing two instances (my gists, starred gists)
- `GistItem`: Tree items representing either a gist container or an individual file within a gist
- Handles lazy-loading and display of gist files when expanded
- Shows authentication prompt if token not configured

**Command Registration** ([src/extension.ts:200-1216](src/extension.ts#L200-L216))
- Multiple commands for gist operations (create, open, save, manage token)
- Command implementations include UI flows with quick picks and input boxes
- Auto-save functionality triggered by document save events for gist:// files
- Language/syntax highlighting detection using two strategies:
  1. GitHub's language detection from API
  2. File extension-based fallback (extensive mapping for 40+ languages)

### URI Scheme

The extension uses a custom `gist://` URI scheme with format: `gist://{gistId}/{filename}`
- When opened, content is loaded on-demand via `GistContentProvider`
- Saving triggers `updateGist()` and invalidates cache
- Language detection is applied based on file extension and GitHub metadata

## Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript and build with esbuild
npm run compile

# Watch mode (concurrent TypeScript checking and esbuild)
npm run watch

# Type checking only
npm run check-types

# Linting
npm run lint

# Run tests
npm run test

# Build for production (minified)
npm run package
```

## Building and Debugging

**Development Workflow:**
1. Run `npm run watch` to enable concurrent compilation and esbuild watching
2. Press F5 in VS Code to launch the extension in a debug session
3. Changes will auto-compile and can be tested via reload

**Production Build:**
- `npm run package` creates minified output for distribution

## Testing

- Test file: [src/test/extension.test.ts](src/test/extension.test.ts)
- Currently contains placeholder tests
- Run with: `npm run test`
- Tests use VS Code's test CLI (`@vscode/test-cli`)
- Existing tests validate sample array operations; expand as needed

## Key Configuration

**VS Code Settings** (from `package.json`)
- `gistEditor.githubToken`: Global setting storing GitHub Personal Access Token
- Token is validated on input (must start with `ghp_` or `github_pat_`)
- Configuration target: `GlobalStorage` (user-level, not workspace)

**Extension Activation**
- Currently uses `activationEvents: []` (lazy activation)
- Extension activates on first command execution

## Important Implementation Notes

1. **Caching Strategy**: The `GistContentProvider` caches gists in memory. Cache is manually invalidated after save operations via `invalidateCache()`.

2. **Language Detection**: The `getLanguageId()` and `getLanguageFromExtension()` functions maintain comprehensive language-to-VSCode-ID mappings (50+ languages).

3. **Error Handling**: API errors are caught and displayed to users via `showErrorMessage()`. Console logs provide debugging info.

4. **UI Flows**: Multi-step dialogs for gist creation (quick pick for method → input for description → quick pick for visibility).

5. **Auto-save**: Document save events trigger automatic gist updates to GitHub without user confirmation (via `onDidSaveTextDocument` listener).

6. **Partial Token Display**: Token status masks tokens for security (shows first 8 + last 4 chars).

## File Extension Detection

The extension handles 100+ file types with language detection. Check the `getLanguageFromExtension()` map for supported formats spanning:
- Web technologies (HTML, CSS, SCSS, Less, Vue, Svelte)
- Programming languages (JavaScript, Python, Java, Go, Rust, etc.)
- Data formats (JSON, YAML, TOML, XML)
- Documentation (Markdown, LaTeX, AsciiDoc)
- Infrastructure (Dockerfile, Terraform, HCL)
- And many more

## Build Output

- Entry point: `src/extension.ts`
- Output: `dist/extension.js` (CommonJS, bundled with esbuild)
- External dependency (not bundled): `vscode` module
