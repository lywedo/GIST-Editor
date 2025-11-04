/**
 * Description parser for extracting folder hierarchy from gist descriptions
 *
 * Pattern: "Folder/SubFolder/Name - Display Name"
 * Examples:
 * - "React/Components - Button Component" → ['React', 'Components']
 * - "Utils/String - String utilities" → ['Utils', 'String']
 * - "No folder" → []
 */

export interface ParsedGistDescription {
	folderPath: string[];
	displayName: string;
	originalDescription: string;
}

/**
 * Parses a gist description to extract folder path and display name
 * @param description The raw gist description from GitHub
 * @returns Parsed description with folder path and display name
 */
export function parseGistDescription(description: string): ParsedGistDescription {
	if (!description || typeof description !== 'string') {
		return {
			folderPath: [],
			displayName: '',
			originalDescription: description || ''
		};
	}

	// Match pattern: "Folder/SubFolder/Item - Rest of description"
	// Group 1: Path parts (e.g., "React/Components" or "My Folder/Sub Folder")
	// Group 2: Display name (e.g., "Button Component")
	const match = description.match(/^([\w\-\s./]+?)\s*-\s*(.+)$/);

	if (!match) {
		// No folder prefix, use entire description as display name
		return {
			folderPath: [],
			displayName: description.trim(),
			originalDescription: description
		};
	}

	const [, paths, displayName] = match;

	// Split by "/" and filter out empty parts
	const folderPath = paths
		.split('/')
		.map(p => p.trim())
		.filter(p => p.length > 0)
		.map(p => p.replace(/[\s]+/g, ' ')); // Normalize spaces

	return {
		folderPath,
		displayName: displayName.trim(),
		originalDescription: description
	};
}

/**
 * Creates a description from folder path and display name
 * @param folderPath Array of folder names
 * @param displayName The gist display name
 * @returns Formatted description
 */
export function createGistDescription(folderPath: string[], displayName: string): string {
	if (folderPath.length === 0) {
		return displayName;
	}

	const pathStr = folderPath.join('/');
	return `${pathStr} - ${displayName}`;
}

/**
 * Gets the full folder path as a string
 * @param folderPath Array of folder names
 * @returns Path like "React/Components"
 */
export function getFolderPathString(folderPath: string[]): string {
	return folderPath.join('/');
}

/**
 * Checks if two folder paths are equal
 * @param path1 First folder path
 * @param path2 Second folder path
 * @returns true if paths are equal
 */
export function areFolderPathsEqual(path1: string[], path2: string[]): boolean {
	if (path1.length !== path2.length) {
		return false;
	}
	return path1.every((p, i) => p === path2[i]);
}

/**
 * Checks if a path is a child of another path
 * @param childPath The path to check
 * @param parentPath The potential parent path
 * @returns true if childPath is under parentPath
 */
export function isPathChild(childPath: string[], parentPath: string[]): boolean {
	if (childPath.length <= parentPath.length) {
		return false;
	}

	for (let i = 0; i < parentPath.length; i++) {
		if (childPath[i] !== parentPath[i]) {
			return false;
		}
	}

	return true;
}

/**
 * Builds a full folder path string for display
 * @param folderPath Array of folder names
 * @param name Optional name to append
 * @returns Display path like "React > Components > Button"
 */
export function getDisplayPath(folderPath: string[], name?: string): string {
	const parts = [...folderPath];
	if (name) {
		parts.push(name);
	}
	return parts.join(' > ');
}
