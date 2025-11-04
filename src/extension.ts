// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitHubService, Gist, GistComment } from './githubService';
import { GistFolderBuilder, GistFolder } from './gistFolderBuilder';
import { parseGistDescription, createGistDescription } from './gistDescriptionParser';

// File system provider for gist files (allows editing)
class GistFileSystemProvider implements vscode.FileSystemProvider {
	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	private gistCache = new Map<string, Gist>();

	constructor(private githubService: GitHubService) {}

	watch(uri: vscode.Uri): vscode.Disposable {
		// Ignore, we don't support watching
		return new vscode.Disposable(() => {});
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		return {
			type: vscode.FileType.File,
			ctime: Date.now(),
			mtime: Date.now(),
			size: 0
		};
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
		return [];
	}

	createDirectory(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot create directories in gists');
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const pathParts = uri.path.substring(1).split('/');
		const gistId = pathParts[0];
		const filename = decodeURIComponent(pathParts.slice(1).join('/'));
		
		console.log(`FileSystem: Reading "${filename}" from gist ${gistId}`);
		
		try {
			// Try to get from cache first
			let gist = this.gistCache.get(gistId);
			if (!gist) {
				console.log(`Fetching gist ${gistId} from API...`);
				gist = await this.githubService.getGist(gistId);
				console.log(`Gist fetched: public=${gist.public}, files=${Object.keys(gist.files).length}`);
				this.gistCache.set(gistId, gist);
			}

			const file = gist.files[filename];
			if (!file) {
				const availableFiles = Object.keys(gist.files).join(', ');
				console.error(`File "${filename}" not found in gist. Available: ${availableFiles}`);
				throw vscode.FileSystemError.FileNotFound(uri);
			}

			console.log(`Successfully read content for ${filename} (${file.content?.length || 0} characters)`);
			return Buffer.from(file.content || '', 'utf8');
		} catch (error: any) {
			console.error('Error reading gist file:', error);
			throw vscode.FileSystemError.Unavailable(error.message);
		}
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
		const pathParts = uri.path.substring(1).split('/');
		const gistId = pathParts[0];
		const filename = decodeURIComponent(pathParts.slice(1).join('/'));
		const contentStr = Buffer.from(content).toString('utf8');
		
		console.log(`FileSystem: Writing "${filename}" to gist ${gistId} (${contentStr.length} chars)`);
		
		try {
			await this.githubService.updateGist(gistId, undefined, {
				[filename]: { content: contentStr }
			});

			// Invalidate cache
			this.gistCache.delete(gistId);
			
			// Notify that file changed
			this._emitter.fire([{
				type: vscode.FileChangeType.Changed,
				uri
			}]);
			
			console.log(`Successfully saved ${filename} to gist`);
		} catch (error: any) {
			console.error('Error writing gist file:', error);
			throw vscode.FileSystemError.Unavailable(error.message);
		}
	}

	delete(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot delete gist files directly');
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot rename gist files directly');
	}

	public invalidateCache(gistId: string) {
		this.gistCache.delete(gistId);
	}
}

// Map file extensions to VS Code theme icons
function getFileIcon(filename: string): vscode.ThemeIcon {
	const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

	// JSON and data formats
	if (ext === '.json') {return new vscode.ThemeIcon('json');}
	if (ext === '.yaml' || ext === '.yml') {return new vscode.ThemeIcon('json');}
	if (ext === '.xml') {return new vscode.ThemeIcon('json');}
	if (ext === '.toml') {return new vscode.ThemeIcon('json');}
	if (ext === '.csv') {return new vscode.ThemeIcon('json');}

	// Markdown and docs
	if (ext === '.md' || ext === '.markdown') {return new vscode.ThemeIcon('markdown');}
	if (ext === '.txt') {return new vscode.ThemeIcon('file');}
	if (ext === '.rst') {return new vscode.ThemeIcon('file-text');}

	// Programming languages
	if (ext === '.js' || ext === '.jsx') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.ts' || ext === '.tsx') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.py') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.go') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.rs') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.java' || ext === '.class') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.cpp' || ext === '.c' || ext === '.h' || ext === '.hpp') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.cs') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.php') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.rb') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.swift') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.kt') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.scala') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.sh' || ext === '.bash' || ext === '.zsh') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.ps1') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.lua') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.r') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.pl' || ext === '.pm') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.groovy' || ext === '.gradle') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.sql') {return new vscode.ThemeIcon('database');}

	// Web - HTML, CSS, etc.
	if (ext === '.html' || ext === '.htm') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.css' || ext === '.scss' || ext === '.less' || ext === '.sass') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.vue' || ext === '.svelte') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.jsx' || ext === '.tsx') {return new vscode.ThemeIcon('file-code');}

	// Config files
	if (ext === '.env') {return new vscode.ThemeIcon('settings');}
	if (ext === '.config' || ext === '.conf') {return new vscode.ThemeIcon('settings');}
	if (ext === '.ini') {return new vscode.ThemeIcon('settings');}
	if (ext === '.properties') {return new vscode.ThemeIcon('settings');}

	// Docker and infrastructure
	if (filename === 'dockerfile') {return new vscode.ThemeIcon('file-code');}
	if (filename === 'dockerfile.dev') {return new vscode.ThemeIcon('file-code');}
	if (filename === '.dockerignore') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.tf' || ext === '.hcl') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.yml' || ext === '.yaml') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.nix') {return new vscode.ThemeIcon('file-code');}

	// Archives
	if (ext === '.zip' || ext === '.tar' || ext === '.gz' || ext === '.rar' || ext === '.7z') {return new vscode.ThemeIcon('file-zip');}

	// Images
	if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.svg' || ext === '.webp' || ext === '.ico') {return new vscode.ThemeIcon('file-media');}

	// Default file icon
	return vscode.ThemeIcon.File;
}

// Gist item for the tree view
class GistItem extends vscode.TreeItem {
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

	constructor(
		public readonly gist: Gist | null = null,
		public readonly file?: any,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
		groupType?: 'public' | 'private',
		folder?: GistFolder,
		comment?: GistComment,
		parentGistId?: string
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
			this.contextValue = 'gistGroup';
			this.isGroup = true;
			this.groupType = groupType;
			this.iconPath = groupType === 'public' ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');
		}
		// If this is a file item, show the filename
		else if (file && gist) {
			super(file.filename, vscode.TreeItemCollapsibleState.None);
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
			this.tooltip = `${gist.description}\nCreated: ${new Date(gist.created_at).toLocaleDateString()}\nFiles: ${Object.keys(gist.files).length}`;
			this.contextValue = 'gist';
			this.iconPath = gist.public ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');

			// Show file count and visibility
			const fileCount = Object.keys(gist.files).length;
			const visibility = gist.public ? 'Public' : 'Private';
			const starIndicator = this.isStarred ? '⭐' : '';
			this.description = `${fileCount} file${fileCount !== 1 ? 's' : ''} • ${visibility} ${starIndicator}`.trim();
		}
	}
}

