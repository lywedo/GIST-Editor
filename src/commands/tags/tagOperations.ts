import * as vscode from 'vscode';
import { GitHubService, Gist } from '../../githubService';
import { TagsManager } from '../../tagsManager';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';

/**
 * Registers all tag-related commands for managing gist tags
 * @param context VS Code extension context
 * @param tagsManager Tags manager instance
 * @param githubService GitHub service instance
 * @param myGistsProvider Provider for user's gists
 * @param starredGistsProvider Provider for starred gists
 */
export function registerTagCommands(
	context: vscode.ExtensionContext,
	tagsManager: TagsManager,
	githubService: GitHubService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider
): void {
	// Add tag command
	const addTagCommand = vscode.commands.registerCommand('gist-editor.addTag', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('Please select a gist to add a tag');
			return;
		}

		const tag = await vscode.window.showInputBox({
			prompt: 'Enter a tag (e.g., react, python, utility)',
			placeHolder: 'tag-name',
			validateInput: (input: string) => {
				if (!tagsManager.isValidTag(input)) {
					return 'Tag must contain only alphanumeric characters, hyphens, and underscores';
				}
				return null;
			}
		});

		if (!tag) {
			return;
		}

		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Adding tag "${tag}"...`
			}, async () => {
				await tagsManager.addTag(gistItem.gist!, tag);
			});
			vscode.window.showInformationMessage(`Tag "${tag}" added to gist. Format: [tag:${tag.toLowerCase()}]`);
			myGistsProvider.refresh();
			starredGistsProvider.refresh();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error adding tag: ${error.message}`);
		}
	});

	// Remove tag command
	const removeTagCommand = vscode.commands.registerCommand('gist-editor.removeTag', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('Please select a gist');
			return;
		}

		try {
			const tags = await tagsManager.getTags(gistItem.gist);

			if (tags.length === 0) {
				vscode.window.showInformationMessage('This gist has no tags');
				return;
			}

			const selected = await vscode.window.showQuickPick(tags, {
				placeHolder: 'Select a tag to remove',
				title: 'Remove Tag'
			});

			if (!selected) {
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Removing tag "${selected}"...`
			}, async () => {
				await tagsManager.removeTag(gistItem.gist!, selected);
			});
			vscode.window.showInformationMessage(`Tag "${selected}" removed from gist`);
			myGistsProvider.refresh();
			starredGistsProvider.refresh();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error removing tag: ${error.message}`);
		}
	});

	// Filter by tag command
	const filterByTagCommand = vscode.commands.registerCommand('gist-editor.filterByTag', async () => {
		if (!githubService.isAuthenticated()) {
			try {
				await githubService.getOAuthToken();
			} catch (error) {
				const setup = await vscode.window.showErrorMessage(
					'You need to sign in with GitHub to filter by tag.',
					'Sign in with GitHub'
				);
				if (setup === 'Sign in with GitHub') {
					vscode.commands.executeCommand('gist-editor.setupToken');
				}
				return;
			}
		}

		try {
			// Fetch all gists
			const myGists = await githubService.getMyGists();
			const starredGists = await githubService.getStarredGists();
			const allGists = [...myGists, ...starredGists];

			// Get all unique tags
			const allTags = await tagsManager.getAllUniqueTags(allGists);

			if (allTags.length === 0) {
				vscode.window.showInformationMessage('No tags found. Add tags to your gists first. Format: [tag:tagname]');
				return;
			}

			const selectedTag = await vscode.window.showQuickPick(allTags, {
				placeHolder: 'Select a tag to filter by',
				title: 'Filter Gists by Tag'
			});

			if (!selectedTag) {
				return;
			}

			// Get gists with selected tag
			const taggedGists = await tagsManager.getGistsWithTag(allGists, selectedTag);

			if (taggedGists.length === 0) {
				vscode.window.showInformationMessage(`No gists found with tag "[tag:${selectedTag}]"`);
				return;
			}

			// Create a quick pick showing gists with this tag
			const quickPick = vscode.window.createQuickPick<{
				label: string;
				gist: Gist;
			}>();

			quickPick.title = `Gists with tag "[tag:${selectedTag}]" (${taggedGists.length})`;
			quickPick.canSelectMany = false;

			// Build items with formatted tags
			const items = await Promise.all(taggedGists.map(async (gist) => ({
				label: `${tagsManager.getCleanDescription(gist) || '(No description)'} ${gist.public ? '🌐' : '🔒'}`,
				description: await tagsManager.formatTagsForDisplay(gist),
				gist
			})));

			quickPick.items = items;

			quickPick.onDidChangeSelection(async (selection) => {
				if (selection.length > 0) {
					const item = selection[0];
					await vscode.commands.executeCommand('gist-editor.openGist', item.gist);
					quickPick.hide();
				}
			});

			quickPick.onDidHide(() => quickPick.dispose());
			quickPick.show();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error filtering by tag: ${error.message}`);
		}
	});

	// Clear tags command
	const clearTagsCommand = vscode.commands.registerCommand('gist-editor.clearTags', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('Please select a gist');
			return;
		}

		try {
			const tags = await tagsManager.getTags(gistItem.gist);

			if (tags.length === 0) {
				vscode.window.showInformationMessage('This gist has no tags');
				return;
			}

			const confirmed = await vscode.window.showWarningMessage(
				`Clear ${tags.length} tag(s) from this gist?`,
				{ modal: true },
				'Clear All'
			);

			if (confirmed !== 'Clear All') {
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Clearing all tags...'
			}, async () => {
				await tagsManager.clearTags(gistItem.gist!);
			});
			vscode.window.showInformationMessage('All tags cleared from gist');
			myGistsProvider.refresh();
			starredGistsProvider.refresh();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error clearing tags: ${error.message}`);
		}
	});

	// Register all commands in context subscriptions
	context.subscriptions.push(
		addTagCommand,
		removeTagCommand,
		filterByTagCommand,
		clearTagsCommand
	);
}
