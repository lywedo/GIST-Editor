import * as vscode from 'vscode';
import { GitHubService, Gist, GistComment } from '../githubService';
import { GistItem } from './gistItem';

/**
 * Tree data provider for displaying gist comments
 */
export class CommentProvider implements vscode.TreeDataProvider<GistItem> {
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
