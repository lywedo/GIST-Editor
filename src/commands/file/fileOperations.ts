import * as vscode from 'vscode';
import { GitHubService } from '../../githubService';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { GistFileSystemProvider } from '../../providers/gistFileSystem';

export function registerFileCommands(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider,
	gistFileSystemProvider: GistFileSystemProvider
) {
	// Add file to gist command
	const addFileToGistCommand = vscode.commands.registerCommand('gist-editor.addFileToGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('No gist selected');
			return;
		}

		const gist = gistItem.gist;

		const filename = await vscode.window.showInputBox({
			prompt: 'Enter filename (with extension)',
			placeHolder: 'example.txt',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Filename cannot be empty';
				}
				if (gist.files[value]) {
					return 'A file with this name already exists in the gist';
				}
				return null;
			}
		});

		if (!filename) {
			return; // User cancelled
		}

		const content = await vscode.window.showInputBox({
			prompt: 'Enter initial content for the file (optional - press Enter to use default)',
			placeHolder: 'Press Enter to skip and use "Hello World" as default content',
			value: ''
		});

		if (content === undefined) {
			return; // User cancelled
		}

		// If user skipped (empty string), use "Hello World" as default
		const finalContent = content.trim() === '' ? 'Hello World' : content;

		try {
			await githubService.updateGist(gist.id, undefined, {
				[filename]: { content: finalContent }
			});

			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Added file "${filename}" to gist`);

			// Open the new file
			const uri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(filename)}`);
			await vscode.window.showTextDocument(uri);
		} catch (error) {
			console.error('Error adding file to gist:', error);
			vscode.window.showErrorMessage(`Failed to add file: ${error}`);
		}
	});

	// Delete file from gist command
	const deleteFileFromGistCommand = vscode.commands.registerCommand('gist-editor.deleteFileFromGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No file selected');
			return;
		}

		const gist = gistItem.gist;
		const file = gistItem.file;

		const confirmation = await vscode.window.showWarningMessage(
			`Are you sure you want to delete "${file.filename}" from this gist?`,
			{ modal: true },
			'Delete'
		);

		if (confirmation !== 'Delete') {
			return;
		}

		try {
			// To delete a file, we need to update the gist with all files except the one to delete
			// First, get the current gist to have all files
			const currentGist = await githubService.getGist(gist.id);

			// Create update with all files except the one to delete
			const filesUpdate: any = {};
			for (const [filename, fileObj] of Object.entries(currentGist.files)) {
				if (filename !== file.filename) {
					filesUpdate[filename] = { content: fileObj.content || '' };
				}
			}

			// If gist has only one file, we can't delete it - GitHub doesn't allow empty gists
			if (Object.keys(filesUpdate).length === 0) {
				vscode.window.showErrorMessage('Cannot delete the last file in a gist. GitHub Gists must contain at least one file.');
				return;
			}

			await githubService.updateGist(gist.id, undefined, filesUpdate);

			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Deleted file "${file.filename}"`);
		} catch (error) {
			console.error('Error deleting file:', error);
			vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
		}
	});

	// Rename file in gist command
	const renameFileInGistCommand = vscode.commands.registerCommand('gist-editor.renameFileInGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No file selected');
			return;
		}

		const gist = gistItem.gist;
		const file = gistItem.file;
		const oldFilename = file.filename;

		const newFilename = await vscode.window.showInputBox({
			prompt: 'Enter new filename',
			value: oldFilename,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Filename cannot be empty';
				}
				if (value !== oldFilename && gist.files[value]) {
					return 'A file with this name already exists in the gist';
				}
				return null;
			}
		});

		if (!newFilename || newFilename.trim() === '' || newFilename === oldFilename) {
			return; // User cancelled or didn't change the name
		}

		try {
			// Use the old filename as the key, with "filename" property for the new name
			const filesUpdate: any = {
				[oldFilename]: {
					filename: newFilename,  // New name goes in the filename property
					content: file.content || ' '
				}
			};
			await githubService.updateGist(gist.id, undefined, filesUpdate);

			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			vscode.window.showInformationMessage(`✓ Renamed "${oldFilename}" to "${newFilename}"`);

			// Close old document if open
			const oldUri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(oldFilename)}`);
			const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === oldUri.toString());
			if (openDoc) {
				await vscode.window.showTextDocument(openDoc);
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			}

			// Open renamed file
			const newUri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(newFilename)}`);
			await vscode.window.showTextDocument(newUri);
		} catch (error) {
			console.error('Error renaming file:', error);
			vscode.window.showErrorMessage(`Failed to rename file: ${error}`);
		}
	});

	// Push all commands to subscriptions
	context.subscriptions.push(addFileToGistCommand);
	context.subscriptions.push(deleteFileFromGistCommand);
	context.subscriptions.push(renameFileInGistCommand);
}
