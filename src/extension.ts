// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitHubService, Gist } from './githubService';

// Content provider for gist files
class GistContentProvider implements vscode.TextDocumentContentProvider {
	private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	public readonly onDidChange = this._onDidChange.event;

	private gistCache = new Map<string, Gist>();

	constructor(private githubService: GitHubService) {}

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const [gistId, filename] = uri.path.substring(1).split('/');
		console.log(`Content provider: Loading ${filename} from gist ${gistId}`);
		
		try {
			// Try to get from cache first
			let gist = this.gistCache.get(gistId);
			if (!gist) {
				console.log(`Fetching gist ${gistId} from API...`);
				gist = await this.githubService.getGist(gistId);
				this.gistCache.set(gistId, gist);
			} else {
				console.log(`Using cached gist ${gistId}`);
			}

			const file = gist.files[filename];
			if (!file) {
				console.error(`File ${filename} not found in gist. Available files:`, Object.keys(gist.files));
				throw new Error(`File ${filename} not found in gist`);
			}

			console.log(`Successfully loaded content for ${filename} (${file.content?.length || 0} characters)`);
			return file.content || '';
		} catch (error) {
			console.error('Error loading gist content:', error);
			return `Error loading gist content: ${error}`;
		}
	}

	public invalidateCache(gistId: string) {
		this.gistCache.delete(gistId);
		// Trigger refresh for all gist URIs
		this._onDidChange.fire(vscode.Uri.parse(`gist:/${gistId}`));
	}
}

// Gist item for the tree view
class GistItem extends vscode.TreeItem {
	constructor(
		public readonly gist: Gist,
		public readonly file?: any,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
	) {
		// If this is a file item, show the filename
		if (file) {
			super(file.filename, vscode.TreeItemCollapsibleState.None);
			this.tooltip = `${file.filename}\nLanguage: ${file.language}\nSize: ${file.size} bytes`;
			this.contextValue = 'gistFile';
			this.iconPath = vscode.ThemeIcon.File;
			this.command = {
				command: 'gist-editor.openGistFile',
				title: 'Open File',
				arguments: [gist, file]
			};
			this.description = `${file.language} • ${file.size} bytes`;
		} else {
			// This is a gist container
			super(gist.description || '(No description)', collapsibleState);
			this.tooltip = `${gist.description}\nCreated: ${new Date(gist.created_at).toLocaleDateString()}\nFiles: ${Object.keys(gist.files).length}`;
			this.contextValue = 'gist';
			this.iconPath = gist.public ? new vscode.ThemeIcon('globe') : new vscode.ThemeIcon('lock');
			
			// Show file count and visibility
			const fileCount = Object.keys(gist.files).length;
			const visibility = gist.public ? 'Public' : 'Private';
			this.description = `${fileCount} file${fileCount !== 1 ? 's' : ''} • ${visibility}`;
		}
	}
}

