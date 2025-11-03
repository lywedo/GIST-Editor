# Folder Hierarchy Feature

The Gist Editor now supports organizing your gists into hierarchical folders based on their descriptions! This allows you to structure your gists like a file system for better organization.

## How It Works

The folder structure is extracted from your **gist description** using a simple pattern:

```
FolderName/SubFolder/ItemName - Display Description
```

### Pattern Rules

- **Folder path**: Separated by forward slashes (`/`)
- **Separator**: A dash (`-`) separates the folder path from the display name
- **Display name**: Everything after the dash is shown as the gist name in the tree

### Examples

| Description | Folder | Display Name |
|---|---|---|
| `React/Components - Button Component` | `React/Components` | Button Component |
| `React/Hooks - useForm Hook` | `React/Hooks` | useForm Hook |
| `Utils/String - String Utilities` | `Utils/String` | String Utilities |
| `JavaScript Snippets` | (none) | JavaScript Snippets |
| `Python/Data Science/Pandas - DataFrame Tips` | `Python/Data Science/Pandas` | DataFrame Tips |

## Tree View Structure

### Default View (Without Folders)
```
🌐 Public Gists
├── Ungrouped Gist 1
├── Ungrouped Gist 2
└── Ungrouped Gist 3

🔒 Private Gists
├── My First Gist
└── My Second Gist
```

### With Folder Hierarchy
```
🌐 Public Gists
├── 📁 React
│   ├── 📁 Components
│   │   ├── Button Component (files)
│   │   └── Modal Component (files)
│   └── 📁 Hooks
│       └── useForm Hook (files)
├── 📁 Utils
│   ├── String Utils (files)
│   └── Array Utils (files)
├── Ungrouped Gist (files)
└── ... (files)

🔒 Private Gists
├── 📁 Learning
│   ├── Python Basics (files)
│   └── Web Development (files)
└── Personal Notes (files)
```

## Creating Gists with Folders

### Easy Folder UI (Recommended)

When you create a new gist, you'll be asked if you want to organize it in a folder:

1. **Choose creation method**: From file, selection, empty, or multi-file
2. **Organize in folder?** A quick pick appears:
   - ✅ **📁 Organize in a folder** (Recommended for organized projects)
   - ❌ **📄 No folder (flat)** (For ungrouped gists)

3. **If you chose "Organize in a folder"**:
   - Enter the **folder path**: `React/Components`
   - Enter the **gist name**: `Button Component`
   - The system automatically creates: `React/Components - Button Component`

4. **If you chose "No folder"**:
   - Just enter the description: `My Useful Snippet`

5. **Choose visibility** (Public/Private)
6. Your gist appears in the correct folder immediately!

### UI Flow Example

```
┌─────────────────────────────────────────────┐
│ How would you like to create your gist?     │
├─────────────────────────────────────────────┤
│ > Create from current file                  │
│   Create from selection                     │
│   Create empty gist                         │
│   Create multi-file gist                    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Do you want to organize this gist in a      │
│ folder?                                     │
├─────────────────────────────────────────────┤
│ > 📁 Organize in a folder                   │
│   📄 No folder (flat)                       │
└─────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│ Enter folder path (use / to nest)        │
├──────────────────────────────────────────┤
│ [React/Components                      ] │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│ Enter gist name (display name)           │
├──────────────────────────────────────────┤
│ [Button Component                      ] │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│ Choose gist visibility                   │
├──────────────────────────────────────────┤
│ > 🔒 Private                             │
│   🌐 Public                              │
└──────────────────────────────────────────┘
                    ↓
✓ Gist created: "React/Components - Button Component"
```

### Quick Tips

- **Folder path**: Use forward slashes: `React/Components/Hooks`
- **No nesting needed**: Single folder is fine: `Utils`
- **Spaces allowed**: `My Project/Component Folder`
- **Empty folder path**: Leave blank to create at root level
- **Deep nesting**: Go as deep as you want!

## Manual Description Entry

If you prefer to type the description manually, you can still use the pattern format directly. However, we recommend using the UI for easier folder creation!

## Renaming & Reorganizing

### Move a Gist to a Different Folder

The rename command now uses the same easy folder UI:

1. **Right-click on a gist** → **Rename**
2. **Organize in folder?** Quick pick appears:
   - **📁 Organize in a folder** - Edit folder path and name
   - **📄 No folder (flat)** - Just enter description
