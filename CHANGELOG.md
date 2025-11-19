# Change Log

All notable changes to the "gist-editor" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **🔐 OAuth Session Sharing**: Fixed shared session feature to properly restore GitHub authentication across all VS Code instances
  - Session restoration now properly awaits initialization before any API calls
  - Added session initialization tracking to prevent race conditions
  - Idempotent session loading prevents multiple simultaneous initialization attempts
  - Auto-refresh of gist providers when authentication is detected on startup

## [1.5.0] - 2025-11-12

### Added

- **🏷️ Tags & Labels System**:
  - Add, remove, and clear tags on any gist
  - Tags stored in GitHub comments, synced across all devices
  - System tags comment automatically hidden from user comments view
  - Tag count badges visible on gist names with full list on hover
  - Human-readable tag format `[tag:name]` for clarity
  - Search gists by tag names with intelligent ranking

- **⚡ Lightning-Fast Search Performance**:
  - **Instant Second Opens**: Search results cached after first use for zero-delay access
  - **Parallel Tag Fetching**: All tags loaded simultaneously (~10x faster for large collections)
  - **Smart Debouncing**: 300ms debounce prevents laggy typing experience
  - **Intelligent Cache**: Automatically refreshes when gists or tags change
  - **Visual Feedback**: Busy indicator shows when search is building/updating

- **API Usage Tracking**:
  - Real-time API call monitoring with operation breakdown
  - Rate limit status and reset time visibility
  - Session duration tracking
  - Status indicator for API health

### Changed

- Search performance significantly improved with parallel processing
- Search caching reduces repeated API calls and improves UX
- Tags integrated into fuzzy search with high relevance weighting

### Technical Improvements

- Parallel async tag fetching using Promise.all()
- Search result caching with intelligent invalidation
- Debounced search input to prevent excessive API calls
- Tags manager with GitHub comment-based storage
- Parallel tag fetching for all gists simultaneously

---

## [1.0.0] - 2024-11-01

### Added

- **Personal Gist Management**: View, edit, and manage all your GitHub gists in a dedicated sidebar
- **Starred Gists View**: Browse and open starred gists for quick reference and learning
- **Create Gists**: Multiple ways to create gists:
  - From scratch via the sidebar
  - From current editor file
  - From selected text
- **Quick Edit & Save**: Open gist files as virtual documents with automatic syntax highlighting and save with `Ctrl+Alt+S` (macOS: `Cmd+Alt+S`)
- **File Management**: Add, rename, or delete files within gists
- **GitHub Integration**:
  - Open gists on GitHub.com
  - View gist commit history
  - Star/unstar gists
- **OAuth Authentication**: Seamless GitHub login via VS Code's built-in authentication system
- **Token Management**: Secure token storage with VS Code's authentication API
- **Gist Visibility Control**: Choose between public and secret gists at creation time
- **Automatic Language Detection**: 100+ file type support with proper syntax highlighting
- **Smart Caching**: In-memory cache reduces API calls and improves performance
- **Keyboard Shortcuts**:
  - `Ctrl+Alt+G` / `Cmd+Alt+G`: Create new gist
  - `Ctrl+Alt+Shift+G` / `Cmd+Alt+Shift+G`: Create gist from file
  - `Ctrl+Alt+Shift+S` / `Cmd+Alt+Shift+S`: Create gist from selection
  - `Ctrl+Alt+S` / `Cmd+Alt+S`: Save gist
- **Context Menus**: Right-click menus for gists and files with relevant actions
- **VS Code Theming Support**: Seamless integration with all VS Code themes

### Requirements

- VS Code 1.104.0 or higher
- Active GitHub account
- Internet connection for API communication

---

## Versions

### Planned Features (Future Releases)

- Gist search functionality
- Collaboration features (share gists)
- Local backup of gists
- Gist templates
- Integration with GitHub Copilot
