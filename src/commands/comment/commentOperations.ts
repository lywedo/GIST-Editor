import * as vscode from 'vscode';
import { GitHubService } from '../../githubService';
import { CommentProvider } from '../../providers/commentProvider';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';

/**
 * Register all comment-related commands
 */
export function registerCommentCommands(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	commentProvider: CommentProvider,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider
): void {
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

	// Push all commands to context.subscriptions
	context.subscriptions.push(
		addGistCommentCommand,
		deleteGistCommentCommand,
		viewGistCommentOnGitHubCommand
	);
}
