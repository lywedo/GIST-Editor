// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitHubService, Gist } from './githubService';

// Content provider for gist files
class GistContentProvider implements vscode.TextDocumentContentProvider {
	private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	public readonly onDidChange = this._onDidChange.event;

	private gistCache = new Map<string, Gist>();

	constructor(private githubService: GitHubService) {}

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const [gistId, filename] = uri.path.substring(1).split('/');
		
		try {
			// Try to get from cache first
			let gist = this.gistCache.get(gistId);
			if (!gist) {
				gist = await this.githubService.getGist(gistId);
				this.gistCache.set(gistId, gist);
			}

			const file = gist.files[filename];
			if (!file) {
				throw new Error(`File ${filename} not found in gist`);
			}

			return file.content || '';
		} catch (error) {
			console.error('Error loading gist content:', error);
			return `Error loading gist content: ${error}`;
		}
	}

	public invalidateCache(gistId: string) {
		this.gistCache.delete(gistId);
		// Trigger refresh for all gist URIs
		this._onDidChange.fire(vscode.Uri.parse(`gist:/${gistId}`));
	}
}

// Gist item for the tree view
class GistItem extends vscode.TreeItem {
	constructor(
		public readonly gist: Gist,
		public readonly file?: any,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
	) {
		// If this is a file item, show the filename
		if (file) {
			super(file.filename, vscode.TreeItemCollapsibleState.None);
			this.tooltip = `${file.filename}\nLanguage: ${file.language}\nSize: ${file.size} bytes`;
			this.contextValue = 'gistFile';
			this.iconPath = vscode.ThemeIcon.File;
			this.command = {
				command: 'gist-editor.openGistFile',
				title: 'Open File',
				arguments: [gist, file]
			};
			this.description = `${file.language} • ${file.size} bytes`;
		} else {
			// This is a gist container
			super(gist.description || '(No description)', collapsibleState);
			this.tooltip = `${gist.description}\nCreated: ${new Date(gist.created_at).toLocaleDateString()}\nFiles: ${Object.keys(gist.files).length}`;
			this.contextValue = 'gist';
			this.iconPath = gist.public ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');
			
			// Show file count and visibility
			const fileCount = Object.keys(gist.files).length;
			const visibility = gist.public ? 'Public' : 'Private';
			this.description = `${fileCount} file${fileCount !== 1 ? 's' : ''} • ${visibility}`;
		}
	}
}

