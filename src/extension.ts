// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitHubService, Gist, GistComment, ApiUsageStats } from './githubService';
import { GistFolderBuilder, GistFolder } from './gistFolderBuilder';
import { parseGistDescription, createGistDescription } from './gistDescriptionParser';
import { SearchProvider, SearchResult } from './searchProvider';
import { TagsManager } from './tagsManager';
import { GistProvider } from './providers/gistProvider';
import { GistItem } from './providers/gistItem';
import { GistFileSystemProvider } from './providers/gistFileSystem';
import { CommentProvider } from './providers/commentProvider';
import { getLanguageId, getLanguageFromExtension } from './utils/languageDetection';
import { getFileIcon } from './utils/fileIcons';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gist-editor" is now active!');

	// Create GitHub service
	const githubService = new GitHubService();

	// Create tags manager (uses protocol embedded in gist descriptions)
	const tagsManager = new TagsManager(githubService);

	// Search cache
	interface SearchCache {
		searchProvider: SearchProvider;
		timestamp: number;
		myGistIds: Set<string>;
		starredGistIds: Set<string>;
	}
	let searchCache: SearchCache | null = null;

	// Helper to clear search cache
	const clearSearchCache = () => {
		searchCache = null;
	};

	// Create output channel for API usage statistics
	const apiUsageOutputChannel = vscode.window.createOutputChannel('Gist Editor - API Usage');
	context.subscriptions.push(apiUsageOutputChannel);

	// Create gist file system provider
	const gistFileSystemProvider = new GistFileSystemProvider(githubService);
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider('gist', gistFileSystemProvider, {
			isCaseSensitive: true,
			isReadonly: false
		})
	);

	// Create tree data providers
	const myGistsProvider = new GistProvider('my', githubService, tagsManager);
	const starredGistsProvider = new GistProvider('starred', githubService, tagsManager);
	const commentProvider = new CommentProvider(githubService);

	// Register tree data providers
	vscode.window.registerTreeDataProvider('gist-editor.gistList', myGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.starred', starredGistsProvider);
	vscode.window.registerTreeDataProvider('gist-editor.comments', commentProvider);

	// Clear search cache when tags change
	tagsManager.onTagsChanged(() => {
		clearSearchCache();
	});

	// Track gist selection for comments view
	const gistSelectionTracker = vscode.window.createTreeView('gist-editor.gistList', {
		treeDataProvider: myGistsProvider,
		dragAndDropController: myGistsProvider,
		showCollapseAll: true
	});

	const starredSelectionTracker = vscode.window.createTreeView('gist-editor.starred', {
		treeDataProvider: starredGistsProvider,
		dragAndDropController: starredGistsProvider,
		showCollapseAll: true
	});

	// Mock gist IDs that should not trigger comment loading
	const mockGistIds = new Set(['not-authenticated', 'no-gist', 'no-comments', 'error']);

	// Listen for gist selection in both views
	gistSelectionTracker.onDidChangeSelection((e) => {
		if (e.selection.length > 0) {
			const selectedItem = e.selection[0];
			if (selectedItem instanceof GistItem && selectedItem.gist && selectedItem.contextValue === 'gist') {
				// Don't select mock items
				if (!mockGistIds.has(selectedItem.gist.id)) {
					console.log(`[Selection] Selected gist: ${selectedItem.gist.description}`);
					commentProvider.setSelectedGist(selectedItem.gist);
				}
			}
		}
	});

	starredSelectionTracker.onDidChangeSelection((e) => {
		if (e.selection.length > 0) {
			const selectedItem = e.selection[0];
			if (selectedItem instanceof GistItem && selectedItem.gist && selectedItem.contextValue === 'gist') {
				// Don't select mock items
				if (!mockGistIds.has(selectedItem.gist.id)) {
					console.log(`[Selection] Selected starred gist: ${selectedItem.gist.description}`);
					commentProvider.setSelectedGist(selectedItem.gist);
				}
			}
		}
	});

	// Register commands
	const helloWorldCommand = vscode.commands.registerCommand('gist-editor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Gist Editor!');
	});

	const refreshCommand = vscode.commands.registerCommand('gist-editor.refresh', () => {
		clearSearchCache();
		myGistsProvider.refresh();
		starredGistsProvider.refresh();
		vscode.window.showInformationMessage('Gists refreshed!');
	});

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

	async function openGistFile(gist: Gist, file: any) {
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

	// Helper function to get folder path and display name from user
	async function getFolderPathAndName(defaultName: string): Promise<{ folderPath?: string; displayName: string } | null> {
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

	// Helper functions for creating gists
	async function createFromCurrentFile(): Promise<{ [filename: string]: { content: string } }> {
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

	async function createFromSelection(): Promise<{ [filename: string]: { content: string } }> {
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

	async function createEmptyGist(): Promise<{ [filename: string]: { content: string } }> {
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

	async function createMultiFileGist(): Promise<{ [filename: string]: { content: string } }> {
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

	// Command to create gist from current file
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

			await createGistFromFiles(files, `Gist from ${Object.keys(files)[0]}`);
		} catch (error) {
			console.error('Error creating gist from file:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	// Command to create gist from selection
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

			await createGistFromFiles(files, 'Code snippet');
		} catch (error) {
			console.error('Error creating gist from selection:', error);
			vscode.window.showErrorMessage(`Failed to create gist: ${error}`);
		}
	});

	// Helper function to create gist from files
	async function createGistFromFiles(files: { [filename: string]: { content: string } }, defaultDescription: string) {
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

	// Command to open a specific gist file
	const openGistFileCommand = vscode.commands.registerCommand('gist-editor.openGistFile', async (gist: Gist, file: any) => {
		await openGistFile(gist, file);
	});

	const setupTokenCommand = vscode.commands.registerCommand('gist-editor.setupToken', async () => {
		const isAuthenticated = githubService.isAuthenticated();

		// Show current status and options
		const tokenStatus = githubService.getTokenStatus();
		const action = await vscode.window.showQuickPick([
			{
				label: isAuthenticated ? '$(github) Sign in with GitHub' : '$(github) Sign in with GitHub',
				description: isAuthenticated ? 'Sign in again or switch account' : 'Quick OAuth login - opens your browser',
				detail: 'oauth'
			},
			{
				label: '$(key) Use Personal Access Token',
				description: 'Manually enter a GitHub Personal Access Token',
				detail: 'manual'
			},
			...(isAuthenticated ? [{
				label: '$(trash) Sign Out',
				description: 'Sign out and remove GitHub authentication',
				detail: 'logout'
			}] : [])
		], {
			placeHolder: `Current Status: ${tokenStatus}`,
			ignoreFocusOut: true
		});

		if (!action) {
			return;
		}

		if (action.detail === 'oauth') {
			// Use OAuth flow
			try {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Signing in with GitHub...',
					cancellable: false
				}, async () => {
					await githubService.getOAuthToken();

					// Get username to confirm login
					const username = await githubService.getCurrentUsername();

					vscode.window.showInformationMessage(
						`Successfully signed in as @${username}!`,
						'Refresh Gists'
					).then(selection => {
						if (selection === 'Refresh Gists') {
							myGistsProvider.refresh();
							starredGistsProvider.refresh();
						}
					});

					// Auto-refresh after successful authentication
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
					commentProvider.refresh();
				});
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to authenticate with GitHub: ${error}`,
					'Try Again'
				).then(selection => {
					if (selection === 'Try Again') {
						vscode.commands.executeCommand('gist-editor.setupToken');
					}
				});
			}
			return;
		}

		if (action.detail === 'logout') {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to sign out?',
				{ modal: true },
				'Sign Out',
				'Cancel'
			);

			if (confirm === 'Sign Out') {
				try {
					await githubService.removeToken();
					vscode.window.showInformationMessage('You have been signed out!');
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
					commentProvider.clearSelectedGist();
					commentProvider.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to sign out: ${error}`);
				}
			}
			return;
		}

		// Manual token entry
		const token = await vscode.window.showInputBox({
			prompt: 'Enter your GitHub Personal Access Token',
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
					'GitHub token configured successfully!',
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
				commentProvider.refresh();
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
			
			// Test fetching user and check scopes
			const username = await githubService.getCurrentUsername();
			console.log('Current user:', username);
			
			const gists = await githubService.getMyGists();
			
			// Count public vs private
			const publicCount = gists.filter(g => g.public).length;
			const privateCount = gists.filter(g => !g.public).length;
			
			vscode.window.showInformationMessage(
				`Found ${gists.length} gists!\nPublic: ${publicCount}, Private: ${privateCount}`,
				'Show Details'
			).then(selection => {
				if (selection === 'Show Details') {
					const details = gists.map(g => `${g.public ? '🌐' : '🔒'} ${g.description || 'Untitled'}`).join('\n');
					vscode.window.showInformationMessage(details);
				}
			});
			console.log('Gists:', gists.map(g => ({ id: g.id, public: g.public, desc: g.description })));
		} catch (error) {
			console.error('API test error:', error);
			vscode.window.showErrorMessage(`API test failed: ${error}`);
		}
	});

	// Diagnostic command to check token scopes
	const checkScopesCommand = vscode.commands.registerCommand('gist-editor.checkScopes', async () => {
		try {
			if (!githubService.isAuthenticated()) {
				vscode.window.showWarningMessage('No GitHub token configured. Please set up authentication first.');
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Checking GitHub token permissions...',
				cancellable: false
			}, async () => {
				try {
					// Check token scopes
					const scopes = await githubService.checkTokenScopes();
					const hasGistScope = scopes.includes('gist');
					
					// Fetch username and gists
					const username = await githubService.getCurrentUsername();
					const gists = await githubService.getMyGists();
					
					const publicCount = gists.filter(g => g.public).length;
					const privateCount = gists.filter(g => !g.public).length;
					
					let message = `✓ Authenticated as: ${username}\n`;
					message += `✓ Token scopes: ${scopes.join(', ')}\n\n`;
					message += `Total gists: ${gists.length}\n`;
					message += `📂 Public gists: ${publicCount}\n`;
					message += `🔒 Private gists: ${privateCount}\n\n`;
					
					if (!hasGistScope) {
						message += `❌ PROBLEM FOUND: Your token is missing the "gist" scope!\n\n`;
						message += `This is why you cannot access private gists.\n\n`;
						message += `To fix this:\n`;
						message += `1. Go to github.com/settings/tokens\n`;
						message += `2. Click "Generate new token (classic)"\n`;
						message += `3. Check the "gist" checkbox ✓\n`;
						message += `4. Generate and copy the token\n`;
						message += `5. Click the gear (⚙️) button in "My Gists" view\n`;
						message += `6. Select "Change GitHub Token" and paste your new token`;
						
						vscode.window.showErrorMessage(message, 'Open GitHub Settings', 'Setup Token').then(selection => {
							if (selection === 'Open GitHub Settings') {
								vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
							} else if (selection === 'Setup Token') {
								vscode.commands.executeCommand('gist-editor.setupToken');
							}
						});
					} else if (privateCount === 0 && publicCount > 0) {
						message += `✓ Your token has the "gist" scope.\n`;
						message += `ℹ️ You either have no private gists, or they're not showing up.\n\n`;
						message += `Try:\n`;
						message += `1. Check on github.com/gists if you have private gists\n`;
						message += `2. Click the refresh button in the Gist Editor sidebar`;
						
						vscode.window.showInformationMessage(message, 'Refresh Gists').then(selection => {
							if (selection === 'Refresh Gists') {
								vscode.commands.executeCommand('gist-editor.refresh');
							}
						});
					} else {
						message += `✓ Everything looks good! Your token has proper access.`;
						vscode.window.showInformationMessage(message, 'OK');
					}
				} catch (error: any) {
					let errorMsg = '❌ Token Permission Check Failed\n\n';
					
					if (error.response?.status === 403) {
						errorMsg += 'Your token does not have the required permissions.\n\n';
						errorMsg += '🔧 FIX: Create a new GitHub Personal Access Token\n\n';
						errorMsg += 'Steps:\n';
						errorMsg += '1. Visit: github.com/settings/tokens\n';
						errorMsg += '2. "Generate new token (classic)"\n';
						errorMsg += '3. Name: "VS Code Gist Editor"\n';
						errorMsg += '4. ✓ Check the "gist" scope\n';
						errorMsg += '5. Click "Generate token"\n';
						errorMsg += '6. Copy the token (you only see it once!)\n';
						errorMsg += '7. In VS Code: Click ⚙️ in Gist Editor → Update token';
					} else if (error.response?.status === 401) {
						errorMsg += 'Your token is invalid or has been revoked.\n\n';
						errorMsg += 'Please create a new token with the "gist" scope.';
					} else {
						errorMsg += `Error: ${error.message}\n\n`;
						errorMsg += 'This might be a network issue or GitHub API problem.';
					}
					
					vscode.window.showErrorMessage(errorMsg, 'Open Token Settings', 'Setup Token').then(selection => {
						if (selection === 'Open Token Settings') {
							vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
						} else if (selection === 'Setup Token') {
							vscode.commands.executeCommand('gist-editor.setupToken');
						}
					});
				}
			});
		} catch (error) {
			console.error('Scope check error:', error);
			vscode.window.showErrorMessage(`Failed to check permissions: ${error}`);
		}
	});

	// View API Usage Statistics command
	const viewApiUsageCommand = vscode.commands.registerCommand('gist-editor.viewApiUsage', async () => {
		try {
			if (!githubService.isAuthenticated()) {
				vscode.window.showWarningMessage('No GitHub token configured. Please set up authentication first.');
				return;
			}

			const stats = githubService.getApiUsageStats();

			// Clear previous output
			apiUsageOutputChannel.clear();

			// Build detailed message
			let message = `📊 GitHub API Usage Statistics\n`;
			message += `${'═'.repeat(60)}\n\n`;

			message += `SESSION INFORMATION\n`;
			message += `${'-'.repeat(60)}\n`;
			const sessionStart = new Date(stats.sessionStartTime);
			const now = new Date();
			const sessionDuration = Math.floor((now.getTime() - stats.sessionStartTime) / 1000);
			const hours = Math.floor(sessionDuration / 3600);
			const minutes = Math.floor((sessionDuration % 3600) / 60);
			const seconds = sessionDuration % 60;
			const durationStr = hours > 0
				? `${hours}h ${minutes}m ${seconds}s`
				: minutes > 0
				? `${minutes}m ${seconds}s`
				: `${seconds}s`;

			message += `Session Start:     ${sessionStart.toLocaleString()}\n`;
			message += `Session Duration:  ${durationStr}\n`;
			message += `Total API Calls:   ${stats.totalCalls}\n\n`;

			message += `API CALLS BY OPERATION\n`;
			message += `${'-'.repeat(60)}\n`;
			const callTypes = Object.entries(stats.callsByType)
				.sort((a, b) => (b[1] as number) - (a[1] as number))
				.map(([type, count]) => {
					const icon = type === 'gists' ? '📝' :
								 type === 'gist-comments' ? '💬' :
								 type === 'gist-history' ? '📜' :
								 type === 'star-unstar' ? '⭐' :
								 type === 'user-info' ? '👤' :
								 '🔧';
					return `  ${icon} ${type.padEnd(20)} : ${count}`;
				});

			if (callTypes.length === 0) {
				message += '  No API calls made yet\n\n';
			} else {
				message += callTypes.join('\n') + '\n\n';
			}

			message += `RATE LIMIT STATUS\n`;
			message += `${'-'.repeat(60)}\n`;
			const remaining = stats.rateLimit.remaining;
			const limit = stats.rateLimit.limit;
			const usedPercent = limit > 0 ? Math.round((limit - remaining) / limit * 100) : 0;
			const resetDate = new Date(stats.rateLimit.reset);

			message += `Calls Remaining:   ${remaining} / ${limit}\n`;
			message += `Usage:             ${usedPercent}% (${limit - remaining} calls used)\n`;
			message += `Rate Limit Resets: ${resetDate.toLocaleString()}\n\n`;

			message += `STATUS\n`;
			message += `${'-'.repeat(60)}\n`;
			if (remaining < 100 && limit > 0) {
				message += `⚠️  WARNING: You're approaching your rate limit!\n`;
				message += `    Please wait until the limit resets before making more requests.`;
			} else if (remaining === 0) {
				message += `❌ RATE LIMITED: You've hit your API limit!\n`;
				message += `    Please wait until ${resetDate.toLocaleString()} to continue.`;
			} else {
				message += `✓ You have plenty of API calls available.`;
			}

			message += `\n\n${'-'.repeat(60)}\n`;
			message += `Use 'gist-editor.resetApiUsageStats' command to reset statistics.\n`;

			// Write to output channel
			apiUsageOutputChannel.appendLine(message);
			apiUsageOutputChannel.show(true);

			vscode.window.showInformationMessage('API usage statistics displayed in "Gist Editor - API Usage" output panel');

		} catch (error) {
			console.error('Error viewing API usage:', error);
			vscode.window.showErrorMessage(`Failed to retrieve API usage stats: ${error}`);
		}
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

	// Note: Auto-save is now handled automatically by the FileSystemProvider
	// No need for a separate save listener

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
			prompt: 'Enter initial content for the file (optional)',
			placeHolder: 'File content',
			value: ''
		});

		if (content === undefined) {
			return; // User cancelled
		}

		try {
			await githubService.updateGist(gist.id, undefined, {
				[filename]: { content: content || ' ' } // GitHub requires non-empty content
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

	   // Move gist to folder command
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

	   // Search command
	   const searchCommand = vscode.commands.registerCommand('gist-editor.search', async () => {
		   if (!githubService.isAuthenticated()) {
			   try {
				   await githubService.getOAuthToken();
			   } catch (error) {
				   const setup = await vscode.window.showErrorMessage(
					   'You need to sign in with GitHub to search gists.',
					   'Sign in with GitHub'
				   );
				   if (setup === 'Sign in with GitHub') {
					   vscode.commands.executeCommand('gist-editor.setupToken');
				   }
				   return;
			   }
		   }

		   try {
			   let searchProvider: SearchProvider;
			   let myGistIds: Set<string>;
			   let starredGistIds: Set<string>;

			   // Use cached search provider if available
			   if (searchCache) {
				   console.log('[Search] Using cached search provider');
				   searchProvider = searchCache.searchProvider;
				   myGistIds = searchCache.myGistIds;
				   starredGistIds = searchCache.starredGistIds;
			   } else {
				   // Build search index (shown only on first open)
				   console.log('[Search] Building new search index');
				   ({ searchProvider, myGistIds, starredGistIds } = await vscode.window.withProgress({
					   location: vscode.ProgressLocation.Window,
					   title: 'Searching gists...'
				   }, async (progress) => {
					   // Fetch all gists
					   progress.report({ message: 'Fetching gists...' });
					   const myGists = await githubService.getMyGists();
					   const starredGists = await githubService.getStarredGists();
					   const allGists = [...myGists, ...starredGists];
			   		   const gistSources = new Map<string, 'my' | 'starred'>();
			   		   myGists.forEach((gistItem) => gistSources.set(gistItem.id, 'my'));
			   		   starredGists.forEach((gistItem) => {
			   			   if (!gistSources.has(gistItem.id)) {
			   				   gistSources.set(gistItem.id, 'starred');
			   			   }
			   		   });
			   		   const myGistIds = new Set(myGists.map(g => g.id));
			   		   const starredGistIds = new Set(starredGists.map(g => g.id));

					   // Build search index with tags
					   progress.report({ message: 'Building search index with tags...' });
					   const searchProvider = new SearchProvider(tagsManager);
					   // Use cached tags from both providers to avoid refetching
					   const cachedTags = new Map(myGistsProvider.getTagsCache());
					   for (const [gistId, tags] of starredGistsProvider.getTagsCache()) {
						   if (!cachedTags.has(gistId)) {
							   cachedTags.set(gistId, tags);
						   }
					   }
			   		   await searchProvider.buildSearchIndex(allGists, gistSources, cachedTags);

					   return { searchProvider, myGistIds, starredGistIds };
				   }));

				   // Cache the search provider
				   searchCache = {
					   searchProvider,
					   myGistIds,
					   starredGistIds,
					   timestamp: Date.now()
				   };
			   }

			   // Create quick pick with dynamic filtering
			   const quickPick = vscode.window.createQuickPick<{
				   label: string;
				   description: string;
				   detail: string;
				   result: SearchResult;
			   }>();

			   quickPick.placeholder = 'Type to search gists by name, description, file name, or content...';
			   quickPick.matchOnDescription = true;
			   quickPick.matchOnDetail = true;
			   quickPick.ignoreFocusOut = true;

			   // Helper to format tags in search results
			   const formatSearchTags = (tags?: string[]): string => {
				   if (!tags || tags.length === 0) {
					   return '';
				   }
				   return ` | ${tags.map(t => `#${t}`).join(' ')}`;
			   };

			   // Initial results - show all gists
			   const initialResults = await searchProvider.searchGists('');
			   quickPick.items = initialResults.slice(0, 50).map((result: SearchResult) => ({
				   label: `$(${result.matchType === 'content' ? 'file-text' : 'gist'}) ${result.gistName}${result.fileName ? ` → ${result.fileName}` : ''}`,
				   description: result.folderPath.length > 0 ? result.folderPath.join(' > ') : 'Root',
				   detail: `${getMatchTypeLabel(result.matchType)}${result.lineNumber ? ` (Line ${result.lineNumber})` : ''} • ${result.isPublic ? 'Public' : 'Private'} • ${result.preview}${formatSearchTags(result.tags)}`,
				   result
			   }));

			   // Update results as user types with debouncing
			   let searchTimeout: NodeJS.Timeout | undefined;
			   let isSearching = false;

			   quickPick.onDidChangeValue(async (value) => {
				   // Clear previous timeout
				   if (searchTimeout) {
					   clearTimeout(searchTimeout);
				   }

				   // Debounce search: wait 300ms before searching
				   searchTimeout = setTimeout(async () => {
					   try {
						   isSearching = true;
						   quickPick.busy = true;

						   if (!value.trim()) {
							   // Show all when empty
							   const allResults = await searchProvider.searchGists('');
							   quickPick.items = allResults.slice(0, 50).map((result: SearchResult) => ({
								   label: `$(${result.matchType === 'content' ? 'file-text' : 'gist'}) ${result.gistName}${result.fileName ? ` → ${result.fileName}` : ''}`,
								   description: result.folderPath.length > 0 ? result.folderPath.join(' > ') : 'Root',
								   detail: `${getMatchTypeLabel(result.matchType)}${result.lineNumber ? ` (Line ${result.lineNumber})` : ''} • ${result.isPublic ? 'Public' : 'Private'} • ${result.preview}${formatSearchTags(result.tags)}`,
								   result
							   }));
						   } else {
							   // Perform search with current query
							   const results = await searchProvider.searchGists(value);

							   if (results.length === 0) {
								   quickPick.items = [{
									   label: '$(search) No results found',
									   description: '',
									   detail: `No gists match "${value}"`,
									   result: null as any
								   }];
							   } else {
								   quickPick.items = results.map((result: SearchResult) => ({
									   label: `$(${result.matchType === 'content' ? 'file-text' : 'gist'}) ${result.gistName}${result.fileName ? ` → ${result.fileName}` : ''}`,
									   description: result.folderPath.length > 0 ? result.folderPath.join(' > ') : 'Root',
									   detail: `${getMatchTypeLabel(result.matchType)}${result.lineNumber ? ` (Line ${result.lineNumber})` : ''} • ${result.isPublic ? 'Public' : 'Private'} • ${result.preview}${formatSearchTags(result.tags)}`,
									   result
								   }));
							   }
						   }
					   } finally {
						   isSearching = false;
						   quickPick.busy = false;
					   }
				   }, 300);
			   });

			   // Handle selection
			   quickPick.onDidAccept(async () => {
				   const selected = quickPick.selectedItems[0];
				   quickPick.hide();

				   if (!selected || !selected.result) {
					   return;
				   }

				   const result = selected.result;
				   await revealSearchSelection(result, myGistIds, starredGistIds);

				   // Open the file or gist
				   if (result.fileName) {
					   // Open specific file
					   const uri = vscode.Uri.parse(`gist:/${result.gistId}/${encodeURIComponent(result.fileName)}`);
					   const doc = await vscode.workspace.openTextDocument(uri);
					   const editor = await vscode.window.showTextDocument(doc);

					   // If content match, jump to line
					   if (result.matchType === 'content' && result.lineNumber) {
						   const line = result.lineNumber - 1;
						   editor.selection = new vscode.Selection(line, 0, line, 0);
						   editor.revealRange(new vscode.Range(line, 0, line, 0));
					   }
				   } else {
					   // Open gist (will show files)
					   if (result.gist && result.gist.id) {
						   console.log(`[Search] Opening gist from search result: ${result.gist.id}`);
						   vscode.commands.executeCommand('gist-editor.openGist', result.gist);
					   } else {
						   console.error('[Search] Cannot open gist: search result is missing gist object or gist ID.', result);
						   vscode.window.showErrorMessage('Could not open the selected gist. The search result was incomplete.');
					   }
				   }
			   });

			   quickPick.onDidHide(() => quickPick.dispose());
			   quickPick.show();
		   } catch (error) {
			   console.error('Error searching gists:', error);
			   vscode.window.showErrorMessage(`Failed to search gists: ${error}`);
		   }
	   });

	   async function revealSearchSelection(result: SearchResult, myGistIds: Set<string>, starredGistIds: Set<string>): Promise<void> {
	   	try {
	   		let revealed = false;
	   		if (myGistIds.has(result.gistId)) {
	   			revealed = await revealInTreeView(gistSelectionTracker, myGistsProvider, result);
	   		}
	   		if (!revealed && starredGistIds.has(result.gistId)) {
	   			await revealInTreeView(starredSelectionTracker, starredGistsProvider, result);
	   		}
	   	} catch (error) {
	   		console.warn('[Search Reveal] Failed to reveal tree selection', error);
	   	}
	   }

	   async function revealInTreeView(
	   	treeView: vscode.TreeView<GistItem>,
	   	provider: GistProvider,
	   	result: SearchResult
	   ): Promise<boolean> {
		console.log(`[Search Reveal] Starting reveal for gist: ${result.gistId} in tree view.`);
	   	const visibility = result.isPublic ? 'public' : 'private';
	   	const rootItems = await provider.getChildren();
	   	const targetGroup = rootItems.find(item => item.isGroup && item.groupType === visibility);
	   	if (!targetGroup) {
			console.log(`[Search Reveal] Could not find target group: ${visibility}`);
	   		return false;
	   	}

		console.log(`[Search Reveal] Found target group: ${targetGroup.id}. Revealing...`);
	   	await treeView.reveal(targetGroup, { expand: true });

	   	let currentParent: GistItem = targetGroup;
	   	let pathSucceeded = true;
	   	const accumulatedPath: string[] = [];

	   	for (const segment of result.folderPath) {
	   		accumulatedPath.push(segment);
			console.log(`[Search Reveal] Looking for folder segment: "${segment}" in parent ${currentParent.id}`);
	   		const children = await provider.getChildren(currentParent);
	   		const folderItem = children.find(item => {
	   			if (!item.isFolder || !item.folder) {
	   				return false;
	   			}
				const itemPath = item.folder.path.join('/');
				const targetPath = accumulatedPath.join('/');
				console.log(`[Search Reveal]   - Checking folder: ${item.folder.displayName} (${itemPath}) against target ${targetPath}`);
	   			return item.folder.path.join('/') === accumulatedPath.join('/');
	   		});
	   		if (!folderItem) {
				console.log(`[Search Reveal] Could not find folder item for path: ${accumulatedPath.join('/')}`);
	   			pathSucceeded = false;
	   			break;
	   		}
			console.log(`[Search Reveal] Found folder item: ${folderItem.id}. Revealing...`);
	   		await treeView.reveal(folderItem, { expand: true });
	   		currentParent = folderItem;
	   	}

	   	let gistItem: GistItem | undefined;
	   	if (pathSucceeded) {
			console.log(`[Search Reveal] Path succeeded. Looking for gist ${result.gistId} in parent ${currentParent.id}`);
	   		const gistCandidates = await provider.getChildren(currentParent);
	   		gistItem = gistCandidates.find(item => item.gist && item.gist.id === result.gistId);
	   	}

	   	if (!gistItem) {
			console.log(`[Search Reveal] Gist not found with primary path. Using fallback...`);
	   		const fallbackPath = await findGistPath(provider, targetGroup, result.gistId);
	   		if (!fallbackPath) {
				console.log(`[Search Reveal] Fallback path not found for gist ${result.gistId}`);
	   			return false;
	   		}

			console.log(`[Search Reveal] Found fallback path with ${fallbackPath.length} items.`);
	   		for (const item of fallbackPath) {
	   			if (item.isFolder) {
					console.log(`[Search Reveal]   - Revealing fallback folder: ${item.id}`);
	   				await treeView.reveal(item, { expand: true });
	   			}
	   			if (item.gist && item.gist.id === result.gistId) {
					console.log(`[Search Reveal]   - Found gist item in fallback path: ${item.id}`);
	   				gistItem = item;
	   			}
	   		}
	   	}

	   	if (!gistItem) {
			console.log(`[Search Reveal] Gist item could not be found for ${result.gistId}`);
	   		return false;
	   	}

		console.log(`[Search Reveal] Found gist item: ${gistItem.id}. Revealing...`);
	   	await treeView.reveal(gistItem, { expand: true, select: !result.fileName, focus: !result.fileName });

	   	if (result.fileName) {
			console.log(`[Search Reveal] Looking for file: ${result.fileName}`);
	   		const fileItems = await provider.getChildren(gistItem);
	   		const fileItem = fileItems.find(item => item.file && item.file.filename === result.fileName);
	   		if (fileItem) {
				console.log(`[Search Reveal] Found file item: ${fileItem.id}. Revealing...`);
	   			await treeView.reveal(fileItem, { select: true, focus: true });
	   		} else {
				console.log(`[Search Reveal] File item not found. Focusing on gist item instead.`);
	   			await treeView.reveal(gistItem, { select: true, focus: true });
	   		}
	   	}

		console.log(`[Search Reveal] Reveal process completed for gist: ${result.gistId}`);
	   	return true;
	   }

	   async function findGistPath(
	   	provider: GistProvider,
	   	parent: GistItem,
	   	gistId: string
	   ): Promise<GistItem[] | undefined> {
	   	const children = await provider.getChildren(parent);
	   	for (const child of children) {
	   		if (child.gist && child.gist.id === gistId) {
	   			return [child];
	   		}
	   	}
	   	for (const child of children) {
	   		if (child.isFolder) {
	   			const nestedPath = await findGistPath(provider, child, gistId);
	   			if (nestedPath) {
	   				return [child, ...nestedPath];
	   			}
	   		}
	   	}
	   	return undefined;
	   }

	   // Helper function to get match type label
	   function getMatchTypeLabel(matchType: string): string {
		   switch (matchType) {
			   case 'name':
				   return '📋 Gist Name';
			   case 'description':
				   return '📝 Description';
			   case 'filename':
				   return '📄 File Name';
			   case 'content':
				   return '🔍 Content';
			   case 'tags':
				   return '🏷️  Tags';
			   default:
				   return '?';
		   }
	   }

	   // Tag management commands
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

	   // Add all commands to subscriptions
		  context.subscriptions.push(
			  helloWorldCommand,
			  refreshCommand,
			  createGistCommand,
			  createGistFromFileCommand,
			  createGistFromSelectionCommand,
			  openGistCommand,
			  openGistFileCommand,
			  setupTokenCommand,
			  testApiCommand,
			  checkScopesCommand,
			  saveGistCommand,
			  deleteGistCommand,
			  renameGistCommand,
			  toggleStarGistCommand,
			  addFileToGistCommand,
			  deleteFileFromGistCommand,
			  renameFileInGistCommand,
			  viewGistHistoryCommand,
			  openInGitHubCommand,
			  createSubfolderInFolderCommand,
			  renameFolderCommand,
			  addGistToFolderCommand,
			  moveGistToFolderCommand,
			  addGistCommentCommand,
			  deleteGistCommentCommand,
			  viewGistCommentOnGitHubCommand,
			  viewApiUsageCommand,
			  searchCommand,
			  addTagCommand,
			  removeTagCommand,
			  filterByTagCommand,
			  clearTagsCommand
		  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
