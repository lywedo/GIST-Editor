import * as vscode from 'vscode';
import { Gist, GitHubService } from '../../githubService';
import { GistProvider } from '../../providers/gistProvider';
import { getLanguageId, getLanguageFromExtension } from '../../utils/languageDetection';

/**
 * Opens a gist file in the editor with proper language detection
 */
export async function openGistFile(gist: Gist, file: any) {
	try {
		// Create a custom URI scheme for gist files
		// Encode the filename to handle special characters
		const encodedFilename = encodeURIComponent(file.filename);
		const uri = vscode.Uri.parse(`gist:/${gist.id}/${encodedFilename}`);

		// Open the document
		console.log(`Opening gist file: "${file.filename}" (${file.language || 'unknown language'})`);
		console.log(`Gist details: ID=${gist.id}, Public=${gist.public}, Owner=${gist.owner?.login}`);
		console.log(`Encoded filename: ${encodedFilename}`);
		console.log(`Opening URI: ${uri.toString()}`);

		const document = await vscode.workspace.openTextDocument(uri);
		const editor = await vscode.window.showTextDocument(document);
		console.log(`Successfully opened document for ${file.filename}`);

		// Set the language mode - try multiple approaches
		try {
			let languageId = null;

			// First try: Use GitHub's language detection
			if (file.language && file.language !== 'Text') {
				languageId = getLanguageId(file.language);
			}

			// Second try: Use file extension
			if (!languageId || languageId === 'plaintext') {
				languageId = getLanguageFromExtension(file.filename);
			}

			// Apply the language if we found one
			if (languageId && languageId !== 'plaintext') {
				console.log(`Attempting to set language to ${languageId} for ${file.filename}`);
				await vscode.languages.setTextDocumentLanguage(document, languageId);
				console.log(`Successfully set language to ${languageId} for ${file.filename}`);
			} else {
				console.log(`Using default language (plaintext) for ${file.filename}`);
			}
		} catch (langError) {
			console.warn('Failed to set language mode:', langError);
			// Continue anyway - file will still open
		}

		vscode.window.showInformationMessage(`Opened ${file.filename} from gist "${gist.description || 'Untitled'}"`);
	} catch (error: any) {
		console.error('Error opening gist file:', error);

		// Provide more specific error messages
		let errorMessage = `Failed to open file: `;
		if (error.message?.includes('Access denied') || error.message?.includes('403')) {
			errorMessage += `Access denied. This private gist might not be accessible with your current token.`;
		} else if (error.message?.includes('not found') || error.message?.includes('404')) {
			errorMessage += `Gist not found or has been deleted.`;
		} else if (error.message?.includes('File') && error.message?.includes('not found')) {
			errorMessage += `File "${file.filename}" not found in gist.`;
		} else {
			errorMessage += error.message || 'Unknown error';
		}

		vscode.window.showErrorMessage(errorMessage);
	}
}

/**
 * Prompts user for folder organization and display name
 */
export async function getFolderPathAndName(defaultName: string): Promise<{ folderPath?: string; displayName: string } | null> {
	// Ask if user wants to organize in a folder
	const organizeChoice = await vscode.window.showQuickPick([
		{
			label: '📁 Organize in a folder',
			description: 'Create folder hierarchy (e.g., React/Components)',
			detail: 'with-folder'
		},
		{
			label: '📄 No folder (flat)',
			description: 'Keep at root level',
			detail: 'no-folder'
		}
	], {
		placeHolder: 'Do you want to organize this gist in a folder?',
		ignoreFocusOut: true
	});

	if (!organizeChoice) {
		return null;
	}

	let folderPath: string | undefined = undefined;
	let displayName = defaultName;

	if (organizeChoice.detail === 'with-folder') {
		// Ask for folder path
		folderPath = await vscode.window.showInputBox({
			prompt: 'Enter folder path (use / to nest, e.g., React/Components)',
			placeHolder: 'React/Components',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (value && value.includes('--')) {
					return 'Folder path cannot contain --';
				}
				return null;
			}
		});

		if (!folderPath) {
			return null;
		}

		// Ask for gist name/display name
		displayName = await vscode.window.showInputBox({
			prompt: 'Enter gist name (display name)',
			value: defaultName,
			placeHolder: 'My component',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value || !value.trim()) {
					return 'Display name cannot be empty';
				}
				return null;
			}
		}) || defaultName;
	} else {
		// Just ask for description
		displayName = await vscode.window.showInputBox({
			prompt: 'Enter a description for your gist',
			value: defaultName,
			placeHolder: 'Gist description',
			ignoreFocusOut: true
		}) || defaultName;
	}

	return {
		folderPath,
		displayName
	};
}

/**
 * Creates gist from currently active file in editor
 */
export async function createFromCurrentFile(): Promise<{ [filename: string]: { content: string } }> {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		vscode.window.showErrorMessage('No file is currently open');
		return {};
	}

	const document = activeEditor.document;
	const content = document.getText();

	if (!content.trim()) {
		vscode.window.showErrorMessage('Current file is empty. GitHub requires gist content.');
		return {};
	}

	// Get filename from document
	const fileName = document.fileName.split(/[/\\]/).pop() || 'untitled.txt';

	return {
		[fileName]: { content }
	};
}

/**
 * Creates gist from selected text in active editor
 */