3. **Update folder path** (e.g., `React/Components` → `React/Hooks`)
4. **Update gist name** if needed
5. **Confirm** - Gist automatically moves to the new folder!

### Example Reorganization

```
Old:  React/Components - Button Component
                   ↓
Choose: 📁 Organize in a folder
Folder: React/Hooks
Name:   Button Hook
                   ↓
New:   React/Hooks - Button Hook
       (gist moves to the Hooks folder)
```

## Example Organization Patterns

### Web Development
```
React/Components
React/Hooks
React/Utils
Vue/Components
Vue/Composables
HTML/Templates
CSS/Utilities
```

### Data Science
```
Python/NumPy/Basics
Python/Pandas/DataFrames
Python/Matplotlib/Charts
R/Data Processing
SQL/Queries
```

### Learning Path
```
Learning/JavaScript/ES6
Learning/JavaScript/Advanced
Learning/React/Basics
Learning/React/Hooks
Learning/TypeScript/Fundamentals
```

### Mixed Categories
```
Work/Project1/Frontend
Work/Project1/Backend
Work/Project2/Config
Personal/Snippets
Personal/Examples
Reference/Algorithms
Reference/Design Patterns
```

## Implementation Details

### How Folders Are Built

The folder hierarchy is built **on-demand** when you expand a group (Public/Private):

1. **Parse descriptions**: Each gist description is parsed to extract the folder path
2. **Group gists**: Gists are organized into their corresponding folders
3. **Build tree**: A hierarchical tree structure is created with subfolders
4. **Display**: The folder tree is shown in the tree view with:
   - Folder icon for folders 📁
   - Gist count and subfolder count in descriptions
   - Ungrouped gists at the root level

### Performance

- **Cached**: Folder trees are cached per visibility (public/private) for better performance
- **Lazy loaded**: Folders are expanded on-demand
- **Efficient**: API calls happen once when you first expand a group

### Backward Compatible

- **Existing gists**: All your existing gists without folder prefixes continue to work
- **Mixed setup**: You can have both organized (with folders) and ungrouped gists in the same view
- **No changes needed**: The system works with standard GitHub gist descriptions

## File Operations

All file operations work the same way in folders:

- **Open file**: Click on any file in the gist to open it
- **Add file**: Right-click gist → Add File (works at any folder level)
- **Delete file**: Right-click file → Delete File
- **Rename file**: Right-click file → Rename
- **View history**: Right-click gist → View History

## Tips & Tricks

### Organizing by Language
```
JavaScript
├── Snippets
├── Framework - React
├── Framework - Vue
└── Utils

Python
├── Data Processing
├── Web Scraping
└── Automation
```

### Organizing by Use Case
```
Work
├── Project A
├── Project B
└── Utilities

Learning
├── Web Development
├── Mobile Development
└── DevOps

Reference
├── Algorithms
├── Design Patterns
└── APIs
```

### Naming Conventions
- Use PascalCase for folder names: `MyFolder/MySubFolder`
- Use descriptive names: `React/Components` not `React/c`
- Use consistent separators: Always use `/` for nesting

## Settings

Currently, folder hierarchy is automatically enabled. No configuration needed!

Future versions may include:
- Toggle folder hierarchy on/off
- Custom folder path patterns
- Auto-collapse/expand behavior
- Folder sorting options

## Troubleshooting

### Gist not appearing in expected folder?

1. **Check the description**: Make sure it follows the pattern `Folder/Path - Name`
2. **Verify the dash**: There must be a space-dash-space ` - ` separating path from name
3. **Refresh the view**: Click the refresh button or press `Ctrl+Shift+P` → Gist Editor: Refresh

### Folder appears empty?

1. **Check visibility**: Make sure gists are the same visibility (Public/Private) as the folder
2. **Look for ungrouped gists**: Gists without a folder prefix appear at the top level
3. **Expand subfolders**: Make sure all subfolder levels are expanded

### Can't move gist to a new folder?

1. **Rename the gist**: Right-click → Rename
2. **Update the folder path**: Change `OldPath/Name` to `NewPath/Name`
3. **Confirm**: The gist will automatically move after you confirm

## Future Enhancements

Planned features:
- Drag-and-drop to reorganize gists between folders
- Folder icons customization
- Search within folder hierarchy
- Quick jump to folder
- Folder sorting options (alphabetical, custom)
- View toggle (folders on/off)