// Tree data provider for gists
class GistProvider implements vscode.TreeDataProvider<GistItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<GistItem | undefined | null | void> = new vscode.EventEmitter<GistItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<GistItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private folderBuilder = new GistFolderBuilder();
	private folderTreeCache: Map<'public' | 'private', GistFolder[]> = new Map();
	private ungroupedGistsCache: Map<'public' | 'private', Gist[]> = new Map();
	private commentsCache: Map<string, GistComment[]> = new Map();

	// Drag and drop support
	dropMimeTypes = ['application/vnd.code.tree-gistItem'];
	dragMimeTypes = ['application/vnd.code.tree-gistItem'];

	constructor(private gistType: 'my' | 'starred', private githubService: GitHubService) {}

	refresh(): void {
		this.folderTreeCache.clear();
		this.ungroupedGistsCache.clear();
		this.commentsCache.clear();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GistItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: GistItem): Promise<GistItem[]> {
		if (!element) {
			// Root level - show group categories
			console.log(`Loading ${this.gistType} gists...`);
			try {
				if (!this.githubService.isAuthenticated()) {
					console.log('Not authenticated, showing setup item');
					return [this.createNotAuthenticatedItem()];
				}

				let gists: Gist[];
				if (this.gistType === 'my') {
					console.log('Fetching my gists...');
					gists = await this.githubService.getMyGists();
				} else {
					console.log('Fetching starred gists...');
					gists = await this.githubService.getStarredGists();
				}

				console.log(`Found ${gists.length} ${this.gistType} gists`);

				// Check if we have both public and private gists
				const hasPublic = gists.some(g => g.public);
				const hasPrivate = gists.some(g => !g.public);

				// Create group items only if we have gists of that type
				const groups: GistItem[] = [];
				if (hasPublic) {
					groups.push(new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, 'public'));
				}
				if (hasPrivate) {
					groups.push(new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, 'private'));
				}

				return groups;
			} catch (error) {
				console.error(`Error loading ${this.gistType} gists:`, error);
				vscode.window.showErrorMessage(`Failed to load ${this.gistType} gists: ${error}`);
				return [this.createErrorItem(error instanceof Error ? error.message : 'Unknown error')];
			}
		} else if (element.isGroup) {
			// Group level - show folders and ungrouped gists
			console.log(`Loading ${element.groupType} folder hierarchy...`);
			try {
				let gists: Gist[];
				if (this.gistType === 'my') {
					gists = await this.githubService.getMyGists();
				} else {
					gists = await this.githubService.getStarredGists();
				}

				// Filter gists by visibility
				const visibility = element.groupType!;
				const filteredGists = gists.filter(g => {
					if (visibility === 'public') {
						return g.public;
					} else {
						return !g.public;
					}
				});

				console.log(`Found ${filteredGists.length} ${visibility} gists`);

				// Build folder tree if not cached
				if (!this.folderTreeCache.has(visibility)) {
					const result = this.folderBuilder.buildFolderTree(filteredGists);
					this.folderTreeCache.set(visibility, result.folders);
					this.ungroupedGistsCache.set(visibility, result.ungroupedGists);
				}

				const folders = this.folderTreeCache.get(visibility) || [];
				const ungroupedGists = this.ungroupedGistsCache.get(visibility) || [];

				// Create folder items
				const folderItems = folders.map(folder =>
					new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, folder)
				);

				// Create ungrouped gist items
				const ungroupedItems = ungroupedGists.map(gist =>
					new GistItem(gist, undefined, vscode.TreeItemCollapsibleState.Collapsed)
				);

				return [...folderItems, ...ungroupedItems];
			} catch (error) {
				console.error(`Error loading ${element.groupType} gists:`, error);
				return [];
			}
		} else if (element.isFolder) {
			// Folder level - show subfolders and gists in this folder
			const folder = element.folder!;
			console.log(`[Folder Expand] Expanding folder "${folder.displayName}": ${folder.subFolders.length} subfolders, ${folder.gists.length} gists`);

			const folderItems = folder.subFolders.map(subfolder =>
				new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, subfolder)
			);

			const gistItems = folder.gists.map(gist =>
				new GistItem(gist, undefined, vscode.TreeItemCollapsibleState.Collapsed)
			);

			console.log(`[Folder Expand] Returning ${folderItems.length} folders + ${gistItems.length} gists`);
			return [...folderItems, ...gistItems];
		} else if (element.contextValue === 'gist') {
			// Gist level - show files
			if (!element.gist) {
				return [];
			}
			const files = Object.values(element.gist.files);
			const fileItems = files.map(file => new GistItem(element.gist, file));
			return fileItems;
		}
		return [];
	}

	private async getComments(gistId: string): Promise<GistComment[]> {
		// Check cache first
		if (this.commentsCache.has(gistId)) {
			return this.commentsCache.get(gistId)!;
		}

		try {
			const comments = await this.githubService.getGistComments(gistId);
			this.commentsCache.set(gistId, comments);
			return comments;
		} catch (error) {
			console.error('Error fetching comments:', error);
			throw error;
		}
	}

	private createNotAuthenticatedItem(): GistItem {
		const mockGist: Gist = {
			id: 'not-authenticated',
			description: 'Click here to sign in with GitHub',
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined);
		item.command = {
			command: 'gist-editor.setupToken',
			title: 'Sign in with GitHub'
		};
		item.iconPath = new vscode.ThemeIcon('github');
		return item;
	}

	private createErrorItem(message: string): GistItem {
		const mockGist: Gist = {
			id: 'error',
			description: `Error: ${message}`,
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined);
		item.iconPath = new vscode.ThemeIcon('error');
		return item;
	}

	// Handle drag operations - serialize the dragged items
	async handleDrag(source: GistItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		console.log(`[Drag] Dragging ${source.length} items`);

		// Only allow dragging gists (not files or comments)
		const draggableItems = source.filter(item => item.gist || item.isFolder);

		if (draggableItems.length === 0) {
			return;
		}

		// Serialize the dragged items
		const draggedData = draggableItems.map(item => ({
			gistId: item.gist?.id,
			isFolder: item.isFolder,
			folderPath: item.folder?.path
		}));

		// Set the data transfer content
		dataTransfer.set('application/vnd.code.tree-gistItem', new vscode.DataTransferItem(JSON.stringify(draggedData)));
		console.log(`[Drag] Serialized drag data: ${JSON.stringify(draggedData)}`);
	}

	// Handle drop operations - move gists to target folder
	async handleDrop(target: GistItem, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		console.log(`[Drop] Dropping on target, isFolder: ${target.isFolder}`);

		const draggedItems = dataTransfer.get('application/vnd.code.tree-gistItem');
		if (!draggedItems) {
			console.log('[Drop] No dragged items in data transfer');
			return;
		}

		try {
			const draggedItemsText = draggedItems.value;
			console.log(`[Drop] Raw drag data: ${draggedItemsText}`);
			const draggedData = JSON.parse(draggedItemsText);

			// Only 'my' gists provider can handle drops (for moving gists)
			if (this.gistType !== 'my') {
				vscode.window.showWarningMessage('You can only move gists in "My Gists" view');
				return;
			}

			// Can only drop on folders
			if (!target.isFolder) {
				vscode.window.showWarningMessage('Can only move gists to folders');
				return;
			}

			// Extract target folder path
			const targetFolderPath = target.folder?.path || [];
			console.log(`[Drop] Target folder path: ${JSON.stringify(targetFolderPath)}`);

			// Move each dragged gist
			for (const draggedItem of draggedData) {
				if (draggedItem.gistId) {
					console.log(`[Drop] Moving gist ${draggedItem.gistId} to ${targetFolderPath.join('/')}`);

					// Get the gist to update
					const gist = await this.githubService.getGist(draggedItem.gistId);
					const parsed = parseGistDescription(gist.description || '');

					// Create new description with target folder path
					const newDescription = createGistDescription(targetFolderPath, parsed.displayName);

					// Update the gist with new folder path
					await this.githubService.updateGist(draggedItem.gistId, newDescription);
					console.log(`[Drop] Successfully updated gist ${draggedItem.gistId}`);
				}
			}

			// Refresh the tree after moving gists
			this.refresh();
			vscode.window.showInformationMessage(`✓ Moved ${draggedData.length} gist${draggedData.length !== 1 ? 's' : ''} successfully`);
		} catch (error) {
			console.error('Error handling drop:', error);
			vscode.window.showErrorMessage(`Failed to move gist: ${error}`);
		}
	}
}