export async function createFromSelection(): Promise<{ [filename: string]: { content: string } }> {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		vscode.window.showErrorMessage('No file is currently open');
		return {};
	}

	const selection = activeEditor.selection;
	const selectedText = activeEditor.document.getText(selection);

	if (!selectedText.trim()) {
		vscode.window.showErrorMessage('No text is selected or selection is empty. GitHub requires gist content.');
		return {};
	}

	// Get file extension from current document
	const document = activeEditor.document;
	const fileName = document.fileName.split(/[/\\]/).pop() || 'untitled.txt';
	const extension = fileName.split('.').pop() || 'txt';

	const gistFileName = await vscode.window.showInputBox({
		prompt: 'Enter filename for the selected code',
		value: `snippet.${extension}`,
		placeHolder: 'filename.ext',
		ignoreFocusOut: true
	});

	if (!gistFileName) {
		return {};
	}

	return {
		[gistFileName]: { content: selectedText }
	};
}

/**
 * Creates an empty gist with smart default content based on file extension
 */
export async function createEmptyGist(): Promise<{ [filename: string]: { content: string } }> {
	const fileName = await vscode.window.showInputBox({
		prompt: 'Enter filename for your new gist',
		value: 'untitled.txt',
		placeHolder: 'filename.ext',
		ignoreFocusOut: true,
		validateInput: (value) => {
			if (!value.trim()) {
				return 'Filename cannot be empty';
			}
			return null;
		}
	});

	if (!fileName) {
		return {};
	}

	// Provide smart default content based on file extension
	const extension = fileName.split('.').pop()?.toLowerCase() || '';
	let defaultContent = '// Add your content here';

	switch (extension) {
		case 'js':
		case 'ts':
			defaultContent = 'console.log("Hello, World!");';
			break;
		case 'py':
			defaultContent = 'print("Hello, World!")';
			break;
		case 'java':
			defaultContent = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}';
			break;
		case 'html':
			defaultContent = '<!DOCTYPE html>\n<html>\n<head>\n    <title>My Gist</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>';
			break;
		case 'css':
			defaultContent = 'body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}';
			break;
		case 'md':
			defaultContent = '# My Gist\n\nAdd your content here...';
			break;
		case 'json':
			defaultContent = '{\n    "name": "example",\n    "version": "1.0.0"\n}';
			break;
		case 'sh':
			defaultContent = '#!/bin/bash\necho "Hello, World!"';
			break;
		default:
			defaultContent = 'Add your content here...';
	}

	const content = await vscode.window.showInputBox({
		prompt: 'Enter content for your gist (optional - press Enter to use default)',
		value: defaultContent,
		placeHolder: 'Press Enter to skip and use "Hello World" as default content',
		ignoreFocusOut: true
	});

	// If user cancelled, return empty
	if (content === undefined) {
		return {};
	}

	// If user skipped (empty string), use "Hello World" as default
	const finalContent = content.trim() === '' ? 'Hello World' : content;

	return {
		[fileName]: { content: finalContent }
	};
}

/**
 * Creates gist with multiple files
 */
export async function createMultiFileGist(): Promise<{ [filename: string]: { content: string } }> {
	const files: { [filename: string]: { content: string } } = {};

	while (true) {
		const fileName = await vscode.window.showInputBox({
			prompt: `Enter filename for file #${Object.keys(files).length + 1} (or press Escape to finish)`,
			placeHolder: 'filename.ext',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Filename cannot be empty';
				}
				if (files[value]) {
					return 'Filename already exists';
				}
				return null;
			}
		});

		if (!fileName) {
			break; // User cancelled or finished
		}

		// Provide smart default content based on file extension
		const extension = fileName.split('.').pop()?.toLowerCase() || '';
		let defaultContent = 'Add content here...';

		switch (extension) {
			case 'js':
			case 'ts':
				defaultContent = 'console.log("Hello from ' + fileName + '");';
				break;
			case 'py':
				defaultContent = 'print("Hello from ' + fileName + '")';
				break;
			case 'md':
				defaultContent = '# ' + fileName.replace(/\.[^/.]+$/, '') + '\n\nAdd your content here...';
				break;
			case 'json':
				defaultContent = '{\n    "file": "' + fileName + '",\n    "content": "example"\n}';
				break;
			default:
				defaultContent = 'Add content for ' + fileName + ' here...';
		}

		const content = await vscode.window.showInputBox({
			prompt: `Enter content for ${fileName} (required)`,
			value: defaultContent,
			placeHolder: 'File content is required...',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Content cannot be empty - GitHub requires file content';
				}
				return null;
			}
		});

		if (!content) {
			// User cancelled, remove this iteration
			continue;
		}

		files[fileName] = { content };

		// Ask if user wants to add more files
		const addMore = await vscode.window.showQuickPick([
			{ label: 'Yes', detail: 'add-more' },
			{ label: 'No, create gist now', detail: 'finish' }
		], {
			placeHolder: 'Add another file?',
			ignoreFocusOut: true
		});

		if (!addMore || addMore.detail === 'finish') {
			break;
		}
	}

	if (Object.keys(files).length === 0) {
		vscode.window.showInformationMessage('No files added. Gist creation cancelled.');
	}

	return files;
}

/**
 * Creates gist from files with full UI flow (folder selection, visibility, etc.)
 */
export async function createGistFromFiles(
	files: { [filename: string]: { content: string } },
	defaultDescription: string,
	githubService: GitHubService,
	myGistsProvider: GistProvider
) {
	// Validate that all files have content
	const emptyFiles = Object.entries(files).filter(([_, file]) => !file.content.trim());
	if (emptyFiles.length > 0) {
		vscode.window.showErrorMessage(`Cannot create gist: ${emptyFiles.map(([name]) => name).join(', ')} ${emptyFiles.length === 1 ? 'is' : 'are'} empty. GitHub requires all files to have content.`);
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
}
