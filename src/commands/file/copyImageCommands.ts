import * as vscode from 'vscode';
import { GistItem } from '../../providers/gistItem';
import * as path from 'path';

export function registerCopyImageCommands(context: vscode.ExtensionContext) {
	// Copy raw image URL
	const copyImageUrlCommand = vscode.commands.registerCommand('gist-editor.copyImageUrl', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No image file selected');
			return;
		}

		const file = gistItem.file;
		const ext = path.extname(file.filename).toLowerCase();
		const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

		if (!imageExtensions.includes(ext)) {
			vscode.window.showWarningMessage('Selected file is not an image');
			return;
		}

		if (!file.raw_url) {
			vscode.window.showErrorMessage('Image URL not available');
			return;
		}

		await vscode.env.clipboard.writeText(file.raw_url);
		vscode.window.showInformationMessage(`✓ Copied URL: ${file.raw_url}`);
	});

	// Copy markdown image syntax
	const copyMarkdownImageCommand = vscode.commands.registerCommand('gist-editor.copyMarkdownImage', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No image file selected');
			return;
		}

		const file = gistItem.file;
		const ext = path.extname(file.filename).toLowerCase();
		const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

		if (!imageExtensions.includes(ext)) {
			vscode.window.showWarningMessage('Selected file is not an image');
			return;
		}

		if (!file.raw_url) {
			vscode.window.showErrorMessage('Image URL not available');
			return;
		}

		// Get alt text from user (optional)
		const altText = await vscode.window.showInputBox({
			prompt: 'Enter alt text (description) for the image (optional)',
			placeHolder: 'e.g., Screenshot of the application',
			value: path.basename(file.filename, ext)
		});

		if (altText === undefined) {
			return; // User cancelled
		}

		const markdown = `![${altText || file.filename}](${file.raw_url})`;
		await vscode.env.clipboard.writeText(markdown);
		vscode.window.showInformationMessage(`✓ Copied Markdown: ${markdown}`);
	});

	// Copy HTML image tag
	const copyHtmlImageCommand = vscode.commands.registerCommand('gist-editor.copyHtmlImage', async (gistItem: GistItem) => {
		if (!gistItem || !gistItem.file || !gistItem.gist) {
			vscode.window.showErrorMessage('No image file selected');
			return;
		}

		const file = gistItem.file;
		const ext = path.extname(file.filename).toLowerCase();
		const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

		if (!imageExtensions.includes(ext)) {
			vscode.window.showWarningMessage('Selected file is not an image');
			return;
		}

		if (!file.raw_url) {
			vscode.window.showErrorMessage('Image URL not available');
			return;
		}

		// Get alt text from user (optional)
		const altText = await vscode.window.showInputBox({
			prompt: 'Enter alt text (description) for the image (optional)',
			placeHolder: 'e.g., Screenshot of the application',
			value: path.basename(file.filename, ext)
		});

		if (altText === undefined) {
			return; // User cancelled
		}

		// Ask for width constraint (optional)
		const width = await vscode.window.showInputBox({
			prompt: 'Enter width constraint (optional, e.g., 300, 50%)',
			placeHolder: 'Leave empty for original size',
			validateInput: (value) => {
				if (!value) {
					return null; // Empty is valid
				}
				// Allow pixels (e.g., 300) or percentages (e.g., 50%)
				if (/^\d+$/.test(value) || /^\d+%$/.test(value)) {
					return null;
				}
				return 'Enter a number (e.g., 300) or percentage (e.g., 50%)';
			}
		});

		if (width === undefined) {
			return; // User cancelled
		}

		let html = `<img src="${file.raw_url}" alt="${altText || file.filename}"`;
		if (width) {
			html += ` width="${width}"`;
		}
		html += ` />`;

		await vscode.env.clipboard.writeText(html);
		vscode.window.showInformationMessage(`✓ Copied HTML: ${html}`);
	});

	context.subscriptions.push(copyImageUrlCommand);
	context.subscriptions.push(copyMarkdownImageCommand);
	context.subscriptions.push(copyHtmlImageCommand);
}
