import * as vscode from 'vscode';
import { GistProvider } from '../../providers/gistProvider';

/**
 * Registers basic utility commands
 */
export function registerBasicCommands(
	context: vscode.ExtensionContext,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider,
	clearSearchCache: () => void
): void {
	// Hello World test command
	const helloWorldCommand = vscode.commands.registerCommand('gist-editor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Gist Editor!');
	});

	// Refresh all gist views
	const refreshCommand = vscode.commands.registerCommand('gist-editor.refresh', () => {
		clearSearchCache();
		myGistsProvider.refresh();
		starredGistsProvider.refresh();
		vscode.window.showInformationMessage('Gists refreshed!');
	});

	context.subscriptions.push(helloWorldCommand, refreshCommand);
}
