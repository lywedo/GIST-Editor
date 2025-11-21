import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit, { SimpleGit } from 'simple-git';
import { GitHubService } from '../githubService';

/**
 * Service for handling Git operations on gists to support binary file uploads
 * (e.g., images) which cannot be uploaded via the GitHub REST API.
 */
export class GistGitService {
	private tempDirs: Set<string> = new Set();

	constructor(private githubService: GitHubService) {}

	/**
	 * Add an image file to a gist using Git operations
	 */
	async addImageToGist(gistId: string, imagePath: string, filename?: string): Promise<void> {
		let repoPath: string | undefined;

		try {
			// Normalize the image path for the current platform
			const normalizedImagePath = path.normalize(imagePath);
			console.log(`[GistGitService] Adding image to gist: ${normalizedImagePath}`);

			// Get current username for Git URL
			const username = await this.githubService.getCurrentUsername();

			// Validate image file
			await this.validateImageFile(normalizedImagePath);

			// Clone the gist repository
			vscode.window.showInformationMessage('Cloning gist repository...');
			repoPath = await this.cloneGist(gistId, username);

			// Determine filename
			const finalFilename = filename || path.basename(normalizedImagePath);

			// Copy image to repository
			const destPath = path.join(repoPath, finalFilename);
			console.log(`[GistGitService] Copying from ${normalizedImagePath} to ${destPath}`);
			await fs.promises.copyFile(normalizedImagePath, destPath);

			// Commit and push
			vscode.window.showInformationMessage('Uploading image...');
			await this.commitAndPush(repoPath, finalFilename);

			vscode.window.showInformationMessage(`✓ Added image "${finalFilename}" to gist`);
		} catch (error: any) {
			console.error('Error adding image to gist:', error);
			throw new Error(`Failed to add image to gist: ${error.message}`);
		} finally {
			// Clean up temporary directory
			if (repoPath) {
				await this.cleanup(repoPath);
			}
		}
	}

	/**
	 * Validate that the file is an image and within size limits
	 */
	private async validateImageFile(imagePath: string): Promise<void> {
		// Normalize path for the current platform
		const normalizedPath = path.normalize(imagePath);
		console.log(`[GistGitService] Validating image file: ${normalizedPath}`);

		// Check if file exists
		try {
			await fs.promises.access(normalizedPath, fs.constants.F_OK);
		} catch (error) {
			console.error(`[GistGitService] File not found: ${normalizedPath}`, error);
			throw new Error(`Image file not found: ${normalizedPath}`);
		}

		// Check file extension
		const ext = path.extname(normalizedPath).toLowerCase();
		const config = vscode.workspace.getConfiguration('gistEditor');
		const supportedFormats = config.get<string[]>('supportedImageFormats', [
			'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'
		]);

		if (!supportedFormats.includes(ext)) {
			throw new Error(`Unsupported image format: ${ext}. Supported: ${supportedFormats.join(', ')}`);
		}

		// Check file size
		const stats = await fs.promises.stat(normalizedPath);
		const maxSizeMB = config.get<number>('maxImageSizeMB', 10);
		const maxSizeBytes = maxSizeMB * 1024 * 1024;

		if (stats.size > maxSizeBytes) {
			throw new Error(`Image file too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${maxSizeMB}MB)`);
		}

		// GitHub has a 100MB file limit
		if (stats.size > 100 * 1024 * 1024) {
			throw new Error('Image exceeds GitHub file size limit of 100MB');
		}
	}

	/**
	 * Clone a gist repository to a temporary directory
	 */
	private async cloneGist(gistId: string, username: string): Promise<string> {
		try {
			// Create temp directory
			const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gist-'));
			this.tempDirs.add(tempDir);

			// Get authentication token
			const token = await this.getAuthToken();

			// Clone URL with authentication
			// Use token in URL: https://TOKEN@gist.github.com/GIST_ID.git
			const cloneUrl = `https://${token}@gist.github.com/${gistId}.git`;

			const git: SimpleGit = simpleGit();

			// Clone with shallow depth for faster cloning
			await git.clone(cloneUrl, tempDir, ['--depth', '1']);

			console.log(`Cloned gist ${gistId} to ${tempDir}`);
			return tempDir;
		} catch (error: any) {
			console.error('Error cloning gist:', error);
			if (error.message?.includes('Authentication failed')) {
				throw new Error('GitHub authentication failed. Please check your token.');
			}
			throw new Error(`Failed to clone gist repository: ${error.message}`);
		}
	}

	/**
	 * Commit and push changes to the gist repository
	 */
	private async commitAndPush(repoPath: string, filename: string): Promise<void> {
		try {
			const git: SimpleGit = simpleGit(repoPath);

			// Configure git user (required for commit)
			await git.addConfig('user.name', 'Gist Editor');
			await git.addConfig('user.email', 'gist-editor@vscode');

			// Add file
			await git.add(filename);

			// Commit
			await git.commit(`Add image: ${filename}`);

			// Push to remote
			await git.push('origin', 'HEAD');

			console.log(`Committed and pushed ${filename}`);
		} catch (error: any) {
			console.error('Error committing and pushing:', error);
			if (error.message?.includes('Authentication failed')) {
				throw new Error('GitHub authentication failed during push. Please check your token.');
			}
			if (error.message?.includes('conflict')) {
				throw new Error('Conflict detected. The gist may have been modified. Please try again.');
			}
			throw new Error(`Failed to commit and push changes: ${error.message}`);
		}
	}

	/**
	 * Get authentication token for Git operations
	 */
	private async getAuthToken(): Promise<string> {
		// Try to get OAuth token first
		if (this.githubService.isAuthenticated()) {
			// Get token from the service (we need to access the private token field)
			// Since we can't access private fields, we'll use a workaround:
			// Try OAuth session first, then fall back to manual token
			try {
				const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: false });
				if (session) {
					return session.accessToken;
				}
			} catch (error) {
				console.log('No OAuth session available, trying manual token...');
			}

			// Fall back to manual token from config
			const config = vscode.workspace.getConfiguration('gistEditor');
			const token = config.get<string>('githubToken');
			if (token) {
				return token;
			}
		}

		throw new Error('Not authenticated. Please configure GitHub token first.');
	}

	/**
	 * Clean up temporary directory
	 */
	private async cleanup(repoPath: string): Promise<void> {
		try {
			if (this.tempDirs.has(repoPath)) {
				await fs.promises.rm(repoPath, { recursive: true, force: true });
				this.tempDirs.delete(repoPath);
				console.log(`Cleaned up temp directory: ${repoPath}`);
			}
		} catch (error) {
			console.error('Error cleaning up temp directory:', error);
			// Don't throw - cleanup errors shouldn't fail the operation
		}
	}

	/**
	 * Clean up all temporary directories
	 */
	async cleanupAll(): Promise<void> {
		for (const tempDir of this.tempDirs) {
			await this.cleanup(tempDir);
		}
	}
}
