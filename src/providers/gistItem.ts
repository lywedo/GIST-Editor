import * as vscode from 'vscode';
import { Gist, GistComment } from '../githubService';
import { GistFolder } from '../gistFolderBuilder';
import { parseGistDescription } from '../gistDescriptionParser';
import { getFileIcon } from '../utils/fileIcons';

/**
 * Tree item representing a gist, file, folder, comment, or group in the tree view
 */
export class GistItem extends vscode.TreeItem {
	// For group items (Public/Private categories)
	public isGroup: boolean = false;
	public groupType?: 'public' | 'private';

	// For folder items
	public isFolder: boolean = false;
	public folder?: GistFolder;

	// For comment items
	public isComment: boolean = false;
	public comment?: GistComment;
	public parentGistId?: string;

	// For comments folder item
	public isCommentsFolder: boolean = false;
	public commentsParentGistId?: string;

	// Track if gist is starred
	public isStarred: boolean = false;

	// For tag items
	public isTag: boolean = false;
	public isTagsFolder: boolean = false;
	public tag?: string;

	constructor(
		public readonly gist: Gist | null = null,
		public readonly file?: any,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
		groupType?: 'public' | 'private',
		folder?: GistFolder,
		comment?: GistComment,
		parentGistId?: string,
		public tags?: string[]
	) {
		// If this is a comment item
		if (comment && parentGistId) {
			const author = comment.user?.login || 'Unknown';
			const createdDate = new Date(comment.created_at);
			const isUpdated = comment.updated_at !== comment.created_at;

			// Calculate relative time (e.g., "2 days ago")
			const now = new Date();
			const diffMs = now.getTime() - createdDate.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			const diffMins = Math.floor(diffMs / (1000 * 60));

			let relativeTime: string;
			if (diffMins < 1) {
				relativeTime = 'just now';
			} else if (diffMins < 60) {
				relativeTime = `${diffMins}m ago`;
			} else if (diffHours < 24) {
				relativeTime = `${diffHours}h ago`;
			} else if (diffDays < 7) {
				relativeTime = `${diffDays}d ago`;
			} else {
				relativeTime = createdDate.toLocaleDateString();
			}

			super(`@${author} • ${relativeTime}`, vscode.TreeItemCollapsibleState.None);
			this.id = `comment:${parentGistId}:${comment.id}`;
			this.isComment = true;
			this.comment = comment;
			this.parentGistId = parentGistId;
			this.contextValue = 'gistComment';
			this.iconPath = new vscode.ThemeIcon('comment');

			// Show comment preview (first line, max 70 chars)
			const firstLine = comment.body.split('\n')[0];
			const preview = firstLine.length > 70 ? firstLine.substring(0, 70) + '...' : firstLine;
			this.description = preview;

			// Detailed tooltip
			const updatedInfo = isUpdated ? `\nEdited: ${new Date(comment.updated_at).toLocaleDateString()}` : '';
			this.tooltip = `${author}'s comment\nCreated: ${createdDate.toLocaleString()}${updatedInfo}\n\n${comment.body}`;
		}
		// If this is a folder item
		else if (folder) {
			super(folder.displayName, vscode.TreeItemCollapsibleState.Collapsed);
			const folderId = folder.path.length > 0
				? folder.path.map(segment => encodeURIComponent(segment)).join('/')
				: 'root';
			this.id = `folder:${folderId}`;
			this.isFolder = true;
			this.folder = folder;
			this.contextValue = 'gistFolder';
			this.iconPath = new vscode.ThemeIcon('folder');
			const gistCount = folder.gists.length;
			const subfolderCount = folder.subFolders.length;
			const desc = [];
			if (gistCount > 0) {
				desc.push(`${gistCount} gist${gistCount !== 1 ? 's' : ''}`);
			}
			if (subfolderCount > 0) {
				desc.push(`${subfolderCount} folder${subfolderCount !== 1 ? 's' : ''}`);
			}
			this.description = desc.join(' • ');
			this.tooltip = `Folder: ${folder.displayName}\nGists: ${gistCount}\nSubfolders: ${subfolderCount}`;
		}
		// If this is a group item (Public/Private category)
		else if (groupType) {
			const label = groupType === 'public' ? '🌐 Public Gists' : '🔒 Private Gists';
			super(label, vscode.TreeItemCollapsibleState.Collapsed);
			this.id = `group:${groupType}`;
			this.contextValue = 'gistGroup';
			this.isGroup = true;
			this.groupType = groupType;
			this.iconPath = groupType === 'public' ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');
		}
		// If this is a file item, show the filename
		else if (file && gist) {
			super(file.filename, vscode.TreeItemCollapsibleState.None);
			const encodedFilename = encodeURIComponent(file.filename);
			this.id = `file:${gist.id}:${encodedFilename}`;
			this.tooltip = `${file.filename}\nLanguage: ${file.language}\nSize: ${file.size} bytes`;
			this.contextValue = 'gistFile';
			this.iconPath = getFileIcon(file.filename);
			this.command = {
				command: 'gist-editor.openGistFile',
				title: 'Open File',
				arguments: [gist, file]
			};
			this.description = `${file.language} • ${file.size} bytes`;
		} else if (gist) {
			// This is a gist container
			const parsed = parseGistDescription(gist.description || '');
			super(parsed.displayName || gist.description || '(No description)', collapsibleState);
			this.id = `gist:${gist.id}`;
			this.contextValue = 'gist';
			this.iconPath = gist.public ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');

			// Show file count and visibility
			const fileCount = Object.keys(gist.files).length;
			const visibility = gist.public ? 'Public' : 'Private';
			const starIndicator = this.isStarred ? '⭐' : '';

			// Build description with tag count badge
			const descParts = [`${fileCount} file${fileCount !== 1 ? 's' : ''}`, visibility, starIndicator].filter(Boolean);
			if (tags && tags.length > 0) {
				descParts.push(`[#${tags.length}]`);
			}
			this.description = descParts.join(' • ');

			// Build tooltip with full tag list
			let tooltipText = `${gist.description}\nCreated: ${new Date(gist.created_at).toLocaleDateString()}\nFiles: ${fileCount}`;
			if (tags && tags.length > 0) {
				const tagsDisplay = tags.map(t => `#${t}`).join(', ');
				tooltipText += `\nTags: ${tagsDisplay}`;
			}
			this.tooltip = tooltipText;
		}
	}
}
