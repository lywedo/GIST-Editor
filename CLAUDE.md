# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gist Editor is a VS Code extension that enables users to manage GitHub Gists directly from VS Code. Users can create, view, edit, and save gists without leaving the editor. The extension features a hierarchical folder organization system, drag-and-drop support, tagging, search capabilities, and three sidebar views: personal gists, starred gists, and comments.

## Architecture Overview

### Core Services

**GitHubService** ([src/githubService.ts](src/githubService.ts))
- Singleton service managing all GitHub API interactions via axios
- Handles authentication via VS Code's built-in GitHub OAuth (`vscode.authentication.getSession()`)
- Supports manual token entry as fallback (backwards compatibility)
- Tracks API usage statistics and rate limits via axios interceptors
- API methods: `getMyGists()`, `getStarredGists()`, `getGist()`, `createGist()`, `updateGist()`, `deleteGist()`, `getGistComments()`, `starGist()`, `unstarGist()`, `getOAuthToken()`, `getCurrentUsername()`

**TagsManager** ([src/tagsManager.ts](src/tagsManager.ts))
- Manages tags stored in special gist comments marked with `[GIST_TAGS]`
- Tags formatted as `[tag:tagname]` and synced to GitHub automatically
- Provides event emitter (`onTagsChanged`) for cache invalidation
- Methods: `getTags()`, `addTag()`, `removeTag()`, `clearTags()`

### Folder Organization System

**GistDescriptionParser** ([src/gistDescriptionParser.ts](src/gistDescriptionParser.ts))
- Parses gist descriptions using pattern: `"Folder/SubFolder - Display Name"`
- Example: `"React/Components - Button Component"` → folder path: `['React', 'Components']`, display name: `"Button Component"`
- Provides utility functions: `parseGistDescription()`, `createGistDescription()`, `areFolderPathsEqual()`, `isPathChild()`, `getFolderPathString()`

**GistFolderBuilder** ([src/gistFolderBuilder.ts](src/gistFolderBuilder.ts))
- Transforms flat list of gists into hierarchical folder tree structure
- Builds parent-child relationships from parsed folder paths
- Returns `FolderTreeResult` containing folder tree, ungrouped gists, and gist-to-folder mapping
- Main method: `buildFolderTree(gists: Gist[])`

### Providers

**GistProvider** ([src/providers/gistProvider.ts](src/providers/gistProvider.ts))
- Implements `TreeDataProvider` for displaying gists in tree views
- Instantiated twice: once for "my gists" and once for "starred gists"
- Implements drag-and-drop controller for reorganizing gists and moving files between gists
- Maintains caches: folder tree, ungrouped gists, comments, tags, gist-to-folder mapping
- Groups gists by public/private visibility, then organizes by folder hierarchy
- Cache invalidation via `refresh()` method

**GistFileSystemProvider** ([src/providers/gistFileSystem.ts](src/providers/gistFileSystem.ts))
- Implements `FileSystemProvider` for custom `gist://` URI scheme
- Format: `gist://{gistId}/{filename}`
- Enables reading and writing gist files as virtual filesystem
- Maintains in-memory cache to reduce API calls
- Cache invalidation via `invalidateCache()` after writes

**CommentProvider** ([src/providers/commentProvider.ts](src/providers/commentProvider.ts))
- Tree data provider for displaying gist comments
- Listens for gist selection events to load comments for selected gist
- Filters out special tags comments (marked with `[GIST_TAGS]`)

**GistItem** ([src/providers/gistItem.ts](src/providers/gistItem.ts))
- Tree item representing gists, folders, files, or visibility groups
- Supports context values: `gist`, `gistFile`, `gistFolder`, `publicGroup`, `privateGroup`
- Handles tooltip generation with tags, descriptions, and folder information

### Command Organization

Commands are modularized in `src/commands/` directory and registered in [src/extension.ts](src/extension.ts):

- **Basic** ([src/commands/basic/basicCommands.ts](src/commands/basic/basicCommands.ts)): `helloWorld`, `refresh`
- **Auth** ([src/commands/auth/authentication.ts](src/commands/auth/authentication.ts)): `setupToken`, `testAPI`, `checkScopes`, `viewApiUsage`
- **Gist** ([src/commands/gist/gistOperations.ts](src/commands/gist/gistOperations.ts)): `createGist`, `createGistFromFile`, `createGistFromSelection`, `openGist`, `deleteGist`, `renameGist`, `toggleStarGist`, `viewGistHistory`, `openInGitHub`
- **File** ([src/commands/file/fileOperations.ts](src/commands/file/fileOperations.ts)): `addFileToGist`, `deleteFileFromGist`, `renameFileInGist`, `saveGist`
- **Folder** ([src/commands/folder/folderOperations.ts](src/commands/folder/folderOperations.ts)): `createSubfolderInFolder`, `renameFolder`, `addGistToFolder`
- **Comment** ([src/commands/comment/commentOperations.ts](src/commands/comment/commentOperations.ts)): `addGistComment`, `deleteGistComment`, `viewGistCommentOnGitHub`
- **Tag** ([src/commands/tags/tagOperations.ts](src/commands/tags/tagOperations.ts)): `addTag`, `removeTag`, `clearTags`
- **Search** ([src/commands/search/search.ts](src/commands/search/search.ts)): `search` with fuzzy matching, filtering, and caching

