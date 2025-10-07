// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitHubService, Gist } from './githubService';

// Gist item for the tree view
class GistItem extends vscode.TreeItem {
	constructor(
		public readonly gist: Gist,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(gist.description || '(No description)', collapsibleState);
		
		this.tooltip = `${gist.description}\nCreated: ${new Date(gist.created_at).toLocaleDateString()}\nFiles: ${Object.keys(gist.files).length}`;
		this.contextValue = 'gist';
		this.iconPath = gist.public ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');
		this.command = {
			command: 'gist-editor.openGist',
			title: 'Open Gist',
			arguments: [gist]
		};
		
		// Show file count and visibility
		const fileCount = Object.keys(gist.files).length;
		const visibility = gist.public ? 'Public' : 'Private';
		this.description = `${fileCount} file${fileCount !== 1 ? 's' : ''} • ${visibility}`;
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
				return gists.map(gist => new GistItem(gist, vscode.TreeItemCollapsibleState.None));
			} catch (error) {
				console.error(`Error loading ${this.gistType} gists:`, error);
				vscode.window.showErrorMessage(`Failed to load ${this.gistType} gists: ${error}`);
				return [this.createErrorItem(error instanceof Error ? error.message : 'Unknown error')];
			}
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
		const item = new GistItem(mockGist, vscode.TreeItemCollapsibleState.None);
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
		const item = new GistItem(mockGist, vscode.TreeItemCollapsibleState.None);
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

	const openGistCommand = vscode.commands.registerCommand('gist-editor.openGist', (gist?: Gist) => {
		if (gist) {
			vscode.env.openExternal(vscode.Uri.parse(gist.html_url));
		} else {
			vscode.window.showInformationMessage('No gist selected');
		}
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

	// Add all commands to subscriptions
	context.subscriptions.push(
		helloWorldCommand,
		refreshCommand,
		createGistCommand,
		openGistCommand,
		setupTokenCommand,
		testApiCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
