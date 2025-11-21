import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GistGitService } from '../../services/gistGitService';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { GistFileSystemProvider } from '../../providers/gistFileSystem';
import { GitHubService } from '../../githubService';

export function registerPasteFileCommand(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	gistGitService: GistGitService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider,
	gistFileSystemProvider: GistFileSystemProvider,
	getSelectedGist: () => GistItem | undefined
) {
	// Paste file from clipboard command
	const pasteFileCommand = vscode.commands.registerCommand('gist-editor.pasteFileToGist', async (gistItem?: GistItem) => {
		// If no gist item provided, try to get from current selection
		let targetGist = gistItem?.gist;
		let selectedItem = gistItem;

		if (!selectedItem) {
			// Try to get the currently selected item from tree view
			selectedItem = getSelectedGist();
		}

		if (selectedItem) {
			// Check if it's a folder - let user pick a gist from the folder
			if (selectedItem.contextValue === 'gistFolder' && selectedItem.folder) {
				// Get gists in this folder from the provider
				const folderChildren = await myGistsProvider.getChildren(selectedItem);
				const gistsInFolder = folderChildren.filter((child: GistItem) => child.gist && child.contextValue === 'gist');

				if (gistsInFolder.length === 0) {
					vscode.window.showErrorMessage('No gists in this folder. Please select a gist directly.');
					return;
				} else if (gistsInFolder.length === 1) {
					// Only one gist, use it directly
					targetGist = gistsInFolder[0].gist;
				} else {
					// Multiple gists, let user pick
					const picked = await vscode.window.showQuickPick(
						gistsInFolder.map((g: GistItem) => ({
							label: g.gist!.description || 'Untitled',
							description: `${Object.keys(g.gist!.files).length} files`,
							gist: g.gist
						})),
						{ placeHolder: 'Select a gist to paste the image to' }
					);
					if (!picked) {
						return; // User cancelled
					}
					targetGist = picked.gist;
				}
			} else if (selectedItem.gist) {
				targetGist = selectedItem.gist;
			}
		}

		if (!targetGist) {
			vscode.window.showErrorMessage('Please select a gist or folder first, then press Ctrl+V to paste a file.');
			return;
		}

		try {
			// First, try to get file path from clipboard (when user copies a file in Explorer)
			const clipboardFilePath = await getClipboardFilePath();

			let filePath: string | null = null;
			let needsCleanup = false;
			let defaultFilename: string;
			let isBinaryFile = false;

			if (clipboardFilePath) {
				// User copied a file from Explorer
				filePath = clipboardFilePath;
				defaultFilename = path.basename(clipboardFilePath);
				isBinaryFile = isImageFile(clipboardFilePath) || isBinary(clipboardFilePath);
				console.log(`[Paste] Using clipboard file path: ${filePath}, binary: ${isBinaryFile}`);
			} else {
				// Try to get image data from clipboard (screenshot, copied image)
				filePath = await saveClipboardImageToTemp();
				if (filePath) {
					needsCleanup = true;
					isBinaryFile = true;
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
					defaultFilename = `clipboard-${timestamp}.png`;
				} else {
					vscode.window.showWarningMessage(
						'No file found in clipboard. Try copying a file or taking a screenshot first.'
					);
					return;
				}
			}

			if (!filePath) {
				vscode.window.showWarningMessage(
					'No file found in clipboard. Try copying a file or taking a screenshot first.'
				);
				return;
			}

			const filename = await vscode.window.showInputBox({
				prompt: 'Enter filename for the pasted file',
				value: defaultFilename,
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return 'Filename cannot be empty';
					}
					if (targetGist!.files[value]) {
						return 'A file with this name already exists in the gist';
					}
					return null;
				}
			});

			if (!filename) {
				// Clean up temp file if needed
				if (needsCleanup && filePath) {
					await cleanupTempFile(filePath);
				}
				return; // User cancelled
			}

			// Upload the file
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Pasting "${filename}" to gist...`,
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0 });

				if (isBinaryFile) {
					// Use Git service for binary files (images, etc.)
					await gistGitService.addImageToGist(targetGist!.id, filePath!, filename);
				} else {
					// Use GitHub API for text files
					const content = await fs.promises.readFile(filePath!, 'utf-8');
					const files: { [filename: string]: { content: string } } = {};
					files[filename] = { content };
					await githubService.updateGist(targetGist!.id, undefined, files);
				}

				progress.report({ increment: 100 });
			});

			// Clean up temp file if needed
			if (needsCleanup && filePath) {
				await cleanupTempFile(filePath);
			}

			// Invalidate cache and refresh
			gistFileSystemProvider.invalidateCache(targetGist.id);
			myGistsProvider.refresh();
			starredGistsProvider.refresh();

			vscode.window.showInformationMessage(`✓ Pasted "${filename}" to gist`);

		} catch (error: any) {
			console.error('Error pasting file to gist:', error);
			vscode.window.showErrorMessage(`Failed to paste file: ${error.message}`);
		}
	});

	context.subscriptions.push(pasteFileCommand);
}

/**
 * Check if a file path is an image file
 */
function isImageFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg'].includes(ext);
}

/**
 * Check if a file is binary based on extension
 */
function isBinary(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	const binaryExtensions = [
		// Images
		'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg', '.tiff', '.tif',
		// Documents
		'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
		// Archives
		'.zip', '.tar', '.gz', '.rar', '.7z',
		// Media
		'.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
		// Executables
		'.exe', '.dll', '.so', '.dylib',
		// Fonts
		'.ttf', '.otf', '.woff', '.woff2', '.eot',
		// Other
		'.bin', '.dat', '.db', '.sqlite'
	];
	return binaryExtensions.includes(ext);
}

/**
 * Convert Windows path to WSL path if needed
 */
function convertToWSLPath(filePath: string): string {
	if (!isWSL()) {
		return filePath;
	}
	// Check if it's a Windows path (e.g., C:\Users\...)
	const windowsPathMatch = filePath.match(/^([a-zA-Z]):[\/\\](.*)$/);
	if (windowsPathMatch) {
		const driveLetter = windowsPathMatch[1].toLowerCase();
		const pathPart = windowsPathMatch[2].replace(/\\/g, '/');
		return `/mnt/${driveLetter}/${pathPart}`;
	}
	return filePath;
}

/**
 * Get file path from clipboard (when user copies a file in Explorer)
 * Returns the file path or null if no file in clipboard
 */
async function getClipboardFilePath(): Promise<string | null> {
	try {
		if (process.platform === 'win32' || isWSL()) {
			return await getClipboardFilePathWindows();
		} else if (process.platform === 'darwin') {
			return await getClipboardFilePathMacOS();
		} else {
			return await getClipboardFilePathLinux();
		}
	} catch (error) {
		console.error('Error getting clipboard file path:', error);
		return null;
	}
}

/**
 * Get clipboard file path on Windows/WSL using PowerShell
 */
async function getClipboardFilePathWindows(): Promise<string | null> {
	const { execFile } = require('child_process');
	const util = require('util');
	const execFilePromise = util.promisify(execFile);

	const powershell = isWSL() ? 'powershell.exe' : 'powershell';

	// PowerShell script to get file path from clipboard
	const psScript = `
$files = Get-Clipboard -Format FileDropList
if ($files -and $files.Count -gt 0) {
    Write-Output $files[0].FullName
} else {
    Write-Output ''
}
`;

	try {
		const { stdout } = await execFilePromise(powershell, ['-NoProfile', '-Command', psScript]);
		const filePath = stdout.trim();

		if (filePath && fs.existsSync(convertToWSLPath(filePath))) {
			return convertToWSLPath(filePath);
		}
		return null;
	} catch (error) {
		console.error('PowerShell clipboard file error:', error);
		return null;
	}
}

/**
 * Get clipboard file path on macOS
 */
async function getClipboardFilePathMacOS(): Promise<string | null> {
	const { exec } = require('child_process');
	const util = require('util');
	const execPromise = util.promisify(exec);

	try {
		// Use osascript to get file path from clipboard
		const { stdout } = await execPromise(`osascript -e 'POSIX path of (the clipboard as «class furl»)'`);
		const filePath = stdout.trim();

		if (filePath && fs.existsSync(filePath)) {
			return filePath;
		}
		return null;
	} catch (error) {
		// No file in clipboard
		return null;
	}
}

/**
 * Get clipboard file path on Linux
 */
async function getClipboardFilePathLinux(): Promise<string | null> {
	const { exec } = require('child_process');
	const util = require('util');
	const execPromise = util.promisify(exec);

	try {
		// Try xclip to get file URI
		const { stdout } = await execPromise('xclip -selection clipboard -t text/uri-list -o 2>/dev/null');
		const uri = stdout.trim();

		if (uri.startsWith('file://')) {
			const filePath = decodeURIComponent(uri.replace('file://', ''));
			if (fs.existsSync(filePath)) {
				return filePath;
			}
		}
		return null;
	} catch (error) {
		return null;
	}
}

/**
 * Save clipboard image to a temporary file
 * Returns the path to the temp file, or null if no image in clipboard
 */
async function saveClipboardImageToTemp(): Promise<string | null> {
	const tempDir = os.tmpdir();
	const tempFilename = `gist-clipboard-${Date.now()}.png`;
	const tempFilePath = path.join(tempDir, tempFilename);

	try {
		// Platform-specific clipboard image extraction
		if (process.platform === 'win32' || isWSL()) {
			// Use PowerShell on Windows/WSL to get clipboard image
			return await saveClipboardImageWindows(tempFilePath);
		} else if (process.platform === 'darwin') {
			// Use pngpaste or pbpaste on macOS
			return await saveClipboardImageMacOS(tempFilePath);
		} else {
			// Use xclip on Linux
			return await saveClipboardImageLinux(tempFilePath);
		}
	} catch (error) {
		console.error('Error saving clipboard image:', error);
		return null;
	}
}

/**
 * Check if running in WSL
 */
function isWSL(): boolean {
	return process.platform === 'linux' && (
		process.env.WSL_DISTRO_NAME !== undefined ||
		process.env.WSL_INTEROP !== undefined ||
		os.release().toLowerCase().includes('microsoft')
	);
}

/**
 * Save clipboard image on Windows/WSL using PowerShell
 */
async function saveClipboardImageWindows(tempFilePath: string): Promise<string | null> {
	const { execFile } = require('child_process');
	const util = require('util');
	const execFilePromise = util.promisify(execFile);

	// For WSL, we need to use powershell.exe to access Windows clipboard
	const powershell = isWSL() ? 'powershell.exe' : 'powershell';

	// Convert WSL path to Windows path if needed
	let windowsPath = tempFilePath;
	if (isWSL()) {
		// Convert /mnt/c/... to C:\... or use wslpath
		try {
			const { exec } = require('child_process');
			const execPromise = util.promisify(exec);
			const { stdout } = await execPromise(`wslpath -w "${tempFilePath}"`);
			windowsPath = stdout.trim();
		} catch (error) {
			// Fallback: manual conversion
			const match = tempFilePath.match(/^\/mnt\/([a-z])\/(.*)$/);
			if (match) {
				windowsPath = `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`;
			}
		}
	}

	// PowerShell script to save clipboard image - escape path for PowerShell
	const escapedPath = windowsPath.replace(/'/g, "''");
	const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img -ne $null) {
    $img.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output 'SUCCESS'
} else {
    Write-Output 'NO_IMAGE'
}
`;

	try {
		const { stdout } = await execFilePromise(powershell, ['-NoProfile', '-Command', psScript]);

		if (stdout.includes('SUCCESS')) {
			// For WSL, the file is saved to Windows path, need to verify it exists in WSL
			if (isWSL()) {
				// Wait a moment for file to be written
				await new Promise(resolve => setTimeout(resolve, 100));
				if (fs.existsSync(tempFilePath)) {
					return tempFilePath;
				}
				// File might be at Windows path, return that
				return windowsPath;
			}
			return windowsPath;
		}
		return null;
	} catch (error) {
		console.error('PowerShell clipboard error:', error);
		return null;
	}
}

/**
 * Save clipboard image on macOS using pngpaste or screencapture
 */
async function saveClipboardImageMacOS(tempFilePath: string): Promise<string | null> {
	const { exec } = require('child_process');
	const util = require('util');
	const execPromise = util.promisify(exec);

	try {
		// Try pngpaste first (if installed via homebrew)
		await execPromise(`pngpaste "${tempFilePath}"`);

		// Check if file was created
		if (fs.existsSync(tempFilePath)) {
			return tempFilePath;
		}
	} catch (error) {
		// pngpaste not available or no image in clipboard
		console.log('pngpaste failed, trying osascript...');
	}

	try {
		// Fallback: use osascript to check clipboard and save
		const checkScript = `osascript -e 'clipboard info'`;
		const { stdout } = await execPromise(checkScript);

		if (stdout.includes('«class PNGf»') || stdout.includes('TIFF')) {
			// There's an image in clipboard, use screencapture to get it
			// Note: This approach has limitations
			const saveScript = `
				osascript -e '
					set theFile to POSIX file "${tempFilePath}"
					try
						set imgData to the clipboard as «class PNGf»
						set fileRef to open for access theFile with write permission
						write imgData to fileRef
						close access fileRef
						return "SUCCESS"
					on error
						return "FAILED"
					end try
				'
			`;
			const { stdout: result } = await execPromise(saveScript);

			if (result.includes('SUCCESS') && fs.existsSync(tempFilePath)) {
				return tempFilePath;
			}
		}
	} catch (error) {
		console.error('macOS clipboard error:', error);
	}

	return null;
}

/**
 * Save clipboard image on Linux using xclip
 */
async function saveClipboardImageLinux(tempFilePath: string): Promise<string | null> {
	const { exec } = require('child_process');
	const util = require('util');
	const execPromise = util.promisify(exec);

	try {
		// Use xclip to get clipboard image
		await execPromise(`xclip -selection clipboard -t image/png -o > "${tempFilePath}"`);

		// Check if file was created and has content
		if (fs.existsSync(tempFilePath)) {
			const stats = fs.statSync(tempFilePath);
			if (stats.size > 0) {
				return tempFilePath;
			}
		}
	} catch (error) {
		console.error('xclip error:', error);
	}

	return null;
}

/**
 * Clean up temporary file
 */
async function cleanupTempFile(filePath: string): Promise<void> {
	try {
		if (fs.existsSync(filePath)) {
			await fs.promises.unlink(filePath);
		}
	} catch (error) {
		console.error('Error cleaning up temp file:', error);
	}
}
