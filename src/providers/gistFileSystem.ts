import * as vscode from 'vscode';
import { GitHubService, Gist } from '../githubService';

/**
 * File system provider for gist files (allows editing via the gist:// URI scheme)
 */
export class GistFileSystemProvider implements vscode.FileSystemProvider {
	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	private gistCache = new Map<string, Gist>();

	constructor(private githubService: GitHubService) {}

	watch(uri: vscode.Uri): vscode.Disposable {
		// Ignore, we don't support watching
		return new vscode.Disposable(() => {});
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		return {
			type: vscode.FileType.File,
			ctime: Date.now(),
			mtime: Date.now(),
			size: 0
		};
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
		return [];
	}

	createDirectory(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot create directories in gists');
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const pathParts = uri.path.substring(1).split('/');
		const gistId = pathParts[0];
		const filename = decodeURIComponent(pathParts.slice(1).join('/'));

		console.log(`FileSystem: Reading "${filename}" from gist ${gistId}`);

		try {
			// Try to get from cache first
			let gist = this.gistCache.get(gistId);
			if (!gist) {
				console.log(`Fetching gist ${gistId} from API...`);
				gist = await this.githubService.getGist(gistId);
				console.log(`Gist fetched: public=${gist.public}, files=${Object.keys(gist.files).length}`);
				this.gistCache.set(gistId, gist);
			}

			const file = gist.files[filename];
			if (!file) {
				const availableFiles = Object.keys(gist.files).join(', ');
				console.error(`File "${filename}" not found in gist. Available: ${availableFiles}`);
				throw vscode.FileSystemError.FileNotFound(uri);
			}

			console.log(`Successfully read content for ${filename} (${file.content?.length || 0} characters)`);
			return Buffer.from(file.content || '', 'utf8');
		} catch (error: any) {
			console.error('Error reading gist file:', error);
			throw vscode.FileSystemError.Unavailable(error.message);
		}
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
		const pathParts = uri.path.substring(1).split('/');
		const gistId = pathParts[0];
		const filename = decodeURIComponent(pathParts.slice(1).join('/'));
		const contentStr = Buffer.from(content).toString('utf8');

		console.log(`FileSystem: Writing "${filename}" to gist ${gistId} (${contentStr.length} chars)`);

		try {
			await this.githubService.updateGist(gistId, undefined, {
				[filename]: { content: contentStr }
			});

			// Invalidate cache
			this.gistCache.delete(gistId);

			// Notify that file changed
			this._emitter.fire([{
				type: vscode.FileChangeType.Changed,
				uri
			}]);

			console.log(`Successfully saved ${filename} to gist`);
		} catch (error: any) {
			console.error('Error writing gist file:', error);
			throw vscode.FileSystemError.Unavailable(error.message);
		}
	}

	delete(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot delete gist files directly');
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot rename gist files directly');
	}

	public invalidateCache(gistId: string) {
		this.gistCache.delete(gistId);
	}
}