// Tree data provider for gists
class GistProvider implements vscode.TreeDataProvider<GistItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<GistItem | undefined | null | void> = new vscode.EventEmitter<GistItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<GistItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private gistType: 'my' | 'starred', private githubService: GitHubService) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GistItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: GistItem): Promise<GistItem[]> {
		if (!element) {
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
				// Show gists as expandable if they have multiple files, otherwise collapsed
				return gists.map(gist => {
					const fileCount = Object.keys(gist.files).length;
					const collapsibleState = fileCount > 1 ? 
						vscode.TreeItemCollapsibleState.Collapsed : 
						vscode.TreeItemCollapsibleState.None;
					return new GistItem(gist, undefined, collapsibleState);
				});
			} catch (error) {
				console.error(`Error loading ${this.gistType} gists:`, error);
				vscode.window.showErrorMessage(`Failed to load ${this.gistType} gists: ${error}`);
				return [this.createErrorItem(error instanceof Error ? error.message : 'Unknown error')];
			}
		} else if (element.contextValue === 'gist') {
			// Show files for expanded gist
			const files = Object.values(element.gist.files);
			return files.map(file => new GistItem(element.gist, file));
		}
		return [];
	}

	private createNotAuthenticatedItem(): GistItem {
		const mockGist: Gist = {
			id: 'not-authenticated',
			description: 'Click to set up GitHub token',
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None);
		item.command = {
			command: 'gist-editor.setupToken',
			title: 'Setup GitHub Token'
		};
		item.iconPath = new vscode.ThemeIcon('key');
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
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None);
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

	// Create gist content provider
	const gistContentProvider = new GistContentProvider(githubService);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider('gist', gistContentProvider)
	);

	// Create tree data providers
	const myGistsProvider = new GistProvider('my', githubService);
	const starredGistsProvider = new GistProvider('starred', githubService);

	// Register tree data providers
	vscode.window.registerTreeDataProvider('gist-editor.gistList', myGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.starred', starredGistsProvider);

	// Register commands
	const helloWorldCommand = vscode.commands.registerCommand('gist-editor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Gist Editor!');
	});

	const refreshCommand = vscode.commands.registerCommand('gist-editor.refresh', () => {
		myGistsProvider.refresh();
		starredGistsProvider.refresh();
		vscode.window.showInformationMessage('Gists refreshed!');
	});

	const createGistCommand = vscode.commands.registerCommand('gist-editor.createGist', () => {
		vscode.window.showInformationMessage('Create new gist functionality coming soon!');
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
			const uri = vscode.Uri.parse(`gist:/${gist.id}/${file.filename}`);

			// Open the document
			const document = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(document);
			
			// Set the language mode based on file extension
			if (file.language && file.language !== 'Text') {
				await vscode.languages.setTextDocumentLanguage(document, getLanguageId(file.language));
			}

			vscode.window.showInformationMessage(`Opened ${file.filename} from gist "${gist.description || 'Untitled'}"`);
		} catch (error) {
			console.error('Error opening gist file:', error);
			vscode.window.showErrorMessage(`Failed to open file: ${error}`);
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
			'Text': 'plaintext'
		};
		return languageMap[githubLanguage] || 'plaintext';
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
				label: isAuthenticated ? '$(key) Change GitHub Token' : '$(key) Set GitHub Token',
				description: isAuthenticated ? 'Update your current GitHub token' : 'Configure GitHub token to access your gists'
			},
			{
				label: '$(info) How to create a token',
				description: 'Open GitHub token creation guide'
			},
			...(isAuthenticated ? [{
				label: '$(trash) Remove Token',
				description: 'Remove the current GitHub token'
			}] : [])
		], {
			placeHolder: `Token Status: ${tokenStatus}`,
			ignoreFocusOut: true
		});

		if (!action) {
			return;
		}

		if (action.label.includes('How to create')) {
			// Open GitHub token creation page
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens/new?description=VSCode%20Gist%20Editor&scopes=gist'));
			return;
		}

		if (action.label.includes('Remove Token')) {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to remove the GitHub token?',
				{ modal: true },
				'Remove',
				'Cancel'
			);
			
			if (confirm === 'Remove') {
				try {
					await githubService.removeToken();
					vscode.window.showInformationMessage('GitHub token removed successfully!');
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to remove token: ${error}`);
				}
			}
			return;
		}

		// Show input for token
		const token = await vscode.window.showInputBox({
			prompt: isAuthenticated ? 'Enter new GitHub Personal Access Token' : 'Enter your GitHub Personal Access Token',
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
					isAuthenticated ? 'GitHub token updated successfully!' : 'GitHub token configured successfully!',
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
			
			const gists = await githubService.getMyGists();
			vscode.window.showInformationMessage(`Found ${gists.length} gists!`);
			console.log('Gists:', gists);
		} catch (error) {
			console.error('API test error:', error);
			vscode.window.showErrorMessage(`API test failed: ${error}`);
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

		const [gistId, filename] = document.uri.path.substring(1).split('/');
		const content = document.getText();

		try {
			await githubService.updateGist(gistId, undefined, {
				[filename]: { content }
			});

			// Clear cache and refresh
			gistContentProvider.invalidateCache(gistId);
			myGistsProvider.refresh();
			
			vscode.window.showInformationMessage(`Saved ${filename} to gist successfully!`);
		} catch (error) {
			console.error('Error saving gist:', error);
			vscode.window.showErrorMessage(`Failed to save gist: ${error}`);
		}
	});

	// Listen for document saves to auto-save gists
	const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
		if (document.uri.scheme === 'gist') {
			// Auto-save gist when user presses Ctrl+S
			const [gistId, filename] = document.uri.path.substring(1).split('/');
			const content = document.getText();

			try {
				await githubService.updateGist(gistId, undefined, {
					[filename]: { content }
				});

				// Clear cache and refresh
				gistContentProvider.invalidateCache(gistId);
				myGistsProvider.refresh();
				
				vscode.window.setStatusBarMessage(`✓ Saved ${filename} to gist`, 3000);
			} catch (error) {
				console.error('Error auto-saving gist:', error);
				vscode.window.showErrorMessage(`Failed to save gist: ${error}`);
			}
		}
	});

	// Add all commands to subscriptions
	context.subscriptions.push(
		helloWorldCommand,
		refreshCommand,
		createGistCommand,
		openGistCommand,
		openGistFileCommand,
		setupTokenCommand,
		testApiCommand,
		saveGistCommand,
		saveListener
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
