// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitHubService } from './githubService';
import { TagsManager } from './tagsManager';
import { GistProvider } from './providers/gistProvider';
import { GistItem } from './providers/gistItem';
import { GistFileSystemProvider } from './providers/gistFileSystem';
import { CommentProvider } from './providers/commentProvider';
import {
	registerBasicCommands,
	registerAuthCommands,
	registerGistCommands,
	registerFileCommands,
	registerFolderCommands,
	registerCommentCommands,
	registerTagCommands,
	registerSearchCommands,
	SearchCache
} from './commands';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gist-editor" is now active!');

	// Create GitHub service
	const githubService = new GitHubService();

	// Proactively restore OAuth session if available (shared across all VS Code instances)
	// This prevents each instance from prompting for authentication independently
	// We await this to ensure the session is properly loaded before the extension is fully active
	githubService.restoreSession().then(() => {
		console.log('OAuth session restoration completed');
		// Refresh providers if we have authentication
		if (githubService.isAuthenticated()) {
			console.log('Authentication detected, refreshing gist providers');
			myGistsProvider.refresh();
			starredGistsProvider.refresh();
		}
	}).catch(err => {
		console.log('No existing OAuth session to restore:', err);
	});

	// Create tags manager (uses protocol embedded in gist descriptions)
	const tagsManager = new TagsManager(githubService);

	// Search cache
	let searchCache: SearchCache | null = null;

	// Helper to clear search cache
	const clearSearchCache = () => {
		searchCache = null;
	};

	// Create output channel for API usage statistics
	const apiUsageOutputChannel = vscode.window.createOutputChannel('Gist Editor - API Usage');
	context.subscriptions.push(apiUsageOutputChannel);

	// Create gist file system provider
	const gistFileSystemProvider = new GistFileSystemProvider(githubService);
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider('gist', gistFileSystemProvider, {
			isCaseSensitive: true,
			isReadonly: false
		})
	);

	// Create tree data providers
	const myGistsProvider = new GistProvider('my', githubService, tagsManager);
	const starredGistsProvider = new GistProvider('starred', githubService, tagsManager);
	const commentProvider = new CommentProvider(githubService);

	// Register tree data providers
	vscode.window.registerTreeDataProvider('gist-editor.gistList', myGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.starred', starredGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.comments', commentProvider);

	// Clear search cache when tags change
	tagsManager.onTagsChanged(() => {
		clearSearchCache();
	});

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

	// Register all commands
	registerBasicCommands(context, myGistsProvider, starredGistsProvider, clearSearchCache);
	registerAuthCommands(context, githubService, myGistsProvider, starredGistsProvider, commentProvider, apiUsageOutputChannel);
	registerGistCommands(context, githubService, myGistsProvider, starredGistsProvider);
	registerFileCommands(context, githubService, myGistsProvider, starredGistsProvider, gistFileSystemProvider);
	registerFolderCommands(context, githubService, myGistsProvider, starredGistsProvider);
	registerCommentCommands(context, githubService, commentProvider, myGistsProvider, starredGistsProvider);
	registerTagCommands(context, tagsManager, githubService, myGistsProvider, starredGistsProvider);
	registerSearchCommands(
		context,
		githubService,
		tagsManager,
		myGistsProvider,
		starredGistsProvider,
		gistSelectionTracker,
		starredSelectionTracker,
		() => searchCache,
		(cache) => { searchCache = cache; }
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
