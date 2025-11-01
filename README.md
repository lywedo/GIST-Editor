# Gist Editor for VS Code

Manage GitHub Gists seamlessly within VS Code. Create, edit, view, and organize your gists directly from the editor without ever leaving your workspace.

## Features

- **Manage Personal Gists**: View and edit all your GitHub gists in a dedicated sidebar
- **Starred Gists**: Browse and open starred gists for quick reference
- **Create New Gists**: Create gists from scratch, from current file, or from selection
- **Syntax Highlighting**: Automatic language detection for proper code highlighting
- **Quick Edit & Save**: Open gist files as virtual documents and save changes with keyboard shortcuts
- **Full File Management**: Add, rename, or delete files within your gists
- **GitHub Integration**: Open gists on GitHub, view history, and manage stars
- **OAuth Authentication**: Seamless GitHub login via VS Code's built-in authentication
- **Gist Visibility**: Create public or secret gists with a simple choice
- **Fast Caching**: In-memory caching reduces API calls for smooth performance

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Gist Editor"
4. Click Install

## Getting Started

### 1. Sign In with GitHub

1. Open the **Gist Editor** sidebar (click the GitHub icon in the activity bar)
2. Click the gear icon (⚙️) to open token configuration
3. Select **Sign in with GitHub**
4. A browser window will open for authentication
5. Authorize the extension to access your gists

> **Note**: VS Code securely manages your GitHub token using its built-in authentication system.

### 2. Create a Gist

Several options are available:

**From the Sidebar:**
1. Click the **+** button in the "My Gists" section
2. Enter a description and choose visibility (public/secret)

**From Current File:**
1. Right-click in the editor → **Create Gist from Current File**
2. Or use keyboard shortcut: `Ctrl+Alt+Shift+G` (Cmd+Alt+Shift+G on Mac)

**From Selection:**
1. Select code in the editor
2. Right-click → **Create Gist from Selection**
3. Or use keyboard shortcut: `Ctrl+Alt+Shift+S` (Cmd+Alt+Shift+S on Mac)

### 3. Edit a Gist

1. Click on a gist file in the sidebar to open it
2. Edit the content in the editor
3. Save with `Ctrl+Alt+S` (Cmd+Alt+S on Mac) or the standard save shortcut
4. Changes are automatically synced to GitHub

### 4. Manage Gist Files

Right-click on a gist to:
- **Add File**: Add a new file to the gist
- **Rename**: Change the gist description
- **Open in GitHub**: View the gist on GitHub.com
- **View History**: See commit history
- **Star/Unstar**: Toggle star status
- **Delete**: Remove the gist

Right-click on a file within a gist to:
- **Rename**: Change the filename
- **Open in GitHub**: View the file on GitHub
- **Delete**: Remove the file from the gist

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---|---|
| Save Gist | `Ctrl+Alt+S` | `Cmd+Alt+S` |
| Create Gist | `Ctrl+Alt+G` | `Cmd+Alt+G` |
| Create from File | `Ctrl+Alt+Shift+G` | `Cmd+Alt+Shift+G` |
| Create from Selection | `Ctrl+Alt+Shift+S` | `Cmd+Alt+Shift+S` |

## Configuration

This extension uses VS Code's built-in GitHub authentication and doesn't require manual configuration for most users.

**Advanced: Manual Token Entry** (if needed):
- Open Settings
- Search for "Gist Editor"
- Set `gistEditor.githubToken` with a personal access token
- Token must have `gist` scope

## Supported Languages

The extension automatically detects syntax highlighting for 100+ file types including:
- Web: JavaScript, TypeScript, HTML, CSS, SCSS, Vue, React, etc.
- Languages: Python, Java, Go, Rust, C++, C#, PHP, Ruby, etc.
- Data: JSON, YAML, TOML, XML, etc.
- Markup: Markdown, LaTeX, AsciiDoc, etc.
- Infrastructure: Dockerfile, Terraform, HCL, etc.
- And many more...

## Requirements

- VS Code 1.104.0 or higher
- Active GitHub account
- Internet connection (for GitHub API calls)

## Known Limitations

- First load of gists may take a few seconds while loading from GitHub API
- Large gists (100+ files) may take longer to expand in the sidebar
- Viewing gist history requires VS Code 1.110.0+

## Troubleshooting

### Cannot sign in to GitHub
- Check your internet connection
- Try signing out and back in via the gear icon
- Verify your GitHub account is active

### Gists not showing up
- Click the refresh icon in the sidebar
- Check that you're signed in
- Verify your GitHub token has the `gist` scope

### Changes not syncing
- Ensure you save the file (Ctrl+S or Cmd+S)
- Check your internet connection
- Verify you're still authenticated

## Privacy & Security

- Your GitHub token is securely managed by VS Code's authentication system
- Gists are synced directly with GitHub's servers
- No data is stored locally except for in-memory caching
- This extension does not collect any telemetry

## Contributing

Found a bug or have a feature request? Open an issue on [GitHub](https://github.com/yourusername/gist-editor/issues)

## License

MIT License - See LICENSE file for details

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes and version history.

---

**Enjoy managing your gists from VS Code!** 🚀
