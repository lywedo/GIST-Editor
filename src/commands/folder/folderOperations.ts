import * as vscode from 'vscode';
import { GitHubService } from '../../githubService';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { parseGistDescription, createGistDescription } from '../../gistDescriptionParser';
import { GistFolderBuilder, GistFolder } from '../../gistFolderBuilder';
import { openGistFile } from '../helpers/gistHelpers';

/**
 * Registers all folder-related commands
 */
export function registerFolderCommands(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider
) {
	const createSubfolderInFolderCommand = vscode.commands.registerCommand(
		'gist-editor.createSubfolderInFolder',
		async (gistItem: GistItem) => {
			if (!gistItem || !gistItem.folder) {
				vscode.window.showErrorMessage('No folder selected');
				return;
			}

			try {
				// Get the current folder path
				const parentPath = gistItem.folder.path;
				const parentPathStr = parentPath.join('/');

				// Ask user for subfolder name
				const subfolderName = await vscode.window.showInputBox({
					prompt: `Enter subfolder name (parent: ${parentPathStr})`,
					placeHolder: 'e.g., Advanced, Utils, Helpers',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value.trim()) {
							return 'Subfolder name is required';
						}
						if (value.includes('/')) {
							return 'Subfolder name cannot contain slashes';
						}
						return '';
					}
				});

				if (!subfolderName) {
					return; // User cancelled
				}

				// Build new folder path
				const newFolderPath = [...parentPath, subfolderName.trim()];
				const newFolderPathStr = newFolderPath.join('/');

				// Get gist name and description
				const gistName = await vscode.window.showInputBox({
					prompt: 'Enter gist name for this subfolder',
					placeHolder: 'e.g., My Utilities',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value.trim()) {
							return 'Gist name is required';
						}
						return '';
					}
				});

				if (!gistName) {
					return; // User cancelled
				}

				// Ask for visibility
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
					return; // User cancelled
				}

				const isPublic = visibility.detail === 'public';

				// Build description with the new subfolder path
				const description = createGistDescription(newFolderPath, gistName.trim());

				// Create the gist
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Creating gist in ${newFolderPathStr}...`,
					cancellable: false
				}, async () => {
					// Create with a placeholder file containing folder info
					const placeholderContent = `Folder: ${newFolderPathStr}\nCreated: ${new Date().toISOString()}\n\nThis is a subfolder for organizing gists.`;
					const newGist = await githubService.createGist(
						description,
						{ 'README.md': { content: placeholderContent } },
						isPublic
					);

					myGistsProvider.refresh();
					starredGistsProvider.refresh();

					vscode.window.showInformationMessage(
						`Gist created in folder "${newFolderPathStr}"`
					);
				});
			} catch (error) {
				console.error('Error creating subfolder:', error);
				vscode.window.showErrorMessage(`Failed to create subfolder: ${error}`);
			}
		}
	);

	const renameFolderCommand = vscode.commands.registerCommand(
		'gist-editor.renameFolder',
		async (gistItem: GistItem) => {
			if (!gistItem || !gistItem.folder) {
				vscode.window.showErrorMessage('No folder selected');
				return;
			}

			try {
				const folder = gistItem.folder;
				const currentFolderPath = folder.path;
				const currentFolderName = folder.displayName;
				const parentPath = currentFolderPath.slice(0, -1);

				// Ask user for new folder name
				const newFolderName = await vscode.window.showInputBox({
					prompt: `Rename folder "${currentFolderName}"`,
					value: currentFolderName,
					placeHolder: 'Enter new folder name',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value.trim()) {
							return 'Folder name is required';
						}
						if (value.includes('/')) {
							return 'Folder name cannot contain slashes';
						}
						if (value.trim() === currentFolderName) {
							return 'New name must be different from current name';
						}
						return '';
					}
				});

				if (!newFolderName) {
					return; // User cancelled
				}

				// Build new folder path
				const newFolderPath = [...parentPath, newFolderName.trim()];
				const oldFolderPathStr = currentFolderPath.join('/');
				const newFolderPathStr = newFolderPath.join('/');

				// Get all gists to find those in this folder
				const allGists = await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Fetching gists...',
					cancellable: false
				}, async () => {
					return await githubService.getMyGists();
				});

				// Find all gists in this folder and its subfolders
				const gistsToUpdate = allGists.filter((gist) => {
					const parsed = parseGistDescription(gist.description || '');
					const gistPath = parsed.folderPath;

					// Check if gist is directly in this folder or in a subfolder
					if (gistPath.length > 0) {
						// Check if the gist's path starts with the current folder path
						let isInFolder = true;
						for (let i = 0; i < currentFolderPath.length; i++) {
							if (gistPath[i] !== currentFolderPath[i]) {
								isInFolder = false;
								break;
							}
						}
						return isInFolder;
					}
					return false;
				});

				if (gistsToUpdate.length === 0) {
					vscode.window.showInformationMessage(`No gists found in folder "${currentFolderName}"`);
					return;
				}

				// Confirm the rename operation
				const confirmed = await vscode.window.showWarningMessage(
					`Rename folder "${currentFolderName}" to "${newFolderName.trim()}"? This will update ${gistsToUpdate.length} gist${gistsToUpdate.length !== 1 ? 's' : ''}.`,
					{ modal: true },
					'Rename'
				);

				if (confirmed !== 'Rename') {
					return; // User cancelled
				}

				// Update all gists in this folder
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Renaming folder to "${newFolderName.trim()}"...`,
					cancellable: false
				}, async () => {
					let successCount = 0;
					let errorCount = 0;

					for (const gist of gistsToUpdate) {
						try {
							const parsed = parseGistDescription(gist.description || '');
							const gistPath = parsed.folderPath;
							const gistDisplayName = parsed.displayName;

							// Replace the old folder name segment with the new one
							const newGistPath = gistPath.map((segment, index) => {
								if (index < currentFolderPath.length) {
									// Replace at the same level
									if (index === currentFolderPath.length - 1) {
										return newFolderName.trim();
									}
									return segment;
								}
								return segment;
							});

							// Create new description
							const newDescription = createGistDescription(newGistPath, gistDisplayName);

							// Update the gist
							await githubService.updateGist(gist.id, newDescription);
							successCount++;
						} catch (error) {
							console.error(`Error updating gist ${gist.id}:`, error);
							errorCount++;
						}
					}

					// Refresh the tree
					myGistsProvider.refresh();
					starredGistsProvider.refresh();

					if (errorCount === 0) {
						vscode.window.showInformationMessage(
							`Folder renamed to "${newFolderName.trim()}" (${successCount} gist${successCount !== 1 ? 's' : ''} updated)`
						);
					} else {
						vscode.window.showWarningMessage(
							`Folder renamed with errors. Updated: ${successCount}, Failed: ${errorCount}`
						);
					}
				});
			} catch (error) {
				console.error('Error renaming folder:', error);
				vscode.window.showErrorMessage(`Failed to rename folder: ${error}`);
			}
		}
	);

	const addGistToFolderCommand = vscode.commands.registerCommand(
		'gist-editor.addGistToFolder',
		async (gistItem: GistItem) => {
			if (!gistItem || !gistItem.folder) {
				vscode.window.showErrorMessage('No folder selected');
				return;
			}

			try {
				const folder = gistItem.folder;
				const folderPath = folder.path;
				const folderPathStr = folderPath.join('/');

				// Get gist name
				const gistName = await vscode.window.showInputBox({
					prompt: `Create gist in folder "${folderPathStr}"`,
					placeHolder: 'e.g., My Utility Function',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value.trim()) {
							return 'Gist name is required';
						}
						return '';
					}
				});

				if (!gistName) {
					return; // User cancelled
				}

				// Get file name
				const fileName = await vscode.window.showInputBox({
					prompt: 'Enter file name',
					placeHolder: 'e.g., index.js, helper.ts, script.py',
					ignoreFocusOut: true,
					validateInput: (value) => {
						if (!value.trim()) {
							return 'File name is required';
						}
						return '';
					}
				});

				if (!fileName) {
					return; // User cancelled
				}

				// Get file content
				const fileContent = await vscode.window.showInputBox({
					prompt: 'Enter file content',
					placeHolder: 'You can edit this later...',
					ignoreFocusOut: true
				});

				// Ask for visibility
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
					return; // User cancelled
				}

				const isPublic = visibility.detail === 'public';

				// Build description with folder path
				const description = createGistDescription(folderPath, gistName.trim());

				// Create the gist
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Creating gist "${gistName.trim()}" in ${folderPathStr}...`,
					cancellable: false
				}, async () => {
					const newGist = await githubService.createGist(
						description,
						{ [fileName.trim()]: { content: fileContent || '' } },
						isPublic
					);

					myGistsProvider.refresh();
					starredGistsProvider.refresh();

					vscode.window.showInformationMessage(
						`Gist "${gistName.trim()}" created in folder "${folderPathStr}"`
					);

					// Optionally open the gist
					const openGist = await vscode.window.showInformationMessage(
						'Open gist file?',
						'Yes',
						'No'
					);

					if (openGist === 'Yes') {
						const file = newGist.files[fileName.trim()];
						if (file) {
							const gistUri = vscode.Uri.parse(`gist://${newGist.id}/${encodeURIComponent(fileName.trim())}`);
							const doc = await vscode.workspace.openTextDocument(gistUri);
							await vscode.window.showTextDocument(doc);
						}
					}
				});
			} catch (error) {
				console.error('Error adding gist to folder:', error);
				vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
			}
		}
	);

	const moveGistToFolderCommand = vscode.commands.registerCommand(
		'gist-editor.moveGistToFolder',
		async (gistItem: GistItem) => {
			if (!gistItem || !gistItem.gist) {
				vscode.window.showErrorMessage('No gist selected');
				return;
			}

			try {
				// Get all gists to build the folder tree
				const allGists = await githubService.getMyGists();
				const folderResult = new GistFolderBuilder().buildFolderTree(
					allGists.filter(g => g.public === gistItem.gist!.public)
				);

				// Create quick pick items for folders
				interface FolderQuickPickItem extends vscode.QuickPickItem {
					folderPath: string[];
				}

				const folderItems: FolderQuickPickItem[] = [
					{
						label: '$(home) Root (No Folder)',
						description: 'Move to root level',
						folderPath: []
					}
				];

				// Add existing folders
				const allFolders = folderResult.folders;
				const addFoldersToList = (folders: GistFolder[], depth: number) => {
					for (const folder of folders) {
						const indent = '  '.repeat(depth);
						folderItems.push({
							label: `${indent}📁 ${folder.displayName}`,
							description: `${folder.gists.length} gist${folder.gists.length !== 1 ? 's' : ''}`,
							folderPath: folder.path
						});
						addFoldersToList(folder.subFolders, depth + 1);
					}
				};

				addFoldersToList(allFolders, 0);

				// Ask user to select target folder
				const selectedFolder = await vscode.window.showQuickPick(folderItems, {
					placeHolder: 'Select target folder for this gist',
					matchOnDescription: true,
					matchOnDetail: true
				});

				if (!selectedFolder) {
					return; // User cancelled
				}

				// Get current gist description
				const parsed = parseGistDescription(gistItem.gist.description || '');

				// Create new description with target folder path
				const newDescription = createGistDescription(selectedFolder.folderPath, parsed.displayName);

				// Update the gist with new folder path
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Moving gist...',
					cancellable: false
				}, async () => {
					await githubService.updateGist(gistItem.gist!.id, newDescription);
					myGistsProvider.refresh();
					starredGistsProvider.refresh();

					const targetPath = selectedFolder.folderPath.length > 0
						? selectedFolder.folderPath.join(' > ')
						: 'root';
					vscode.window.showInformationMessage(
						`✓ Moved "${parsed.displayName}" to ${targetPath}`
					);
				});
			} catch (error) {
				console.error('Error moving gist:', error);
				vscode.window.showErrorMessage(`Failed to move gist: ${error}`);
			}
		}
	);

	context.subscriptions.push(
		createSubfolderInFolderCommand,
		renameFolderCommand,
		addGistToFolderCommand,
		moveGistToFolderCommand
	);
}
