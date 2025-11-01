# Change Log

All notable changes to the "gist-editor" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

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
