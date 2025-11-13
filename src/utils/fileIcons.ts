import * as vscode from 'vscode';

/**
 * Get the appropriate VS Code theme icon for a file based on its extension
 * @param filename The name of the file
 * @returns A VS Code ThemeIcon representing the file type
 */
export function getFileIcon(filename: string): vscode.ThemeIcon {
	const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

	// JSON and data formats
	if (ext === '.json') {return new vscode.ThemeIcon('json');}
	if (ext === '.yaml' || ext === '.yml') {return new vscode.ThemeIcon('json');}
	if (ext === '.xml') {return new vscode.ThemeIcon('json');}
	if (ext === '.toml') {return new vscode.ThemeIcon('json');}
	if (ext === '.csv') {return new vscode.ThemeIcon('json');}

	// Markdown and docs
	if (ext === '.md' || ext === '.markdown') {return new vscode.ThemeIcon('markdown');}
	if (ext === '.txt') {return new vscode.ThemeIcon('file');}
	if (ext === '.rst') {return new vscode.ThemeIcon('file-text');}

	// Programming languages
	if (ext === '.js' || ext === '.jsx') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.ts' || ext === '.tsx') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.py') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.go') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.rs') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.java' || ext === '.class') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.cpp' || ext === '.c' || ext === '.h' || ext === '.hpp') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.cs') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.php') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.rb') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.swift') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.kt') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.scala' ) {return new vscode.ThemeIcon('file-code');}
	if (ext === '.sh' || ext === '.bash' || ext === '.zsh') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.ps1') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.lua') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.r') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.pl' || ext === '.pm') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.groovy' || ext === '.gradle') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.sql') {return new vscode.ThemeIcon('database');}

	// Web - HTML, CSS, etc.
	if (ext === '.html' || ext === '.htm') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.css' || ext === '.scss' || ext === '.less' || ext === '.sass') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.vue' || ext === '.svelte') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.jsx' || ext === '.tsx') {return new vscode.ThemeIcon('file-code');}

	// Config files
	if (ext === '.env') {return new vscode.ThemeIcon('settings');}
	if (ext === '.config' || ext === '.conf') {return new vscode.ThemeIcon('settings');}
	if (ext === '.ini') {return new vscode.ThemeIcon('settings');}
	if (ext === '.properties') {return new vscode.ThemeIcon('settings');}

	// Docker and infrastructure
	if (filename === 'dockerfile') {return new vscode.ThemeIcon('file-code');}
	if (filename === 'dockerfile.dev') {return new vscode.ThemeIcon('file-code');}
	if (filename === '.dockerignore') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.tf' || ext === '.hcl') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.yml' || ext === '.yaml') {return new vscode.ThemeIcon('file-code');}
	if (ext === '.nix') {return new vscode.ThemeIcon('file-code');}

	// Archives
	if (ext === '.zip' || ext === '.tar' || ext === '.gz' || ext === '.rar' || ext === '.7z') {return new vscode.ThemeIcon('file-zip');}

	// Images
	if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.svg' || ext === '.webp' || ext === '.ico') {return new vscode.ThemeIcon('file-media');}

	// Default file icon
	return vscode.ThemeIcon.File;
}
