import { Gist } from './githubService';
import { parseGistDescription, areFolderPathsEqual, isPathChild, getFolderPathString } from './gistDescriptionParser';

/**
 * Represents a folder node in the gist hierarchy
 */
export interface GistFolder {
	path: string[];
	displayName: string;
	gists: Gist[];
	subFolders: GistFolder[];
	parentPath?: string[];
}

/**
 * Result of building folder tree
 */
export interface FolderTreeResult {
	folders: GistFolder[];
	ungroupedGists: Gist[];
	totalFolders: number;
	totalGists: number;
	gistToFolderMap: Map<string, GistFolder>;
}

/**
 * Builds a hierarchical folder structure from a flat list of gists
 * based on their description-derived folder paths
 */
export class GistFolderBuilder {
	/**
	 * Build folder tree from a flat list of gists
	 * @param gists Flat array of gists from GitHub API
	 * @returns Hierarchical folder structure with ungrouped gists
	 */
	buildFolderTree(gists: Gist[]): FolderTreeResult {
		const folders = new Map<string, GistFolder>();
		const ungroupedGists: Gist[] = [];
		const gistToFolderMap = new Map<string, GistFolder>();
		let totalFolders = 0;

		// First pass: parse gist descriptions and group by folder
		for (const gist of gists) {
			const parsed = parseGistDescription(gist.description || '');

			if (parsed.folderPath.length === 0) {
				// No folder prefix - add to ungrouped
				ungroupedGists.push(gist);
			} else {
				// Add gist to appropriate folder
				const folder = this.addGistToFolder(folders, gist, parsed.folderPath);
				if (folder) {
					gistToFolderMap.set(gist.id, folder);
				}
			}
		}

		// Count total folders
		totalFolders = this.countFolders(folders);

		// Build final folder structure (root folders only)
		const rootFolders = this.buildFolderHierarchy(folders);

		console.log(`[GistFolderBuilder] Built hierarchy: ${rootFolders.length} root folders, ${ungroupedGists.length} ungrouped gists`);
		rootFolders.forEach(f => {
			console.log(`  - Root: "${f.displayName}" (${f.gists.length} gists, ${f.subFolders.length} subfolders)`);
		});

		return {
			folders: rootFolders,
			ungroupedGists,
			totalFolders,
			totalGists: gists.length,
			gistToFolderMap,
		};
	}

	/**
	 * Add a gist to the folder tree
	 */
	private addGistToFolder(folderMap: Map<string, GistFolder>, gist: Gist, folderPath: string[]) {
		let currentPath = '';

		for (let i = 0; i < folderPath.length; i++) {
			currentPath += folderPath[i];

			if (!folderMap.has(currentPath)) {
				folderMap.set(currentPath, {
					path: folderPath.slice(0, i + 1),
					displayName: folderPath[i],
					gists: [],
					subFolders: [],
					parentPath: i > 0 ? folderPath.slice(0, i) : undefined
				});
			}

			currentPath += '/';
		}

		// Add gist to the deepest folder
		const deepestPath = folderPath.join('/');
		const folder = folderMap.get(deepestPath);
		if (folder) {
			folder.gists.push(gist);
		}
		return folder;
	}

	/**
	 * Build folder hierarchy from flat folder map
	 */
	private buildFolderHierarchy(folderMap: Map<string, GistFolder>): GistFolder[] {
		const folders = Array.from(folderMap.values());

		// Find root folders (those without parent)
		const rootByName = new Map<string, GistFolder>();

		for (const folder of folders) {
			if (folder.path.length === 1) {
				const name = folder.path[0];
				if (!rootByName.has(name)) {
					rootByName.set(name, {
						...folder,
						subFolders: []
					});
				} else {
					// Merge gists if folder already exists
					const existing = rootByName.get(name)!;
					existing.gists = [...existing.gists, ...folder.gists];
				}
			}
		}

		// Build subfolder hierarchy from root folders
		const rootFolders = Array.from(rootByName.values());
		rootFolders.forEach(f => {
			f.subFolders = this.getSubFoldersRecursive(f.path, folderMap);
		});

		return rootFolders.sort((a, b) =>
			a.displayName.localeCompare(b.displayName)
		);
	}

	/**
	 * Recursively get all subfolders for a given folder path
	 */
	private getSubFoldersRecursive(parentPath: string[], folderMap: Map<string, GistFolder>): GistFolder[] {
		const subfolders: GistFolder[] = [];

		for (const [_, folder] of folderMap) {
			if (folder.path.length === parentPath.length + 1 && isPathChild(folder.path, parentPath)) {
				// This is a direct child
				folder.subFolders = this.getSubFoldersRecursive(folder.path, folderMap);
				subfolders.push(folder);
			}
		}

		return subfolders.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}

	/**
	 * Count total number of folders in the tree
	 */
	private countFolders(folderMap: Map<string, GistFolder>): number {
		return folderMap.size;
	}

	/**
	 * Get a flat list of all folders (useful for statistics)
	 */
	getAllFolders(tree: GistFolder[]): GistFolder[] {
		const all: GistFolder[] = [];

		const traverse = (folders: GistFolder[]) => {
			for (const folder of folders) {
				all.push(folder);
				traverse(folder.subFolders);
			}
		};

		traverse(tree);
		return all;
	}

	/**
	 * Get folder by gist ID
	 */
	getFolderByGist(tree: GistFolder[], gistId: string): GistFolder | undefined {
		for (const folder of tree) {
			if (folder.gists.some(g => g.id === gistId)) {
				return folder;
			}
			const found = this.getFolderByGist(folder.subFolders, gistId);
			if (found) {
				return found;
			}
		}
		return undefined;
	}

	/**
	 * Get folder by path
	 */
	getFolderByPath(tree: GistFolder[], path: string[]): GistFolder | undefined {
		if (path.length === 0) {
			return undefined;
		}

		let current = tree.find(f => f.displayName === path[0]);

		for (let i = 1; i < path.length && current; i++) {
			current = current.subFolders.find(f => f.displayName === path[i]);
		}

		return current;
	}

	/**
	 * Count total gists in a folder tree (including subfolders)
	 */
	countGistsInFolder(folder: GistFolder): number {
		let count = folder.gists.length;

		for (const subfolder of folder.subFolders) {
			count += this.countGistsInFolder(subfolder);
		}

		return count;
	}

	/**
	 * Get all gists in a folder tree (including subfolders)
	 */
	getAllGistsInFolder(folder: GistFolder): Gist[] {
		let gists = [...folder.gists];

		for (const subfolder of folder.subFolders) {
			gists = gists.concat(this.getAllGistsInFolder(subfolder));
		}

		return gists;
	}
}
