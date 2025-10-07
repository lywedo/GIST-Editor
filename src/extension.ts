// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Gist item for the tree view
class GistItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly description: string,
		public readonly gistId: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.tooltip = description;
		this.contextValue = 'gist';
		this.iconPath = new vscode.ThemeIcon('gist');
	}
}

// Tree data provider for gists
class GistProvider implements vscode.TreeDataProvider<GistItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<GistItem | undefined | null | void> = new vscode.EventEmitter<GistItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<GistItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private gistType: 'my' | 'starred') {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GistItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: GistItem): Thenable<GistItem[]> {
		if (!element) {
			// Return mock data for now - replace with actual GitHub API calls later
			if (this.gistType === 'my') {
				return Promise.resolve([
					new GistItem('Sample Gist 1', 'A sample JavaScript gist', 'gist1', vscode.TreeItemCollapsibleState.None),
					new GistItem('Sample Gist 2', 'A sample Python gist', 'gist2', vscode.TreeItemCollapsibleState.None)
				]);
			} else {
				return Promise.resolve([
					new GistItem('Starred Gist 1', 'An awesome utility script', 'starred1', vscode.TreeItemCollapsibleState.None)
				]);
			}
		}
		return Promise.resolve([]);
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gist-editor" is now active!');

	// Create tree data providers
	const myGistsProvider = new GistProvider('my');
	const starredGistsProvider = new GistProvider('starred');

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

	const openGistCommand = vscode.commands.registerCommand('gist-editor.openGist', () => {
		vscode.window.showInformationMessage('Open gist functionality coming soon!');
	});

	// Add all commands to subscriptions
	context.subscriptions.push(
		helloWorldCommand,
		refreshCommand,
		createGistCommand,
		openGistCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
