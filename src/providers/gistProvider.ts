import * as vscode from 'vscode';
import { GitHubService, Gist, GistComment } from '../githubService';
import { GistFolderBuilder, GistFolder } from '../gistFolderBuilder';
import { parseGistDescription, createGistDescription } from '../gistDescriptionParser';
import { TagsManager } from '../tagsManager';
import { GistItem } from './gistItem';

/**
 * Tree data provider for gists (my gists or starred gists)
 */
export class GistProvider implements vscode.TreeDataProvider<GistItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<GistItem | undefined | null | void> = new vscode.EventEmitter<GistItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<GistItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private folderBuilder = new GistFolderBuilder();
	private folderTreeCache: Map<'public' | 'private', GistFolder[]> = new Map();
	private ungroupedGistsCache: Map<'public' | 'private', Gist[]> = new Map();
	private commentsCache: Map<string, GistComment[]> = new Map();
	private tagsCache: Map<string, string[]> = new Map(); // gistId -> tags
	private gistToFolderMap: Map<string, GistFolder> = new Map();

	// Drag and drop support
	dropMimeTypes = ['application/vnd.code.tree-gistItem'];
	dragMimeTypes = ['application/vnd.code.tree-gistItem'];

	constructor(private gistType: 'my' | 'starred', private githubService: GitHubService, private tagsManager?: any) {}

	refresh(): void {
		this.folderTreeCache.clear();
		this.ungroupedGistsCache.clear();
		this.commentsCache.clear();
		this.tagsCache.clear();
		this.gistToFolderMap.clear();
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Get a copy of the tags cache for external use
	 */
	getTagsCache(): Map<string, string[]> {
		return new Map(this.tagsCache);
	}

	private async getTagsForGist(gistId: string): Promise<string[]> {
		if (!this.tagsManager) {
			return [];
		}

		// Check cache first
		if (this.tagsCache.has(gistId)) {
			return this.tagsCache.get(gistId)!;
		}

		// Fetch from API
		try {
			// Get the full gist object - we need it for tagsManager.getTags
			let gists: Gist[] = [];
			if (this.gistType === 'my') {
				gists = await this.githubService.getMyGists();
			} else {
				gists = await this.githubService.getStarredGists();
			}

			const gist = gists.find(g => g.id === gistId);
			if (!gist) {
				return [];
			}

			const tags = await this.tagsManager.getTags(gist);
			this.tagsCache.set(gistId, tags);
			return tags;
		} catch (error) {
			console.error(`[TagsManager] Error fetching tags for gist ${gistId}:`, error);
			return [];
		}
	}

	getTreeItem(element: GistItem): vscode.TreeItem {
		return element;
	}

	async getParent(element: GistItem): Promise<GistItem | undefined> {
		// For files, the parent is the gist
		if (element.file && element.gist) {
			return new GistItem(element.gist, undefined, vscode.TreeItemCollapsibleState.Collapsed);
		}

		// For gists, the parent is a folder or a group
		if (element.gist && !element.file) {
			const parsed = parseGistDescription(element.gist.description || '');

			if (parsed.folderPath.length > 0) {
				// Parent is a folder
				const parentFolder = this.folderBuilder.getFolderByGist(this.folderTreeCache.get(element.gist.public ? 'public' : 'private') || [], element.gist.id);
				if (parentFolder) {
					return new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, parentFolder);
				}
			}

			// Parent is a group (public/private)
			const groupType = element.gist.public ? 'public' : 'private';
			return new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, groupType);
		}

		// For folders, the parent is another folder or a group
		if (element.isFolder && element.folder) {
			if (element.folder.parentPath && element.folder.parentPath.length > 0) {
				// Parent is another folder
				const parentFolder = this.folderBuilder.getFolderByPath(this.folderTreeCache.get(element.folder.gists[0]?.public ? 'public' : 'private') || [], element.folder.parentPath);
				if (parentFolder) {
					return new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, parentFolder);
				}
			}

			// Parent is a group
			const groupType = (element.folder.gists[0] ?? this.folderBuilder.getAllGistsInFolder(element.folder)[0])?.public ? 'public' : 'private';
			if (groupType) {
				return new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, groupType);
			}
		}

		// Groups and other items at the root have no parent
		return undefined;
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
					result.gistToFolderMap.forEach((value, key) => this.gistToFolderMap.set(key, value));
				}

				const folders = this.folderTreeCache.get(visibility) || [];
				const ungroupedGists = this.ungroupedGistsCache.get(visibility) || [];

				// Create folder items
				const folderItems = folders.map(folder =>
					new GistItem(null, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, folder)
				);

				// Fetch tags for ungrouped gists
				const ungroupedItemsWithTags = await Promise.all(
					ungroupedGists.map(async (gist) => {
						const tags = await this.getTagsForGist(gist.id);
						return new GistItem(gist, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, undefined, undefined, tags);
					})
				);

				return [...folderItems, ...ungroupedItemsWithTags];
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

			// Fetch tags for gists in this folder
			const gistItemsWithTags = await Promise.all(
				folder.gists.map(async (gist) => {
					const tags = await this.getTagsForGist(gist.id);
					return new GistItem(gist, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, undefined, undefined, tags);
				})
			);

			console.log(`[Folder Expand] Returning ${folderItems.length} folders + ${gistItemsWithTags.length} gists`);
			return [...folderItems, ...gistItemsWithTags];
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
			// Filter out system comments (tags comment)
			const userComments = comments.filter(c => !c.body.includes('[GIST_TAGS]'));
			this.commentsCache.set(gistId, userComments);
			return userComments;
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

		// Allow dragging gists, folders, and files
		const draggableItems = source.filter(item => item.gist || item.isFolder || item.file);

		if (draggableItems.length === 0) {
			return;
		}

		// Serialize the dragged items
		const draggedData = draggableItems.map(item => ({
			gistId: item.gist?.id,
			isFolder: item.isFolder,
			folderPath: item.folder?.path,
			isFile: !!item.file,
			filename: item.file?.filename,
			fileContent: item.file?.content,
			sourceGistId: item.gist?.id  // For files, this is the source gist
		}));

		// Set the data transfer content
		dataTransfer.set('application/vnd.code.tree-gistItem', new vscode.DataTransferItem(JSON.stringify(draggedData)));
		console.log(`[Drag] Serialized drag data: ${JSON.stringify(draggedData)}`);
	}

	// Handle drop operations - move gists/files
	async handleDrop(target: GistItem, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		console.log(`[Drop] Dropping on target, isFolder: ${target.isFolder}, isGist: ${!!target.gist}`);

		const draggedItems = dataTransfer.get('application/vnd.code.tree-gistItem');
		if (!draggedItems) {
			console.log('[Drop] No dragged items in data transfer');
			return;
		}

		try {
			const draggedItemsText = draggedItems.value;
			console.log(`[Drop] Raw drag data: ${draggedItemsText}`);
			const draggedData = JSON.parse(draggedItemsText);

			// Only 'my' gists provider can handle drops (for moving gists/files)
			if (this.gistType !== 'my') {
				vscode.window.showWarningMessage('You can only move gists in "My Gists" view');
				return;
			}

			// Check if we're dropping files onto a gist
			const files = draggedData.filter((item: any) => item.isFile);
			const gists = draggedData.filter((item: any) => !item.isFile && item.gistId);

			if (files.length > 0) {
				// Dropping files onto a target gist
				if (!target.gist) {
					vscode.window.showWarningMessage('Can only move files to gists');
					return;
				}

				console.log(`[Drop] Moving ${files.length} files to gist ${target.gist.id}`);

				// Get target gist to check for duplicate filenames
				const targetGist = await this.githubService.getGist(target.gist.id);
				const targetFilenames = Object.keys(targetGist.files);

				// Move each file to the target gist
				for (const file of files) {
					const sourceGistId = file.sourceGistId;
					let filename = file.filename;
					let fileContent = file.fileContent;

					console.log(`[Drop] Moving file "${filename}" from gist ${sourceGistId} to ${target.gist.id}`);

					// If content is not available, fetch the gist to get it
					if (!fileContent) {
						const sourceGist = await this.githubService.getGist(sourceGistId);
						fileContent = sourceGist.files[filename]?.content || '';
					}

					// Check if target gist already has a file with this name
					let newFilename = filename;
					if (targetFilenames.includes(filename)) {
						// Rename the file by adding a suffix (e.g., "script.js" → "script_1.js")
						const nameParts = filename.lastIndexOf('.') > 0
							? [filename.substring(0, filename.lastIndexOf('.')), filename.substring(filename.lastIndexOf('.'))]
							: [filename, ''];

						let counter = 1;
						let candidateName = `${nameParts[0]}_${counter}${nameParts[1]}`;
						while (targetFilenames.includes(candidateName)) {
							counter++;
							candidateName = `${nameParts[0]}_${counter}${nameParts[1]}`;
						}
						newFilename = candidateName;
						console.log(`[Drop] File "${filename}" already exists in target gist. Renaming to "${newFilename}"`);
					}

					// Add file to target gist with new filename
					await this.githubService.updateGist(target.gist.id, undefined, {
						[newFilename]: { content: fileContent }
					});
					console.log(`[Drop] Added file "${newFilename}" to target gist`);

					// Delete file from source gist using null value (GitHub API way to delete)
					await this.githubService.updateGist(sourceGistId, undefined, {
						[filename]: null as any  // null deletes the file in GitHub API
					});
					console.log(`[Drop] Removed file "${filename}" from source gist`);
				}

				this.refresh();
				vscode.window.showInformationMessage(`✓ Moved ${files.length} file${files.length !== 1 ? 's' : ''} successfully`);
			} else if (gists.length > 0) {
				// Dropping gists/folders onto a folder
				if (!target.isFolder) {
					vscode.window.showWarningMessage('Can only move gists to folders');
					return;
				}

				// Extract target folder path
				const targetFolderPath = target.folder?.path || [];
				console.log(`[Drop] Target folder path: ${JSON.stringify(targetFolderPath)}`);

				// Move each dragged gist
				for (const draggedItem of gists) {
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

				this.refresh();
				vscode.window.showInformationMessage(`✓ Moved ${gists.length} gist${gists.length !== 1 ? 's' : ''} successfully`);
			}
		} catch (error) {
			console.error('Error handling drop:', error);
			vscode.window.showErrorMessage(`Failed to move: ${error}`);
		}
	}
}
