import * as vscode from 'vscode';
import { Gist, GitHubService } from '../../githubService';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { parseGistDescription, createGistDescription } from '../../gistDescriptionParser';
import { getLanguageFromExtension } from '../../utils/languageDetection';
import {
	openGistFile,
	createFromCurrentFile,
	createFromSelection,
	createEmptyGist,
	createMultiFileGist,
	getFolderPathAndName,
	createGistFromFiles
} from '../helpers/gistHelpers';

/**
 * Registers all gist operation commands
 */
export function registerGistCommands(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider
): void {
	// Create gist command
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

	// Create gist from current file command
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

			await createGistFromFiles(files, `Gist from ${Object.keys(files)[0]}`, githubService, myGistsProvider);
		} catch (error) {
			console.error('Error creating gist from file:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	// Create gist from selection command
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

			await createGistFromFiles(files, 'Code snippet', githubService, myGistsProvider);
		} catch (error) {
			console.error('Error creating gist from selection:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	// Open gist command
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

	// Open gist file command
	const openGistFileCommand = vscode.commands.registerCommand('gist-editor.openGistFile', async (gist: Gist, file: any) => {
		await openGistFile(gist, file);
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

	// View gist history command
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

	// Open in GitHub command
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

	// Register all commands
	context.subscriptions.push(
		createGistCommand,
		createGistFromFileCommand,
		createGistFromSelectionCommand,
		openGistCommand,
		openGistFileCommand,
		saveGistCommand,
		deleteGistCommand,
		renameGistCommand,
		toggleStarGistCommand,
		viewGistHistoryCommand,
		openInGitHubCommand
	);
}