// Tree data provider for gists
class GistProvider implements vscode.TreeDataProvider<GistItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<GistItem | undefined | null | void> = new vscode.EventEmitter<GistItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<GistItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private gistType: 'my' | 'starred', private githubService: GitHubService) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: GistItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: GistItem): Promise<GistItem[]> {
		if (!element) {
			console.log(`Loading ${this.gistType} gists...`);
			try {
				if (!this.githubService.isAuthenticated()) {
					console.log('Not authenticated, showing setup item');
					return [this.createNotAuthenticatedItem()];
				}

				let gists: Gist[];
				if (this.gistType === 'my') {
					console.log('Fetching my gists...');
					gists = await this.githubService.getMyGists();
				} else {
					console.log('Fetching starred gists...');
					gists = await this.githubService.getStarredGists();
				}

				console.log(`Found ${gists.length} ${this.gistType} gists`);
				// Show gists as expandable if they have multiple files, otherwise collapsed
				return gists.map(gist => {
					const fileCount = Object.keys(gist.files).length;
					const collapsibleState = fileCount > 1 ? 
						vscode.TreeItemCollapsibleState.Collapsed : 
						vscode.TreeItemCollapsibleState.None;
					return new GistItem(gist, undefined, collapsibleState);
				});
			} catch (error) {
				console.error(`Error loading ${this.gistType} gists:`, error);
				vscode.window.showErrorMessage(`Failed to load ${this.gistType} gists: ${error}`);
				return [this.createErrorItem(error instanceof Error ? error.message : 'Unknown error')];
			}
		} else if (element.contextValue === 'gist') {
			// Show files for expanded gist
			const files = Object.values(element.gist.files);
			return files.map(file => new GistItem(element.gist, file));
		}
		return [];
	}

	private createNotAuthenticatedItem(): GistItem {
		const mockGist: Gist = {
			id: 'not-authenticated',
			description: 'Click to set up GitHub token',
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None);
		item.command = {
			command: 'gist-editor.setupToken',
			title: 'Setup GitHub Token'
		};
		item.iconPath = new vscode.ThemeIcon('key');
		return item;
	}

	private createErrorItem(message: string): GistItem {
		const mockGist: Gist = {
			id: 'error',
			description: `Error: ${message}`,
			public: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: '',
			files: {}
		};
		const item = new GistItem(mockGist, undefined, vscode.TreeItemCollapsibleState.None);
		item.iconPath = new vscode.ThemeIcon('error');
		return item;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gist-editor" is now active!');

	// Create GitHub service
	const githubService = new GitHubService();

	// Create gist content provider
	const gistContentProvider = new GistContentProvider(githubService);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider('gist', gistContentProvider)
	);

	// Create tree data providers
	const myGistsProvider = new GistProvider('my', githubService);
	const starredGistsProvider = new GistProvider('starred', githubService);

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

	const createGistCommand = vscode.commands.registerCommand('gist-editor.createGist', async () => {
		if (!githubService.isAuthenticated()) {
			const setup = await vscode.window.showErrorMessage(
				'GitHub token not configured. Please set up your token first.',
				'Setup Token'
			);
			if (setup === 'Setup Token') {
				vscode.commands.executeCommand('gist-editor.setupToken');
			}
			return;
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

			// Get gist description
			const description = await vscode.window.showInputBox({
				prompt: 'Enter a description for your gist',
				value: defaultDescription,
				placeHolder: 'Gist description (optional)',
				ignoreFocusOut: true
			});

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
			vscode.window.withProgress({
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
			const uri = vscode.Uri.parse(`gist:/${gist.id}/${file.filename}`);

			// Open the document
			console.log(`Opening gist file: ${file.filename} (${file.language || 'unknown language'})`);
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
		} catch (error) {
			console.error('Error opening gist file:', error);
			vscode.window.showErrorMessage(`Failed to open file: ${error}`);
		}
	}

	function getLanguageId(githubLanguage: string): string {
		const languageMap: { [key: string]: string } = {
			'JavaScript': 'javascript',
			'TypeScript': 'typescript',
			'Python': 'python',
			'Java': 'java',
			'C++': 'cpp',
			'C': 'c',
			'C#': 'csharp',
			'HTML': 'html',
			'CSS': 'css',
			'JSON': 'json',
			'Markdown': 'markdown',
			'Shell': 'shellscript',
			'PowerShell': 'powershell',
			'SQL': 'sql',
			'XML': 'xml',
			'YAML': 'yaml',
			'PHP': 'php',
			'Ruby': 'ruby',
			'Go': 'go',
			'Rust': 'rust',
			'Swift': 'swift',
			'Kotlin': 'kotlin',
			'Dart': 'dart',
			'Text': 'plaintext',
			'R': 'r',
			'Scala': 'scala',
			'Perl': 'perl',
			'Lua': 'lua',
			'Haskell': 'haskell',
			'Clojure': 'clojure',
			'F#': 'fsharp',
			'Visual Basic': 'vb',
			'SCSS': 'scss',
			'Sass': 'sass',
			'Less': 'less',
			'Stylus': 'stylus',
			'Vue': 'vue',
			'React': 'jsx',
			'JSX': 'jsx',
			'TSX': 'tsx',
			'Dockerfile': 'dockerfile',
			'Makefile': 'makefile',
			'Bash': 'shellscript',
			'Zsh': 'shellscript',
			'Fish': 'fish',
			'Batch': 'bat',
			'Assembly': 'asm',
			'TOML': 'toml',
			'INI': 'ini',
			'Properties': 'properties',
			'LaTeX': 'latex',
			'Objective-C': 'objective-c',
			'Objective-C++': 'objective-cpp'
		};
		return languageMap[githubLanguage] || 'plaintext';
	}

	function getLanguageFromExtension(filename: string): string {
		const extension = filename.split('.').pop()?.toLowerCase() || '';
		
		const extensionMap: { [key: string]: string } = {
			// JavaScript family
			'js': 'javascript',
			'jsx': 'jsx',
			'ts': 'typescript',
			'tsx': 'tsx',
			'mjs': 'javascript',
			'cjs': 'javascript',
			
			// Python
			'py': 'python',
			'pyw': 'python',
			'pyx': 'python',
			'pyi': 'python',
			
			// Web technologies
			'html': 'html',
			'htm': 'html',
			'xhtml': 'html',
			'css': 'css',
			'scss': 'scss',
			'sass': 'sass',
			'less': 'less',
			'styl': 'stylus',
			
			// Data formats
			'json': 'json',
			'jsonc': 'jsonc',
			'json5': 'json5',
			'xml': 'xml',
			'yaml': 'yaml',
			'yml': 'yaml',
			'toml': 'toml',
			'ini': 'ini',
			'properties': 'properties',
			'cfg': 'ini',
			'conf': 'properties',
			
			// Documentation
			'md': 'markdown',
			'markdown': 'markdown',
			'mdown': 'markdown',
			'mkd': 'markdown',
			'tex': 'latex',
			'latex': 'latex',
			'rst': 'restructuredtext',
			'adoc': 'asciidoc',
			'org': 'org',
			
			// Programming languages
			'java': 'java',
			'kt': 'kotlin',
			'kts': 'kotlin',
			'scala': 'scala',
			'sc': 'scala',
			'groovy': 'groovy',
			'gradle': 'gradle',
			
			// C family
			'c': 'c',
			'h': 'c',
			'cpp': 'cpp',
			'cxx': 'cpp',
			'cc': 'cpp',
			'hpp': 'cpp',
			'hxx': 'cpp',
			'hh': 'cpp',
			'cs': 'csharp',
			'fs': 'fsharp',
			'fsx': 'fsharp',
			'fsi': 'fsharp',
			
			// Mobile
			'swift': 'swift',
			'dart': 'dart',
			'm': 'objective-c',
			'mm': 'objective-cpp',
			
			// Functional languages
			'hs': 'haskell',
			'lhs': 'literate-haskell',
			'elm': 'elm',
			'clj': 'clojure',
			'cljs': 'clojure',
			'cljc': 'clojure',
			'ml': 'ocaml',
			'mli': 'ocaml',
			'f90': 'fortran-modern',
			'f95': 'fortran-modern',
			
			// Scripting languages
			'rb': 'ruby',
			'rbx': 'ruby',
			'rjs': 'ruby',
			'gemspec': 'ruby',
			'rake': 'ruby',
			'php': 'php',
			'php3': 'php',
			'php4': 'php',
			'php5': 'php',
			'phtml': 'php',
			'pl': 'perl',
			'pm': 'perl',
			'pod': 'perl',
			't': 'perl',
			'lua': 'lua',
			'r': 'r',
			'R': 'r',
			'rmd': 'rmd',
			
			// Systems languages
			'go': 'go',
			'rs': 'rust',
			'zig': 'zig',
			'nim': 'nim',
			'cr': 'crystal',
			'd': 'd',
			
			// Shell scripts
			'sh': 'shellscript',
			'bash': 'shellscript',
			'zsh': 'shellscript',
			'fish': 'fish',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'psd1': 'powershell',
			'bat': 'bat',
			'cmd': 'bat',
			
			// SQL
			'sql': 'sql',
			'mysql': 'sql',
			'pgsql': 'sql',
			'plsql': 'plsql',
			
			// Assembly
			'asm': 'asm',
			's': 'asm',
			'S': 'asm',
			'nasm': 'nasm',
			
			// Docker & Infrastructure
			'dockerfile': 'dockerfile',
			'containerfile': 'dockerfile',
			'makefile': 'makefile',
			'mk': 'makefile',
			'cmake': 'cmake',
			'tf': 'terraform',
			'hcl': 'hcl',
			
			// Frontend frameworks
			'vue': 'vue',
			'svelte': 'svelte',
			'astro': 'astro',
			
			// Other common formats
			'txt': 'plaintext',
			'text': 'plaintext',
			'log': 'log',
			'csv': 'csv',
			'tsv': 'tsv',
			'svg': 'xml',
			'graphql': 'graphql',
			'gql': 'graphql',
			'proto': 'protobuf',
			'thrift': 'thrift'
		};
		
		return extensionMap[extension] || 'plaintext';
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
			prompt: 'Enter content for your gist (required)',
			value: defaultContent,
			placeHolder: 'Gist content is required by GitHub...',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Content cannot be empty - GitHub requires gist content';
				}
				return null;
			}
		});

		if (!content) {
			return {};
		}

		return {
			[fileName]: { content }
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
		if (!githubService.isAuthenticated()) {
			const setup = await vscode.window.showErrorMessage(
				'GitHub token not configured. Please set up your token first.',
				'Setup Token'
			);
			if (setup === 'Setup Token') {
				vscode.commands.executeCommand('gist-editor.setupToken');
			}
			return;
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
		if (!githubService.isAuthenticated()) {
			const setup = await vscode.window.showErrorMessage(
				'GitHub token not configured. Please set up your token first.',
				'Setup Token'
			);
			if (setup === 'Setup Token') {
				vscode.commands.executeCommand('gist-editor.setupToken');
			}
			return;
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

		// Get gist description
		const description = await vscode.window.showInputBox({
			prompt: 'Enter a description for your gist',
			value: defaultDescription,
			placeHolder: 'Gist description (optional)',
			ignoreFocusOut: true
		});

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
				label: isAuthenticated ? '$(key) Change GitHub Token' : '$(key) Set GitHub Token',
				description: isAuthenticated ? 'Update your current GitHub token' : 'Configure GitHub token to access your gists'
			},
			{
				label: '$(info) How to create a token',
				description: 'Open GitHub token creation guide'
			},
			...(isAuthenticated ? [{
				label: '$(trash) Remove Token',
				description: 'Remove the current GitHub token'
			}] : [])
		], {
			placeHolder: `Token Status: ${tokenStatus}`,
			ignoreFocusOut: true
		});

		if (!action) {
			return;
		}

		if (action.label.includes('How to create')) {
			// Open GitHub token creation page
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens/new?description=VSCode%20Gist%20Editor&scopes=gist'));
			return;
		}

		if (action.label.includes('Remove Token')) {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to remove the GitHub token?',
				{ modal: true },
				'Remove',
				'Cancel'
			);
			
			if (confirm === 'Remove') {
				try {
					await githubService.removeToken();
					vscode.window.showInformationMessage('GitHub token removed successfully!');
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to remove token: ${error}`);
				}
			}
			return;
		}

		// Show input for token
		const token = await vscode.window.showInputBox({
			prompt: isAuthenticated ? 'Enter new GitHub Personal Access Token' : 'Enter your GitHub Personal Access Token',
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
					isAuthenticated ? 'GitHub token updated successfully!' : 'GitHub token configured successfully!',
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
			
			const gists = await githubService.getMyGists();
			vscode.window.showInformationMessage(`Found ${gists.length} gists!`);
			console.log('Gists:', gists);
		} catch (error) {
			console.error('API test error:', error);
			vscode.window.showErrorMessage(`API test failed: ${error}`);
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

		const [gistId, filename] = document.uri.path.substring(1).split('/');
		const content = document.getText();

		try {
			await githubService.updateGist(gistId, undefined, {
				[filename]: { content }
			});

			// Clear cache and refresh
			gistContentProvider.invalidateCache(gistId);
			myGistsProvider.refresh();
			
			vscode.window.showInformationMessage(`Saved ${filename} to gist successfully!`);
		} catch (error) {
			console.error('Error saving gist:', error);
			vscode.window.showErrorMessage(`Failed to save gist: ${error}`);
		}
	});

	// Listen for document saves to auto-save gists
	const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
		if (document.uri.scheme === 'gist') {
			// Auto-save gist when user presses Ctrl+S
			const [gistId, filename] = document.uri.path.substring(1).split('/');
			const content = document.getText();

			try {
				await githubService.updateGist(gistId, undefined, {
					[filename]: { content }
				});

				// Clear cache and refresh
				gistContentProvider.invalidateCache(gistId);
				myGistsProvider.refresh();
				
				vscode.window.setStatusBarMessage(`✓ Saved ${filename} to gist`, 3000);
			} catch (error) {
				console.error('Error auto-saving gist:', error);
				vscode.window.showErrorMessage(`Failed to save gist: ${error}`);
			}
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
		saveGistCommand,
		saveListener
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