### Search System

**SearchProvider** ([src/searchProvider.ts](src/searchProvider.ts))
- Implements fuzzy search across gist names, descriptions, file names, content, and tags
- Supports multiple match types with different scoring weights
- Filters: language, visibility (public/private), folder path, tags
- Results ranked by relevance with preview and line numbers
- Search results cached via `SearchCache` in extension context

### URI Scheme and File Operations

The extension uses `gist://` URI scheme with format: `gist://{gistId}/{filename}`
- Files opened via `GistFileSystemProvider.readFile()`
- Auto-save triggers `GistFileSystemProvider.writeFile()` which updates GitHub via `GitHubService.updateGist()`
- Language detection via `getLanguageId()` from file extension or GitHub metadata ([src/utils/languageDetection.ts](src/utils/languageDetection.ts))

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

# Compile tests
npm run compile-tests

# Run tests
npm run test

# Build for production (minified)
npm run package
```

## Building and Debugging

**Development Workflow:**
1. Run `npm run watch` to enable concurrent TypeScript type checking and esbuild bundling
2. Press F5 in VS Code to launch the Extension Development Host
3. Changes auto-compile; reload the extension host window to test changes

**Production Build:**
- `npm run package` creates minified production bundle at `dist/extension.js`
- esbuild bundles all TypeScript files except `vscode` module (external)

## Testing

- Test files located in `src/test/` directory
- Comprehensive tests for all command modules, helpers, and utilities
- Run with: `npm run test` (uses `@vscode/test-cli`)
- Test structure mirrors `src/` directory structure
- Mock implementations in `src/test/mocks/`

## Authentication System

**OAuth Flow (Primary):**
- User clicks "Sign in with GitHub" → browser opens for GitHub login
- VS Code handles OAuth redirect and token storage via authentication API
- Token retrieved via `vscode.authentication.getSession('github', ['gist'], { createIfNone: true })`

**Manual Token Entry (Fallback):**
- Token stored in `gistEditor.githubToken` VS Code setting (global scope)
- Validated on input (must start with `ghp_` or `github_pat_`)

**Setup Token Command:**
- Quick pick menu with options: "Sign in with GitHub", "Use Personal Access Token", "Sign Out"
- Commands automatically trigger OAuth if not authenticated

## Key Implementation Notes

1. **Folder Hierarchy**: Gist descriptions use `"Path/To/Folder - Display Name"` format. Parser extracts folder path for tree building. Folder operations (rename, create gist in folder) update multiple gist descriptions in batch.

2. **Drag and Drop**: `GistProvider` implements drag-and-drop for moving gists between folders and files between gists. Uses MIME type `application/vnd.code.tree-gistItem` for data transfer.

3. **Caching Strategy**: Multiple caches used to reduce API calls:
   - `GistFileSystemProvider`: Gist content cache
   - `GistProvider`: Folder tree, ungrouped gists, comments, tags
   - `SearchCache`: Search results cache (invalidated on tag/gist changes)

4. **API Usage Tracking**: `GitHubService` tracks API calls via axios interceptors, categorizes by operation type (gists, comments, history, stars, user info), and provides usage statistics with rate limit info.

5. **Tags System**: Tags stored in special comment with `[GIST_TAGS]` marker. Tags formatted as `[tag:tagname]`. TagsManager handles CRUD operations and fires events for cache invalidation.

6. **Search Performance**: Search implements caching, parallel tag fetching, and debouncing (300ms) for optimal performance. Fuzzy matching with multiple scoring strategies (exact, substring, fuzzy).

7. **Language Detection**: 100+ file types supported via extension-to-language-id mapping in `src/utils/languageDetection.ts`. Supports web, programming languages, data formats, documentation, and infrastructure files.

## Build Output

- Entry point: `src/extension.ts`
- Output: `dist/extension.js` (CommonJS format, bundled with esbuild)
- External dependency: `vscode` module (provided by VS Code runtime)
- Target: ES2022, Node16 module resolution
