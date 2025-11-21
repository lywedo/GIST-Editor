import * as vscode from 'vscode';
import { GistGitService } from '../../services/gistGitService';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { GistFileSystemProvider } from '../../providers/gistFileSystem';

export function registerImageCommands(
	context: vscode.ExtensionContext,
	gistGitService: GistGitService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider,
	gistFileSystemProvider: GistFileSystemProvider
) {
	// Add image to gist command
	const addImageToGistCommand = vscode.commands.registerCommand('gist-editor.addImageToGist', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.gist) {
			vscode.window.showErrorMessage('No gist selected');
			return;
		}

		const gist = gistItem.gist;

		// Get supported image formats from config
		const config = vscode.workspace.getConfiguration('gistEditor');
		const supportedFormats = config.get<string[]>('supportedImageFormats', [
			'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'
		]);

		// Create filter for file picker
		const filters: { [name: string]: string[] } = {
			'Images': supportedFormats.map(ext => ext.substring(1)) // Remove leading dot
		};

		// Show file picker
		const fileUris = await vscode.window.showOpenDialog({
			canSelectMany: false,
			canSelectFiles: true,
			canSelectFolders: false,
			filters: filters,
			openLabel: 'Select Image'
		});

		if (!fileUris || fileUris.length === 0) {
			return; // User cancelled
		}

		const imageUri = fileUris[0];
		const imagePath = imageUri.fsPath;

		// Ask for filename (default to original filename)
		const originalFilename = imageUri.fsPath.split(/[\\/]/).pop() || 'image.png';
		const filename = await vscode.window.showInputBox({
			prompt: 'Enter filename for the image',
			value: originalFilename,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Filename cannot be empty';
				}
				if (gist.files[value]) {
					return 'A file with this name already exists in the gist';
				}
				// Validate extension
				const ext = value.substring(value.lastIndexOf('.')).toLowerCase();
				if (!supportedFormats.includes(ext)) {
					return `Unsupported format. Use: ${supportedFormats.join(', ')}`;
				}
				return null;
			}
		});

		if (!filename) {
			return; // User cancelled
		}

		try {
			// Show progress
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Adding image "${filename}" to gist...`,
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0 });

				// Upload image using Git operations
				await gistGitService.addImageToGist(gist.id, imagePath, filename);

				progress.report({ increment: 100 });
			});

			// Invalidate cache and refresh
			gistFileSystemProvider.invalidateCache(gist.id);
			myGistsProvider.refresh();
			starredGistsProvider.refresh();

			// Ask if user wants to open the image
			const openImage = await vscode.window.showInformationMessage(
				`✓ Added image "${filename}" to gist`,
				'Open Image'
			);

			if (openImage === 'Open Image') {
				const uri = vscode.Uri.parse(`gist:/${gist.id}/${encodeURIComponent(filename)}`);
				await vscode.commands.executeCommand('vscode.open', uri);
			}
		} catch (error: any) {
			console.error('Error adding image to gist:', error);
			vscode.window.showErrorMessage(`Failed to add image: ${error.message}`);
		}
	});

	context.subscriptions.push(addImageToGistCommand);
}