// Tree data provider for comments
class CommentProvider implements vscode.TreeDataProvider<GistItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<GistItem | undefined | null | void> = new vscode.EventEmitter<GistItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<GistItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private selectedGistId: string | null = null;
	private selectedGist: Gist | null = null;
	private commentsCache: Map<string, GistComment[]> = new Map();

	constructor(private githubService: GitHubService) {}

	/**
	 * Set the currently selected gist and refresh the comments view
	 */
	setSelectedGist(gist: Gist | null): void {
		this.selectedGist = gist;
		this.selectedGistId = gist?.id || null;
		this.commentsCache.clear();
		console.log(`[CommentProvider] Selected gist: ${this.selectedGistId ? gist?.description : 'None'}`);
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Clear selected gist (called when user logs out)
	 */
	clearSelectedGist(): void {
		this.selectedGist = null;
		this.selectedGistId = null;
		this.commentsCache.clear();
		console.log('[CommentProvider] Cleared selected gist due to logout');
		this._onDidChangeTreeData.fire();
	}

	refresh(): void {
		this.commentsCache.clear();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GistItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: GistItem): Promise<GistItem[]> {
		if (!element) {
			// Root level - check authentication first
			if (!this.githubService.isAuthenticated()) {
				console.log('[CommentProvider] Not authenticated');
				return [this.createNotAuthenticatedItem()];
			}

			if (!this.selectedGistId || !this.selectedGist) {
				console.log('[CommentProvider] No gist selected');
				return [this.createNoGistSelectedItem()];
			}

			try {
				console.log(`[CommentProvider] Fetching comments for gist ${this.selectedGistId}...`);
				const comments = await this.getComments(this.selectedGistId);
				console.log(`[CommentProvider] Found ${comments.length} comments`);

				if (comments.length === 0) {
					return [this.createNoCommentsItem()];
				}

				// Sort comments in descending order (newest first)
				const sortedComments = comments.sort((a, b) => {
					return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
				});

				const commentItems = sortedComments.map(comment =>
					new GistItem(null, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined, comment, this.selectedGistId!)
				);

				return commentItems;
			} catch (error) {
				console.error('[CommentProvider] Error fetching comments:', error);
				return [this.createErrorItem((error instanceof Error) ? error.message : 'Failed to fetch comments')];
			}
		}

		return [];
	}

	private async getComments(gistId: string): Promise<GistComment[]> {
		if (this.commentsCache.has(gistId)) {
			return this.commentsCache.get(gistId)!;
		}

		try {
			const comments = await this.githubService.getGistComments(gistId);
			this.commentsCache.set(gistId, comments);
			return comments;
		} catch (error) {
			console.error('Error fetching comments:', error);
			throw error;
		}
	}

	private createNotAuthenticatedItem(): GistItem {
		const mockGist: Gist = {
			id: 'not-authenticated',
			description: 'Sign in with GitHub to view comments',
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined);
		item.command = {
			command: 'gist-editor.setupToken',
			title: 'Sign in with GitHub'
		};
		item.iconPath = new vscode.ThemeIcon('github');
		return item;
	}

	private createNoGistSelectedItem(): GistItem {
		const mockGist: Gist = {
			id: 'no-gist',
			description: 'Select a gist to view its comments',
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined);
		item.iconPath = new vscode.ThemeIcon('comment-unresolved');
		return item;
	}

	private createNoCommentsItem(): GistItem {
		const mockGist: Gist = {
			id: 'no-comments',
			description: 'No comments on this gist yet',
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined);
		item.iconPath = new vscode.ThemeIcon('smiley');
		return item;
	}

	private createErrorItem(message: string): GistItem {
		const mockGist: Gist = {
			id: 'error',
			description: `Error: ${message}`,
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None, undefined, undefined);
		item.iconPath = new vscode.ThemeIcon('error');
		return item;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gist-editor" is now active!');

	// Create GitHub service
	const githubService = new GitHubService();

	// Create gist file system provider
	const gistFileSystemProvider = new GistFileSystemProvider(githubService);
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider('gist', gistFileSystemProvider, {
			isCaseSensitive: true,
			isReadonly: false
		})
	);

	// Create tree data providers
	const myGistsProvider = new GistProvider('my', githubService);
	const starredGistsProvider = new GistProvider('starred', githubService);
	const commentProvider = new CommentProvider(githubService);

	// Register tree data providers
	vscode.window.registerTreeDataProvider('gist-editor.gistList', myGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.starred', starredGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.comments', commentProvider);

	// Track gist selection for comments view
	const gistSelectionTracker = vscode.window.createTreeView('gist-editor.gistList', {
		treeDataProvider: myGistsProvider,
		dragAndDropController: myGistsProvider,
		showCollapseAll: true
	});

	const starredSelectionTracker = vscode.window.createTreeView('gist-editor.starred', {
		treeDataProvider: starredGistsProvider,
		dragAndDropController: starredGistsProvider,
		showCollapseAll: true
	});

	// Mock gist IDs that should not trigger comment loading
	const mockGistIds = new Set(['not-authenticated', 'no-gist', 'no-comments', 'error']);

	// Listen for gist selection in both views
	gistSelectionTracker.onDidChangeSelection((e) => {
		if (e.selection.length > 0) {
			const selectedItem = e.selection[0];
			if (selectedItem instanceof GistItem && selectedItem.gist && selectedItem.contextValue === 'gist') {
				// Don't select mock items
				if (!mockGistIds.has(selectedItem.gist.id)) {
					console.log(`[Selection] Selected gist: ${selectedItem.gist.description}`);
					commentProvider.setSelectedGist(selectedItem.gist);
				}
			}
		}
	});

	starredSelectionTracker.onDidChangeSelection((e) => {
		if (e.selection.length > 0) {
			const selectedItem = e.selection[0];
			if (selectedItem instanceof GistItem && selectedItem.gist && selectedItem.contextValue === 'gist') {
				// Don't select mock items
				if (!mockGistIds.has(selectedItem.gist.id)) {
					console.log(`[Selection] Selected starred gist: ${selectedItem.gist.description}`);
					commentProvider.setSelectedGist(selectedItem.gist);
				}
			}
		}
	});

	// Register commands
	const helloWorldCommand = vscode.commands.registerCommand('gist-editor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Gist Editor!');
	});

	const refreshCommand = vscode.commands.registerCommand('gist-editor.refresh', () => {
		myGistsProvider.refresh();
		starredGistsProvider.refresh();
		vscode.window.showInformationMessage('Gists refreshed!');
	});

	const createGistCommand = vscode.commands.registerCommand('gist-editor.createGist', async () => {
		// Ensure user is authenticated
		if (!githubService.isAuthenticated()) {
			try {
				await githubService.getOAuthToken();
			} catch (error) {
				const setup = await vscode.window.showErrorMessage(
					'You need to sign in with GitHub to create gists.',
					'Sign in with GitHub'
				);
				if (setup === 'Sign in with GitHub') {
					vscode.commands.executeCommand('gist-editor.setupToken');
				}
				return;
			}
		}

		try {
			// Ask for creation method
			const method = await vscode.window.showQuickPick([
				{
					label: '$(file-text) Create from current file',
					description: 'Create gist from the currently open file',
					detail: 'current-file'
				},
				{
					label: '$(file-add) Create from selection',
					description: 'Create gist from selected text in current file',
					detail: 'selection'
				},
				{
					label: '$(new-file) Create empty gist',
					description: 'Create a new empty gist',
					detail: 'empty'
				},
				{
					label: '$(files) Create multi-file gist',
					description: 'Create gist with multiple files',
					detail: 'multi-file'
				}
			], {
				placeHolder: 'How would you like to create your gist?',
				ignoreFocusOut: true
			});

			if (!method) {
				return;
			}

			let files: { [filename: string]: { content: string } } = {};
			let defaultDescription = '';

			switch (method.detail) {
				case 'current-file':
					files = await createFromCurrentFile();
					defaultDescription = `Gist from ${Object.keys(files)[0] || 'file'}`;
					break;
				case 'selection':
					files = await createFromSelection();
					defaultDescription = 'Code snippet';
					break;
				case 'empty':
					files = await createEmptyGist();
					defaultDescription = 'New gist';
					break;
				case 'multi-file':
					files = await createMultiFileGist();
					defaultDescription = 'Multi-file gist';
					break;
			}

			if (Object.keys(files).length === 0) {
				return;
			}

			// Get folder path and display name
			const folderAndName = await getFolderPathAndName(defaultDescription);
			if (!folderAndName) {
				return;
			}

			// Build the description from folder path and display name
			let description = folderAndName.displayName;
			if (folderAndName.folderPath) {
				description = `${folderAndName.folderPath} - ${folderAndName.displayName}`;
			}

			// Ask if gist should be public
			const visibility = await vscode.window.showQuickPick([
				{
					label: '$(lock) Private',
					description: 'Only you can see this gist',
					detail: 'private'
				},
				{
					label: '$(globe) Public',
					description: 'Anyone can see this gist',
					detail: 'public'
				}
			], {
				placeHolder: 'Choose gist visibility',
				ignoreFocusOut: true
			});

			if (!visibility) {
				return;
			}

			const isPublic = visibility.detail === 'public';

			// Create the gist
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Creating gist...',
				cancellable: false
			}, async () => {
				const newGist = await githubService.createGist(description || '', files, isPublic);
				
				// Refresh the gist list
				myGistsProvider.refresh();
				
				// Show success message with options
				const action = await vscode.window.showInformationMessage(
					`Gist created successfully! ${isPublic ? '(Public)' : '(Private)'}`,
					'Open Gist',
					'Copy URL',
					'Edit Now'
				);

				if (action === 'Open Gist') {
					vscode.env.openExternal(vscode.Uri.parse(newGist.html_url));
				} else if (action === 'Copy URL') {
					vscode.env.clipboard.writeText(newGist.html_url);
					vscode.window.showInformationMessage('Gist URL copied to clipboard!');
				} else if (action === 'Edit Now') {
					// Open the first file for editing
					const firstFile = Object.values(newGist.files)[0];
					if (firstFile) {
						await openGistFile(newGist, firstFile);
					}
				}
			});

		} catch (error) {
			console.error('Error creating gist:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	const openGistCommand = vscode.commands.registerCommand('gist-editor.openGist', async (gist?: Gist) => {
		if (!gist) {
			vscode.window.showInformationMessage('No gist selected');
			return;
		}

		try {
			// Get full gist details with file contents
			const fullGist = await githubService.getGist(gist.id);
			
			// Open each file in the gist
			const files = Object.values(fullGist.files);
			
			if (files.length === 0) {
				vscode.window.showInformationMessage('This gist has no files');
				return;
			}

			// If multiple files, ask which one to open first
			if (files.length > 1) {
				const selectedFile = await vscode.window.showQuickPick(
					files.map(file => ({
						label: file.filename,
						description: `${file.language} • ${file.size} bytes`,
						detail: file.filename,
						file: file
					})),
					{
						placeHolder: 'Select a file to open',
						ignoreFocusOut: true
					}
				);

				if (selectedFile) {
					await openGistFile(fullGist, selectedFile.file);
				}
			} else {
				// Open the single file
				await openGistFile(fullGist, files[0]);
			}
		} catch (error) {
			console.error('Error opening gist:', error);
			vscode.window.showErrorMessage(`Failed to open gist: ${error}`);
		}
	});

	async function openGistFile(gist: Gist, file: any) {
		try {
			// Create a custom URI scheme for gist files
			// Encode the filename to handle special characters
			const encodedFilename = encodeURIComponent(file.filename);
			const uri = vscode.Uri.parse(`gist:/${gist.id}/${encodedFilename}`);

			// Open the document
			console.log(`Opening gist file: "${file.filename}" (${file.language || 'unknown language'})`);
			console.log(`Gist details: ID=${gist.id}, Public=${gist.public}, Owner=${gist.owner?.login}`);
			console.log(`Encoded filename: ${encodedFilename}`);
			console.log(`Opening URI: ${uri.toString()}`);
			
			const document = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(document);
			console.log(`Successfully opened document for ${file.filename}`);
			
			// Set the language mode - try multiple approaches
			try {
				let languageId = null;
				
				// First try: Use GitHub's language detection
				if (file.language && file.language !== 'Text') {
					languageId = getLanguageId(file.language);
				}
				
				// Second try: Use file extension
				if (!languageId || languageId === 'plaintext') {
					languageId = getLanguageFromExtension(file.filename);
				}
				
				// Apply the language if we found one
				if (languageId && languageId !== 'plaintext') {
					console.log(`Attempting to set language to ${languageId} for ${file.filename}`);
					await vscode.languages.setTextDocumentLanguage(document, languageId);
					console.log(`Successfully set language to ${languageId} for ${file.filename}`);
				} else {
					console.log(`Using default language (plaintext) for ${file.filename}`);
				}
			} catch (langError) {
				console.warn('Failed to set language mode:', langError);
				// Continue anyway - file will still open
			}

			vscode.window.showInformationMessage(`Opened ${file.filename} from gist "${gist.description || 'Untitled'}"`);
		} catch (error: any) {
			console.error('Error opening gist file:', error);
			
			// Provide more specific error messages
			let errorMessage = `Failed to open file: `;
			if (error.message?.includes('Access denied') || error.message?.includes('403')) {
				errorMessage += `Access denied. This private gist might not be accessible with your current token.`;
			} else if (error.message?.includes('not found') || error.message?.includes('404')) {
				errorMessage += `Gist not found or has been deleted.`;
			} else if (error.message?.includes('File') && error.message?.includes('not found')) {
				errorMessage += `File "${file.filename}" not found in gist.`;
			} else {
				errorMessage += error.message || 'Unknown error';
			}
			
			vscode.window.showErrorMessage(errorMessage);
		}
	}

	function getLanguageId(githubLanguage: string): string {
		const languageMap: { [key: string]: string } = {
			'JavaScript': 'javascript',
			'TypeScript': 'typescript',
			'Python': 'python',
			'Java': 'java',
			'C++': 'cpp',
			'C': 'c',
			'C#': 'csharp',
			'HTML': 'html',
			'CSS': 'css',
			'JSON': 'json',
			'Markdown': 'markdown',
			'Shell': 'shellscript',
			'PowerShell': 'powershell',
			'SQL': 'sql',
			'XML': 'xml',
			'YAML': 'yaml',
			'PHP': 'php',
			'Ruby': 'ruby',
			'Go': 'go',
			'Rust': 'rust',
			'Swift': 'swift',
			'Kotlin': 'kotlin',
			'Dart': 'dart',
			'Text': 'plaintext',
			'R': 'r',
			'Scala': 'scala',
			'Perl': 'perl',
			'Lua': 'lua',
			'Haskell': 'haskell',
			'Clojure': 'clojure',
			'F#': 'fsharp',
			'Visual Basic': 'vb',
			'SCSS': 'scss',
			'Sass': 'sass',
			'Less': 'less',
			'Stylus': 'stylus',
			'Vue': 'vue',
			'React': 'jsx',
			'JSX': 'jsx',
			'TSX': 'tsx',
			'Dockerfile': 'dockerfile',
			'Makefile': 'makefile',
			'Bash': 'shellscript',
			'Zsh': 'shellscript',
			'Fish': 'fish',
			'Batch': 'bat',
			'Assembly': 'asm',
			'TOML': 'toml',
			'INI': 'ini',
			'Properties': 'properties',
			'LaTeX': 'latex',
			'Objective-C': 'objective-c',
			'Objective-C++': 'objective-cpp'
		};
		return languageMap[githubLanguage] || 'plaintext';
	}

	function getLanguageFromExtension(filename: string): string {
		const extension = filename.split('.').pop()?.toLowerCase() || '';
		
		const extensionMap: { [key: string]: string } = {
			// JavaScript family
			'js': 'javascript',
			'jsx': 'jsx',
			'ts': 'typescript',
			'tsx': 'tsx',
			'mjs': 'javascript',
			'cjs': 'javascript',
			
			// Python
			'py': 'python',
			'pyw': 'python',
			'pyx': 'python',
			'pyi': 'python',
			
			// Web technologies
			'html': 'html',
			'htm': 'html',
			'xhtml': 'html',
			'css': 'css',
			'scss': 'scss',
			'sass': 'sass',
			'less': 'less',
			'styl': 'stylus',
			
			// Data formats
			'json': 'json',
			'jsonc': 'jsonc',
			'json5': 'json5',
			'xml': 'xml',
			'yaml': 'yaml',
			'yml': 'yaml',
			'toml': 'toml',
			'ini': 'ini',
			'properties': 'properties',
			'cfg': 'ini',
			'conf': 'properties',
			
			// Documentation
			'md': 'markdown',
			'markdown': 'markdown',
			'mdown': 'markdown',
			'mkd': 'markdown',
			'tex': 'latex',
			'latex': 'latex',
			'rst': 'restructuredtext',
			'adoc': 'asciidoc',
			'org': 'org',
			
			// Programming languages
			'java': 'java',
			'kt': 'kotlin',
			'kts': 'kotlin',
			'scala': 'scala',
			'sc': 'scala',
			'groovy': 'groovy',
			'gradle': 'gradle',
			
			// C family
			'c': 'c',
			'h': 'c',
			'cpp': 'cpp',
			'cxx': 'cpp',
			'cc': 'cpp',
			'hpp': 'cpp',
			'hxx': 'cpp',
			'hh': 'cpp',
			'cs': 'csharp',
			'fs': 'fsharp',
			'fsx': 'fsharp',
			'fsi': 'fsharp',
			
			// Mobile
			'swift': 'swift',
			'dart': 'dart',
			'm': 'objective-c',
			'mm': 'objective-cpp',
			
			// Functional languages
			'hs': 'haskell',
			'lhs': 'literate-haskell',
			'elm': 'elm',
			'clj': 'clojure',
			'cljs': 'clojure',
			'cljc': 'clojure',
			'ml': 'ocaml',
			'mli': 'ocaml',
			'f90': 'fortran-modern',
			'f95': 'fortran-modern',
			
			// Scripting languages
			'rb': 'ruby',
			'rbx': 'ruby',
			'rjs': 'ruby',
			'gemspec': 'ruby',
			'rake': 'ruby',
			'php': 'php',
			'php3': 'php',
			'php4': 'php',
			'php5': 'php',
			'phtml': 'php',
			'pl': 'perl',
			'pm': 'perl',
			'pod': 'perl',
			't': 'perl',
			'lua': 'lua',
			'r': 'r',
			'R': 'r',
			'rmd': 'rmd',
			
			// Systems languages
			'go': 'go',
			'rs': 'rust',
			'zig': 'zig',
			'nim': 'nim',
			'cr': 'crystal',
			'd': 'd',
			
			// Shell scripts
			'sh': 'shellscript',
			'bash': 'shellscript',
			'zsh': 'shellscript',
			'fish': 'fish',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'psd1': 'powershell',
			'bat': 'bat',
			'cmd': 'bat',
			
			// SQL
			'sql': 'sql',
			'mysql': 'sql',
			'pgsql': 'sql',
			'plsql': 'plsql',
			
			// Assembly
			'asm': 'asm',
			's': 'asm',
			'S': 'asm',
			'nasm': 'nasm',
			
			// Docker & Infrastructure
			'dockerfile': 'dockerfile',
			'containerfile': 'dockerfile',
			'makefile': 'makefile',
			'mk': 'makefile',
			'cmake': 'cmake',
			'tf': 'terraform',
			'hcl': 'hcl',
			
			// Frontend frameworks
			'vue': 'vue',
			'svelte': 'svelte',
			'astro': 'astro',
			
			// Other common formats
			'txt': 'plaintext',
			'text': 'plaintext',
			'log': 'log',
			'csv': 'csv',
			'tsv': 'tsv',
			'svg': 'xml',
			'graphql': 'graphql',
			'gql': 'graphql',
			'proto': 'protobuf',
			'thrift': 'thrift'
		};
		
		return extensionMap[extension] || 'plaintext';
	}

	// Helper function to get folder path and display name from user
	async function getFolderPathAndName(defaultName: string): Promise<{ folderPath?: string; displayName: string } | null> {
		// Ask if user wants to organize in a folder
		const organizeChoice = await vscode.window.showQuickPick([
			{
				label: '📁 Organize in a folder',
				description: 'Create folder hierarchy (e.g., React/Components)',
				detail: 'with-folder'
			},
			{
				label: '📄 No folder (flat)',
				description: 'Keep at root level',
				detail: 'no-folder'
			}
		], {
			placeHolder: 'Do you want to organize this gist in a folder?',
			ignoreFocusOut: true
		});

		if (!organizeChoice) {
			return null;
		}

		let folderPath: string | undefined = undefined;
		let displayName = defaultName;

		if (organizeChoice.detail === 'with-folder') {
			// Ask for folder path
			folderPath = await vscode.window.showInputBox({
				prompt: 'Enter folder path (use / to nest, e.g., React/Components)',
				placeHolder: 'React/Components',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (value && value.includes('--')) {
						return 'Folder path cannot contain --';
					}
					return null;
				}
			});

			if (!folderPath) {
				return null;
			}

			// Ask for gist name/display name
			displayName = await vscode.window.showInputBox({
				prompt: 'Enter gist name (display name)',
				value: defaultName,
				placeHolder: 'My component',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value || !value.trim()) {
						return 'Display name cannot be empty';
					}
					return null;
				}
			}) || defaultName;
		} else {
			// Just ask for description
			displayName = await vscode.window.showInputBox({
				prompt: 'Enter a description for your gist',
				value: defaultName,
				placeHolder: 'Gist description',
				ignoreFocusOut: true
			}) || defaultName;
		}

		return {
			folderPath,
			displayName
		};
	}

	// Helper functions for creating gists
	async function createFromCurrentFile(): Promise<{ [filename: string]: { content: string } }> {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('No file is currently open');
			return {};
		}

		const document = activeEditor.document;
		const content = document.getText();
		
		if (!content.trim()) {
			vscode.window.showErrorMessage('Current file is empty. GitHub requires gist content.');
			return {};
		}

		// Get filename from document
		const fileName = document.fileName.split(/[/\\]/).pop() || 'untitled.txt';
		
		return {
			[fileName]: { content }
		};
	}

	async function createFromSelection(): Promise<{ [filename: string]: { content: string } }> {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('No file is currently open');
			return {};
		}

		const selection = activeEditor.selection;
		const selectedText = activeEditor.document.getText(selection);
		
		if (!selectedText.trim()) {
			vscode.window.showErrorMessage('No text is selected or selection is empty. GitHub requires gist content.');
			return {};
		}

		// Get file extension from current document
		const document = activeEditor.document;
		const fileName = document.fileName.split(/[/\\]/).pop() || 'untitled.txt';
		const extension = fileName.split('.').pop() || 'txt';
		
		const gistFileName = await vscode.window.showInputBox({
			prompt: 'Enter filename for the selected code',
			value: `snippet.${extension}`,
			placeHolder: 'filename.ext',
			ignoreFocusOut: true
		});

		if (!gistFileName) {
			return {};
		}

		return {
			[gistFileName]: { content: selectedText }
		};
	}

	async function createEmptyGist(): Promise<{ [filename: string]: { content: string } }> {
		const fileName = await vscode.window.showInputBox({
			prompt: 'Enter filename for your new gist',
			value: 'untitled.txt',
			placeHolder: 'filename.ext',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Filename cannot be empty';
				}
				return null;
			}
		});

		if (!fileName) {
			return {};
		}

		// Provide smart default content based on file extension
		const extension = fileName.split('.').pop()?.toLowerCase() || '';
		let defaultContent = '// Add your content here';
		
		switch (extension) {
			case 'js':
			case 'ts':
				defaultContent = 'console.log("Hello, World!");';
				break;
			case 'py':
				defaultContent = 'print("Hello, World!")';
				break;
			case 'java':
				defaultContent = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}';
				break;
			case 'html':
				defaultContent = '<!DOCTYPE html>\n<html>\n<head>\n    <title>My Gist</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>';
				break;
			case 'css':
				defaultContent = 'body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}';
				break;
			case 'md':
				defaultContent = '# My Gist\n\nAdd your content here...';
				break;
			case 'json':
				defaultContent = '{\n    "name": "example",\n    "version": "1.0.0"\n}';
				break;
			case 'sh':
				defaultContent = '#!/bin/bash\necho "Hello, World!"';
				break;
			default:
				defaultContent = 'Add your content here...';
		}

		const content = await vscode.window.showInputBox({
			prompt: 'Enter content for your gist (required)',
			value: defaultContent,
			placeHolder: 'Gist content is required by GitHub...',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Content cannot be empty - GitHub requires gist content';
				}
				return null;
			}
		});

		if (!content) {
			return {};
		}

		return {
			[fileName]: { content }
		};
	}

	async function createMultiFileGist(): Promise<{ [filename: string]: { content: string } }> {
		const files: { [filename: string]: { content: string } } = {};
		
		while (true) {
			const fileName = await vscode.window.showInputBox({
				prompt: `Enter filename for file #${Object.keys(files).length + 1} (or press Escape to finish)`,
				placeHolder: 'filename.ext',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value.trim()) {
						return 'Filename cannot be empty';
					}
					if (files[value]) {
						return 'Filename already exists';
					}
					return null;
				}
			});

			if (!fileName) {
				break; // User cancelled or finished
			}

			// Provide smart default content based on file extension
			const extension = fileName.split('.').pop()?.toLowerCase() || '';
			let defaultContent = 'Add content here...';
			
			switch (extension) {
				case 'js':
				case 'ts':
					defaultContent = 'console.log("Hello from ' + fileName + '");';
					break;
				case 'py':
					defaultContent = 'print("Hello from ' + fileName + '")';
					break;
				case 'md':
					defaultContent = '# ' + fileName.replace(/\.[^/.]+$/, '') + '\n\nAdd your content here...';
					break;
				case 'json':
					defaultContent = '{\n    "file": "' + fileName + '",\n    "content": "example"\n}';
					break;
				default:
					defaultContent = 'Add content for ' + fileName + ' here...';
			}

			const content = await vscode.window.showInputBox({
				prompt: `Enter content for ${fileName} (required)`,
				value: defaultContent,
				placeHolder: 'File content is required...',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value.trim()) {
						return 'Content cannot be empty - GitHub requires file content';
					}
					return null;
				}
			});

			if (!content) {
				// User cancelled, remove this iteration
				continue;
			}

			files[fileName] = { content };

			// Ask if user wants to add more files
			const addMore = await vscode.window.showQuickPick([
				{ label: 'Yes', detail: 'add-more' },
				{ label: 'No, create gist now', detail: 'finish' }
			], {
				placeHolder: 'Add another file?',
				ignoreFocusOut: true
			});

			if (!addMore || addMore.detail === 'finish') {
				break;
			}
		}

		if (Object.keys(files).length === 0) {
			vscode.window.showInformationMessage('No files added. Gist creation cancelled.');
		}

		return files;
	}

	// Command to create gist from current file
	const createGistFromFileCommand = vscode.commands.registerCommand('gist-editor.createGistFromFile', async () => {
		// Ensure user is authenticated
		if (!githubService.isAuthenticated()) {
			try {
				await githubService.getOAuthToken();
			} catch (error) {
				const setup = await vscode.window.showErrorMessage(
					'You need to sign in with GitHub to create gists.',
					'Sign in with GitHub'
				);
				if (setup === 'Sign in with GitHub') {
					vscode.commands.executeCommand('gist-editor.setupToken');
				}
				return;
			}
		}

		try {
			const files = await createFromCurrentFile();
			if (Object.keys(files).length === 0) {
				return;
			}

			await createGistFromFiles(files, `Gist from ${Object.keys(files)[0]}`);
		} catch (error) {
			console.error('Error creating gist from file:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	// Command to create gist from selection
	const createGistFromSelectionCommand = vscode.commands.registerCommand('gist-editor.createGistFromSelection', async () => {
		// Ensure user is authenticated
		if (!githubService.isAuthenticated()) {
			try {
				await githubService.getOAuthToken();
			} catch (error) {
				const setup = await vscode.window.showErrorMessage(
					'You need to sign in with GitHub to create gists.',
					'Sign in with GitHub'
				);
				if (setup === 'Sign in with GitHub') {
					vscode.commands.executeCommand('gist-editor.setupToken');
				}
				return;
			}
		}

		try {
			const files = await createFromSelection();
			if (Object.keys(files).length === 0) {
				return;
			}

			await createGistFromFiles(files, 'Code snippet');
		} catch (error) {
			console.error('Error creating gist from selection:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	// Helper function to create gist from files
	async function createGistFromFiles(files: { [filename: string]: { content: string } }, defaultDescription: string) {
		// Validate that all files have content
		const emptyFiles = Object.entries(files).filter(([_, file]) => !file.content.trim());
		if (emptyFiles.length > 0) {
			vscode.window.showErrorMessage(`Cannot create gist: ${emptyFiles.map(([name]) => name).join(', ')} ${emptyFiles.length === 1 ? 'is' : 'are'} empty. GitHub requires all files to have content.`);
			return;
		}

		// Get folder path and display name
		const folderAndName = await getFolderPathAndName(defaultDescription);
		if (!folderAndName) {
			return;
		}

		// Build the description from folder path and display name
		let description = folderAndName.displayName;
		if (folderAndName.folderPath) {
			description = `${folderAndName.folderPath} - ${folderAndName.displayName}`;
		}

		// Ask if gist should be public
		const visibility = await vscode.window.showQuickPick([
			{
				label: '$(lock) Private',
				description: 'Only you can see this gist',
				detail: 'private'
			},
			{
				label: '$(globe) Public',
				description: 'Anyone can see this gist',
				detail: 'public'
			}
		], {
			placeHolder: 'Choose gist visibility',
			ignoreFocusOut: true
		});

		if (!visibility) {
			return;
		}

		const isPublic = visibility.detail === 'public';

		// Create the gist
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Creating gist...',
			cancellable: false
		}, async () => {
			const newGist = await githubService.createGist(description || '', files, isPublic);
			
			// Refresh the gist list
			myGistsProvider.refresh();
			
			// Show success message with options
			const action = await vscode.window.showInformationMessage(
				`Gist created successfully! ${isPublic ? '(Public)' : '(Private)'}`,
				'Open Gist',
				'Copy URL',
				'Edit Now'
			);

			if (action === 'Open Gist') {
				vscode.env.openExternal(vscode.Uri.parse(newGist.html_url));
			} else if (action === 'Copy URL') {
				vscode.env.clipboard.writeText(newGist.html_url);
				vscode.window.showInformationMessage('Gist URL copied to clipboard!');
			} else if (action === 'Edit Now') {
				// Open the first file for editing
				const firstFile = Object.values(newGist.files)[0];
				if (firstFile) {
					await openGistFile(newGist, firstFile);
				}
			}
		});
	}

	// Command to open a specific gist file
	const openGistFileCommand = vscode.commands.registerCommand('gist-editor.openGistFile', async (gist: Gist, file: any) => {
		await openGistFile(gist, file);
	});

	const setupTokenCommand = vscode.commands.registerCommand('gist-editor.setupToken', async () => {
		const isAuthenticated = githubService.isAuthenticated();

		// Show current status and options
		const tokenStatus = githubService.getTokenStatus();
		const action = await vscode.window.showQuickPick([
			{
				label: isAuthenticated ? '$(github) Sign in with GitHub' : '$(github) Sign in with GitHub',
				description: isAuthenticated ? 'Sign in again or switch account' : 'Quick OAuth login - opens your browser',
				detail: 'oauth'
			},
			{
				label: '$(key) Use Personal Access Token',
				description: 'Manually enter a GitHub Personal Access Token',
				detail: 'manual'
			},
			...(isAuthenticated ? [{
				label: '$(trash) Sign Out',
				description: 'Sign out and remove GitHub authentication',
				detail: 'logout'
			}] : [])
		], {
			placeHolder: `Current Status: ${tokenStatus}`,
			ignoreFocusOut: true
		});

		if (!action) {
			return;
		}

		if (action.detail === 'oauth') {
			// Use OAuth flow
			try {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Signing in with GitHub...',
					cancellable: false
				}, async () => {
					await githubService.getOAuthToken();

					// Get username to confirm login
					const username = await githubService.getCurrentUsername();

					vscode.window.showInformationMessage(
						`Successfully signed in as @${username}!`,
						'Refresh Gists'
					).then(selection => {
						if (selection === 'Refresh Gists') {
							myGistsProvider.refresh();
							starredGistsProvider.refresh();
						}
					});

					// Auto-refresh after successful authentication
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
					commentProvider.refresh();
				});
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to authenticate with GitHub: ${error}`,
					'Try Again'
				).then(selection => {
					if (selection === 'Try Again') {
						vscode.commands.executeCommand('gist-editor.setupToken');
					}
				});
			}
			return;
		}

		if (action.detail === 'logout') {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to sign out?',
				{ modal: true },
				'Sign Out',
				'Cancel'
			);

			if (confirm === 'Sign Out') {
				try {
					await githubService.removeToken();
					vscode.window.showInformationMessage('You have been signed out!');
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
					commentProvider.clearSelectedGist();
					commentProvider.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to sign out: ${error}`);
				}
			}
			return;
		}

		// Manual token entry
		const token = await vscode.window.showInputBox({
			prompt: 'Enter your GitHub Personal Access Token',
			password: true,
			placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value) {
					return 'Token cannot be empty';
				}
				if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
					return 'Invalid token format. GitHub tokens start with "ghp_" or "github_pat_"';
				}
				return null;
			}
		});

		if (token) {
			try {
				await githubService.setToken(token);
				vscode.window.showInformationMessage(
					'GitHub token configured successfully!',
					'Refresh Gists'
				).then(selection => {
					if (selection === 'Refresh Gists') {
						myGistsProvider.refresh();
						starredGistsProvider.refresh();
					}
				});

				// Auto-refresh after successful token setup
				myGistsProvider.refresh();
				starredGistsProvider.refresh();
				commentProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to configure GitHub token: ${error}`,
					'Try Again'
				).then(selection => {
					if (selection === 'Try Again') {
						vscode.commands.executeCommand('gist-editor.setupToken');
					}
				});
			}
		}
	});

	const testApiCommand = vscode.commands.registerCommand('gist-editor.testAPI', async () => {
		try {
			console.log('Testing GitHub API...');
			const isAuth = githubService.isAuthenticated();
			console.log('Is authenticated:', isAuth);
			
			if (!isAuth) {
				vscode.window.showWarningMessage('Please set up GitHub token first');
				return;
			}
			
			// Test fetching user and check scopes
			const username = await githubService.getCurrentUsername();
			console.log('Current user:', username);
			
			const gists = await githubService.getMyGists();
			
			// Count public vs private
			const publicCount = gists.filter(g => g.public).length;
			const privateCount = gists.filter(g => !g.public).length;
			
			vscode.window.showInformationMessage(
				`Found ${gists.length} gists!\nPublic: ${publicCount}, Private: ${privateCount}`,
				'Show Details'
			).then(selection => {
				if (selection === 'Show Details') {
					const details = gists.map(g => `${g.public ? '🌐' : '🔒'} ${g.description || 'Untitled'}`).join('\n');
					vscode.window.showInformationMessage(details);
				}
			});
			console.log('Gists:', gists.map(g => ({ id: g.id, public: g.public, desc: g.description })));
		} catch (error) {
			console.error('API test error:', error);
			vscode.window.showErrorMessage(`API test failed: ${error}`);
		}
	});

	// Diagnostic command to check token scopes
	const checkScopesCommand = vscode.commands.registerCommand('gist-editor.checkScopes', async () => {
		try {
			if (!githubService.isAuthenticated()) {
				vscode.window.showWarningMessage('No GitHub token configured. Please set up authentication first.');
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Checking GitHub token permissions...',
				cancellable: false
			}, async () => {
				try {
					// Check token scopes
					const scopes = await githubService.checkTokenScopes();
					const hasGistScope = scopes.includes('gist');
					
					// Fetch username and gists
					const username = await githubService.getCurrentUsername();
					const gists = await githubService.getMyGists();
					
					const publicCount = gists.filter(g => g.public).length;
					const privateCount = gists.filter(g => !g.public).length;
					
					let message = `✓ Authenticated as: ${username}\n`;
					message += `✓ Token scopes: ${scopes.join(', ')}\n\n`;
					message += `Total gists: ${gists.length}\n`;
					message += `📂 Public gists: ${publicCount}\n`;
					message += `🔒 Private gists: ${privateCount}\n\n`;
					
					if (!hasGistScope) {
						message += `❌ PROBLEM FOUND: Your token is missing the "gist" scope!\n\n`;
						message += `This is why you cannot access private gists.\n\n`;
						message += `To fix this:\n`;
						message += `1. Go to github.com/settings/tokens\n`;
						message += `2. Click "Generate new token (classic)"\n`;
						message += `3. Check the "gist" checkbox ✓\n`;
						message += `4. Generate and copy the token\n`;
						message += `5. Click the gear (⚙️) button in "My Gists" view\n`;
						message += `6. Select "Change GitHub Token" and paste your new token`;
						
						vscode.window.showErrorMessage(message, 'Open GitHub Settings', 'Setup Token').then(selection => {
							if (selection === 'Open GitHub Settings') {
								vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
							} else if (selection === 'Setup Token') {
								vscode.commands.executeCommand('gist-editor.setupToken');
							}
						});
					} else if (privateCount === 0 && publicCount > 0) {
						message += `✓ Your token has the "gist" scope.\n`;
						message += `ℹ️ You either have no private gists, or they're not showing up.\n\n`;
						message += `Try:\n`;
						message += `1. Check on github.com/gists if you have private gists\n`;
						message += `2. Click the refresh button in the Gist Editor sidebar`;
						
						vscode.window.showInformationMessage(message, 'Refresh Gists').then(selection => {
							if (selection === 'Refresh Gists') {
								vscode.commands.executeCommand('gist-editor.refresh');
							}
						});
					} else {
						message += `✓ Everything looks good! Your token has proper access.`;
						vscode.window.showInformationMessage(message, 'OK');
					}
				} catch (error: any) {
					let errorMsg = '❌ Token Permission Check Failed\n\n';
					
					if (error.response?.status === 403) {
						errorMsg += 'Your token does not have the required permissions.\n\n';
						errorMsg += '🔧 FIX: Create a new GitHub Personal Access Token\n\n';
						errorMsg += 'Steps:\n';
						errorMsg += '1. Visit: github.com/settings/tokens\n';
						errorMsg += '2. "Generate new token (classic)"\n';
						errorMsg += '3. Name: "VS Code Gist Editor"\n';
						errorMsg += '4. ✓ Check the "gist" scope\n';
						errorMsg += '5. Click "Generate token"\n';
						errorMsg += '6. Copy the token (you only see it once!)\n';
						errorMsg += '7. In VS Code: Click ⚙️ in Gist Editor → Update token';
					} else if (error.response?.status === 401) {
						errorMsg += 'Your token is invalid or has been revoked.\n\n';
						errorMsg += 'Please create a new token with the "gist" scope.';
					} else {
						errorMsg += `Error: ${error.message}\n\n`;
						errorMsg += 'This might be a network issue or GitHub API problem.';
					}
					
					vscode.window.showErrorMessage(errorMsg, 'Open Token Settings', 'Setup Token').then(selection => {
						if (selection === 'Open Token Settings') {
							vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
						} else if (selection === 'Setup Token') {
							vscode.commands.executeCommand('gist-editor.setupToken');
						}
					});
				}
			});
		} catch (error) {
			console.error('Scope check error:', error);
			vscode.window.showErrorMessage(`Failed to check permissions: ${error}`);
		}
	});

	// Save gist command
	const saveGistCommand = vscode.commands.registerCommand('gist-editor.saveGist', async () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const document = activeEditor.document;
		if (document.uri.scheme !== 'gist') {
			vscode.window.showErrorMessage('This is not a gist file');
			return;
		}

		// Just save the document - the FileSystemProvider will handle uploading to GitHub
		try {
			await document.save();
			const pathParts = document.uri.path.substring(1).split('/');
			const filename = decodeURIComponent(pathParts.slice(1).join('/'));
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Saved ${filename} to gist`);
		} catch (error) {
			console.error('Error saving gist:', error);
			vscode.window.showErrorMessage(`Failed to save gist: ${error}`);
		}
	});

	// Note: Auto-save is now handled automatically by the FileSystemProvider
	// No need for a separate save listener

	// Delete gist command
	const deleteGistCommand = vscode.commands.registerCommand('gist-editor.deleteGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('No gist selected');
			return;
		}

		const gist = gistItem.gist;
		const gistDescription = gist.description || 'Untitled';
		
		const confirmation = await vscode.window.showWarningMessage(
			`Are you sure you want to delete "${gistDescription}"?`,
			{ modal: true },
			'Delete'
		);

		if (confirmation !== 'Delete') {
			return;
		}

		try {
			await githubService.deleteGist(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Deleted gist "${gistDescription}"`);
		} catch (error) {
			console.error('Error deleting gist:', error);
			vscode.window.showErrorMessage(`Failed to delete gist: ${error}`);
		}
	});

	// Rename gist command
	const renameGistCommand = vscode.commands.registerCommand('gist-editor.renameGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('No gist selected');
			return;
		}

		const gist = gistItem.gist;
		const parsed = parseGistDescription(gist.description || '');

		// Get new folder path and display name
		const newFolderAndName = await getFolderPathAndName(parsed.displayName);
		if (!newFolderAndName) {
			return;
		}

		// Build the new description
		let newDescription = newFolderAndName.displayName;
		if (newFolderAndName.folderPath) {
			newDescription = `${newFolderAndName.folderPath} - ${newFolderAndName.displayName}`;
		}

		try {
			await githubService.updateGist(gist.id, newDescription);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Renamed gist to "${newDescription}"`);
		} catch (error) {
			console.error('Error renaming gist:', error);
			vscode.window.showErrorMessage(`Failed to rename gist: ${error}`);
		}
	});

	// Toggle star/unstar gist command
	const toggleStarGistCommand = vscode.commands.registerCommand('gist-editor.toggleStarGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('No gist selected');
			return;
		}

		const gist = gistItem.gist;

		try {
			console.log(`[ToggleStar] Checking if gist ${gist.id} is starred...`);
			const isStarred = await githubService.checkIfStarred(gist.id);
			console.log(`[ToggleStar] Gist is currently ${isStarred ? 'starred' : 'not starred'}`);

			if (isStarred) {
				// Unstar
				console.log(`[ToggleStar] Unstarring gist ${gist.id}`);
				await githubService.unstarGist(gist.id);
				vscode.window.showInformationMessage(`✓ Removed star from "${gist.description}"`);
			} else {
				// Star
				console.log(`[ToggleStar] Starring gist ${gist.id}`);
				await githubService.starGist(gist.id);
				vscode.window.showInformationMessage(`⭐ Starred "${gist.description}"`);
			}

			// Refresh to update the UI
			myGistsProvider.refresh();
			starredGistsProvider.refresh();
		} catch (error) {
			console.error('[ToggleStar] Error toggling star:', error);
			vscode.window.showErrorMessage(`Failed to toggle star: ${error}`);
		}
	});

	// Add file to gist command
	const addFileToGistCommand = vscode.commands.registerCommand('gist-editor.addFileToGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('No gist selected');
			return;
		}

		const gist = gistItem.gist;

		const filename = await vscode.window.showInputBox({
			prompt: 'Enter filename (with extension)',
			placeHolder: 'example.txt',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Filename cannot be empty';
				}
				if (gist.files[value]) {
					return 'A file with this name already exists in the gist';
				}
				return null;
			}
		});

		if (!filename) {
			return; // User cancelled
		}

		const content = await vscode.window.showInputBox({
			prompt: 'Enter initial content for the file (optional)',
			placeHolder: 'File content',
			value: ''
		});

		if (content === undefined) {
			return; // User cancelled
		}

		try {
			await githubService.updateGist(gist.id, undefined, {
				[filename]: { content: content || ' ' } // GitHub requires non-empty content
			});
			
			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Added file "${filename}" to gist`);
			
			// Open the new file
			const uri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(filename)}`);
			await vscode.window.showTextDocument(uri);
		} catch (error) {
			console.error('Error adding file to gist:', error);
			vscode.window.showErrorMessage(`Failed to add file: ${error}`);
		}
	});

	// Delete file from gist command
	const deleteFileFromGistCommand = vscode.commands.registerCommand('gist-editor.deleteFileFromGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No file selected');
			return;
		}

		const gist = gistItem.gist;
		const file = gistItem.file;
		
		const confirmation = await vscode.window.showWarningMessage(
			`Are you sure you want to delete "${file.filename}" from this gist?`,
			{ modal: true },
			'Delete'
		);

		if (confirmation !== 'Delete') {
			return;
		}

		try {
			// To delete a file, we need to update the gist with all files except the one to delete
			// First, get the current gist to have all files
			const currentGist = await githubService.getGist(gist.id);

			// Create update with all files except the one to delete
			const filesUpdate: any = {};
			for (const [filename, fileObj] of Object.entries(currentGist.files)) {
				if (filename !== file.filename) {
					filesUpdate[filename] = { content: fileObj.content || '' };
				}
			}

			// If gist has only one file, we can't delete it - GitHub doesn't allow empty gists
			if (Object.keys(filesUpdate).length === 0) {
				vscode.window.showErrorMessage('Cannot delete the last file in a gist. GitHub Gists must contain at least one file.');
				return;
			}

			await githubService.updateGist(gist.id, undefined, filesUpdate);
			
			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Deleted file "${file.filename}"`);
		} catch (error) {
			console.error('Error deleting file:', error);
			vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
		}
	});

	// Rename file in gist command
	const renameFileInGistCommand = vscode.commands.registerCommand('gist-editor.renameFileInGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No file selected');
			return;
		}

		const gist = gistItem.gist;
		const file = gistItem.file;
		const oldFilename = file.filename;

		const newFilename = await vscode.window.showInputBox({
			prompt: 'Enter new filename',
			value: oldFilename,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Filename cannot be empty';
				}
				if (value !== oldFilename && gist.files[value]) {
					return 'A file with this name already exists in the gist';
				}
				return null;
			}
		});

		if (!newFilename || newFilename.trim() === '' || newFilename === oldFilename) {
			return; // User cancelled or didn't change the name
		}

		try {
			// Use the old filename as the key, with "filename" property for the new name
			const filesUpdate: any = {
				[oldFilename]: {
					filename: newFilename,  // New name goes in the filename property
					content: file.content || ' '
				}
			};
			await githubService.updateGist(gist.id, undefined, filesUpdate);

			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Renamed "${oldFilename}" to "${newFilename}"`);

			// Close old document if open
			const oldUri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(oldFilename)}`);
			const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === oldUri.toString());
			if (openDoc) {
				await vscode.window.showTextDocument(openDoc);
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			}

			// Open renamed file
			const newUri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(newFilename)}`);
			await vscode.window.showTextDocument(newUri);
		} catch (error) {
			console.error('Error renaming file:', error);
			vscode.window.showErrorMessage(`Failed to rename file: ${error}`);
		}
	});

			const viewGistHistoryCommand = vscode.commands.registerCommand('gist-editor.viewGistHistory', async (gistItem: GistItem) => {
		if (!gistItem || gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('Please select a gist (not a file)');
			return;
		}

		const gist = gistItem.gist;

		try {
			const revisions = await githubService.getGistRevisions(gist.id);
			
			if (revisions.length === 0) {
				vscode.window.showInformationMessage('No revision history found for this gist');
				return;
			}

			// Create QuickPick items for each revision
			interface RevisionQuickPickItem extends vscode.QuickPickItem {
				revision: any;
			}

			const items: RevisionQuickPickItem[] = revisions.map((rev, index) => {
				const date = new Date(rev.committed_at);
				const isLatest = index === 0;
				return {
					label: `$(history) ${date.toLocaleString()}${isLatest ? ' $(star) Latest' : ''}`,
					description: `+${rev.change_status.additions} -${rev.change_status.deletions} • ${rev.user.login}`,
					detail: `Version: ${rev.version.substring(0, 7)}`,
					revision: rev
				};
			});

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: `Select a revision to view (${revisions.length} total)`,
				matchOnDescription: true,
				matchOnDetail: true
			});

			if (!selected) {
				return; // User cancelled
			}

			// Fetch the gist at this revision
			const historicalGist = await githubService.getGistAtRevision(gist.id, selected.revision.version);
			
			// Show files from this revision
			const files = Object.values(historicalGist.files);
			if (files.length === 0) {
				vscode.window.showInformationMessage('No files in this revision');
				return;
			}

			interface FileQuickPickItem extends vscode.QuickPickItem {
				file: any;
			}

			const fileItems: FileQuickPickItem[] = files.map(file => ({
				label: `$(file) ${file.filename}`,
				description: `${file.language} • ${file.size} bytes`,
				file: file
			}));

			const selectedFile = await vscode.window.showQuickPick(fileItems, {
				placeHolder: 'Select a file to view from this revision'
			});

			if (!selectedFile) {
				return;
			}

			// Open the historical file in a new untitled document (read-only)
			const doc = await vscode.workspace.openTextDocument({
				content: selectedFile.file.content || '',
				language: getLanguageFromExtension(selectedFile.file.filename)
			});

			await vscode.window.showTextDocument(doc, {
				preview: true
			});

			vscode.window.showInformationMessage(
				`Viewing "${selectedFile.file.filename}" from ${new Date(selected.revision.committed_at).toLocaleString()} (read-only)`
			);

		} catch (error) {
			console.error('Error viewing gist history:', error);
			vscode.window.showErrorMessage(`Failed to load history: ${error}`);
		}
	});

	   const openInGitHubCommand = vscode.commands.registerCommand('gist-editor.openInGitHub', async (gistItem: GistItem) => {
		   if (!gistItem || !gistItem.gist) {
			   vscode.window.showErrorMessage('No gist or file selected');
			   return;
		   }
		   let url = '';
		   if (gistItem.file) {
			   // File: use raw_url if available, else fallback to gist HTML URL
			   url = gistItem.file.raw_url || gistItem.gist.html_url;
		   } else {
			   // Gist: open gist page
			   url = gistItem.gist.html_url;
		   }
		   if (!url) {
			   vscode.window.showErrorMessage('No GitHub URL found for this item');
			   return;
		   }
		   vscode.env.openExternal(vscode.Uri.parse(url));
	   });

	   const createSubfolderInFolderCommand = vscode.commands.registerCommand(
		   'gist-editor.createSubfolderInFolder',
		   async (gistItem: GistItem) => {
			   if (!gistItem || !gistItem.folder) {
				   vscode.window.showErrorMessage('No folder selected');
				   return;
			   }

			   try {
				   // Get the current folder path
				   const parentPath = gistItem.folder.path;
				   const parentPathStr = parentPath.join('/');

				   // Ask user for subfolder name
				   const subfolderName = await vscode.window.showInputBox({
					   prompt: `Enter subfolder name (parent: ${parentPathStr})`,
					   placeHolder: 'e.g., Advanced, Utils, Helpers',
					   ignoreFocusOut: true,
					   validateInput: (value) => {
						   if (!value.trim()) {
							   return 'Subfolder name is required';
						   }
						   if (value.includes('/')) {
							   return 'Subfolder name cannot contain slashes';
						   }
						   return '';
					   }
				   });

				   if (!subfolderName) {
					   return; // User cancelled
				   }

				   // Build new folder path
				   const newFolderPath = [...parentPath, subfolderName.trim()];
				   const newFolderPathStr = newFolderPath.join('/');

				   // Get gist name and description
				   const gistName = await vscode.window.showInputBox({
					   prompt: 'Enter gist name for this subfolder',
					   placeHolder: 'e.g., My Utilities',
					   ignoreFocusOut: true,
					   validateInput: (value) => {
						   if (!value.trim()) {
							   return 'Gist name is required';
						   }
						   return '';
					   }
				   });

				   if (!gistName) {
					   return; // User cancelled
				   }

				   // Ask for visibility
				   const visibility = await vscode.window.showQuickPick([
					   {
						   label: '$(lock) Private',
						   description: 'Only you can see this gist',
						   detail: 'private'
					   },
					   {
						   label: '$(globe) Public',
						   description: 'Anyone can see this gist',
						   detail: 'public'
					   }
				   ], {
					   placeHolder: 'Choose gist visibility',
					   ignoreFocusOut: true
				   });

				   if (!visibility) {
					   return; // User cancelled
				   }

				   const isPublic = visibility.detail === 'public';

				   // Build description with the new subfolder path
				   const description = createGistDescription(newFolderPath, gistName.trim());

				   // Create the gist
				   await vscode.window.withProgress({
					   location: vscode.ProgressLocation.Notification,
					   title: `Creating gist in ${newFolderPathStr}...`,
					   cancellable: false
				   }, async () => {
					   // Create with a placeholder file containing folder info
					   const placeholderContent = `Folder: ${newFolderPathStr}\nCreated: ${new Date().toISOString()}\n\nThis is a subfolder for organizing gists.`;
					   const newGist = await githubService.createGist(
						   description,
						   { 'README.md': { content: placeholderContent } },
						   isPublic
					   );

					   myGistsProvider.refresh();
					   starredGistsProvider.refresh();

					   vscode.window.showInformationMessage(
						   `Gist created in folder "${newFolderPathStr}"`
					   );
				   });
			   } catch (error) {
				   console.error('Error creating subfolder:', error);
				   vscode.window.showErrorMessage(`Failed to create subfolder: ${error}`);
			   }
		   }
	   );

	   const addGistCommentCommand = vscode.commands.registerCommand(
		   'gist-editor.addGistComment',
		   async (gistItem: GistItem) => {
			   if (!gistItem || !gistItem.gist) {
				   vscode.window.showErrorMessage('No gist selected');
				   return;
			   }

			   try {
				   // Ask for comment body
				   const commentBody = await vscode.window.showInputBox({
					   prompt: 'Enter your comment',
					   placeHolder: 'Write your comment here...',
					   ignoreFocusOut: true,
					   validateInput: (value) => {
						   if (!value.trim()) {
							   return 'Comment cannot be empty';
						   }
						   return '';
					   }
				   });

				   if (!commentBody) {
					   return; // User cancelled
				   }

				   // Create the comment
				   await vscode.window.withProgress({
					   location: vscode.ProgressLocation.Notification,
					   title: 'Adding comment...',
					   cancellable: false
				   }, async () => {
					   await githubService.createGistComment(gistItem.gist!.id, commentBody.trim());
					   myGistsProvider.refresh();
					   starredGistsProvider.refresh();
					   commentProvider.refresh();
					   vscode.window.showInformationMessage('Comment added successfully!');
				   });
			   } catch (error) {
				   console.error('Error adding comment:', error);
				   vscode.window.showErrorMessage(`Failed to add comment: ${error}`);
			   }
		   }
	   );

	   const deleteGistCommentCommand = vscode.commands.registerCommand(
		   'gist-editor.deleteGistComment',
		   async (gistItem: GistItem) => {
			   if (!gistItem || !gistItem.isComment || !gistItem.comment || !gistItem.parentGistId) {
				   vscode.window.showErrorMessage('No comment selected');
				   return;
			   }

			   try {
				   // Confirm deletion
				   const confirmed = await vscode.window.showWarningMessage(
					   'Are you sure you want to delete this comment?',
					   { modal: true },
					   'Delete'
				   );

				   if (confirmed !== 'Delete') {
					   return; // User cancelled
				   }

				   // Delete the comment
				   await vscode.window.withProgress({
					   location: vscode.ProgressLocation.Notification,
					   title: 'Deleting comment...',
					   cancellable: false
				   }, async () => {
					   await githubService.deleteGistComment(gistItem.parentGistId!, gistItem.comment!.id);
					   myGistsProvider.refresh();
					   starredGistsProvider.refresh();
					   commentProvider.refresh();
					   vscode.window.showInformationMessage('Comment deleted successfully!');
				   });
			   } catch (error) {
				   console.error('Error deleting comment:', error);
				   vscode.window.showErrorMessage(`Failed to delete comment: ${error}`);
			   }
		   }
	   );

	   const viewGistCommentOnGitHubCommand = vscode.commands.registerCommand(
		   'gist-editor.viewGistCommentOnGitHub',
		   async (gistItem: GistItem) => {
			   if (!gistItem || !gistItem.isComment || !gistItem.comment) {
				   vscode.window.showErrorMessage('No comment selected');
				   return;
			   }

			   try {
				   const url = gistItem.comment.html_url;
				   if (!url) {
					   vscode.window.showErrorMessage('No GitHub URL found for this comment');
					   return;
				   }
				   vscode.env.openExternal(vscode.Uri.parse(url));
			   } catch (error) {
				   console.error('Error opening comment in GitHub:', error);
				   vscode.window.showErrorMessage(`Failed to open comment: ${error}`);
			   }
		   }
	   );

	   // Move gist to folder command
	   const moveGistToFolderCommand = vscode.commands.registerCommand(
		   'gist-editor.moveGistToFolder',
		   async (gistItem: GistItem) => {
			   if (!gistItem || !gistItem.gist) {
				   vscode.window.showErrorMessage('No gist selected');
				   return;
			   }

			   try {
				   // Get all gists to build the folder tree
				   const allGists = await githubService.getMyGists();
				   const folderResult = new GistFolderBuilder().buildFolderTree(
					   allGists.filter(g => g.public === gistItem.gist!.public)
				   );

				   // Create quick pick items for folders
				   interface FolderQuickPickItem extends vscode.QuickPickItem {
					   folderPath: string[];
				   }

				   const folderItems: FolderQuickPickItem[] = [
					   {
						   label: '$(home) Root (No Folder)',
						   description: 'Move to root level',
						   folderPath: []
					   }
				   ];

				   // Add existing folders
				   const allFolders = folderResult.folders;
				   const addFoldersToList = (folders: GistFolder[], depth: number) => {
					   for (const folder of folders) {
						   const indent = '  '.repeat(depth);
						   folderItems.push({
							   label: `${indent}📁 ${folder.displayName}`,
							   description: `${folder.gists.length} gist${folder.gists.length !== 1 ? 's' : ''}`,
							   folderPath: folder.path
						   });
						   addFoldersToList(folder.subFolders, depth + 1);
					   }
				   };

				   addFoldersToList(allFolders, 0);

				   // Ask user to select target folder
				   const selectedFolder = await vscode.window.showQuickPick(folderItems, {
					   placeHolder: 'Select target folder for this gist',
					   matchOnDescription: true,
					   matchOnDetail: true
				   });

				   if (!selectedFolder) {
					   return; // User cancelled
				   }

				   // Get current gist description
				   const parsed = parseGistDescription(gistItem.gist.description || '');

				   // Create new description with target folder path
				   const newDescription = createGistDescription(selectedFolder.folderPath, parsed.displayName);

				   // Update the gist with new folder path
				   await vscode.window.withProgress({
					   location: vscode.ProgressLocation.Notification,
					   title: 'Moving gist...',
					   cancellable: false
				   }, async () => {
					   await githubService.updateGist(gistItem.gist!.id, newDescription);
					   myGistsProvider.refresh();
					   starredGistsProvider.refresh();

					   const targetPath = selectedFolder.folderPath.length > 0
						   ? selectedFolder.folderPath.join(' > ')
						   : 'root';
					   vscode.window.showInformationMessage(
						   `✓ Moved "${parsed.displayName}" to ${targetPath}`
					   );
				   });
			   } catch (error) {
				   console.error('Error moving gist:', error);
				   vscode.window.showErrorMessage(`Failed to move gist: ${error}`);
			   }
		   }
	   );

	   // Add all commands to subscriptions
		  context.subscriptions.push(
			  helloWorldCommand,
			  refreshCommand,
			  createGistCommand,
			  createGistFromFileCommand,
			  createGistFromSelectionCommand,
			  openGistCommand,
			  openGistFileCommand,
			  setupTokenCommand,
			  testApiCommand,
			  checkScopesCommand,
			  saveGistCommand,
			  deleteGistCommand,
			  renameGistCommand,
			  toggleStarGistCommand,
			  addFileToGistCommand,
			  deleteFileFromGistCommand,
			  renameFileInGistCommand,
			  viewGistHistoryCommand,
			  openInGitHubCommand,
			  createSubfolderInFolderCommand,
			  moveGistToFolderCommand,
			  addGistCommentCommand,
			  deleteGistCommentCommand,
			  viewGistCommentOnGitHubCommand
		  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
