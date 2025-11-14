import * as vscode from 'vscode';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { SearchResult } from '../../searchProvider';

/**
 * Reveals a search result in the appropriate tree view
 */
export async function revealSearchSelection(
	result: SearchResult,
	myGistIds: Set<string>,
	starredGistIds: Set<string>,
	gistSelectionTracker: vscode.TreeView<GistItem>,
	myGistsProvider: GistProvider,
	starredSelectionTracker: vscode.TreeView<GistItem>,
	starredGistsProvider: GistProvider
): Promise<void> {
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

/**
 * Reveals a gist in a specific tree view by navigating through folders
 */
export async function revealInTreeView(
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

/**
 * Recursively finds the path to a gist in the tree
 */
export async function findGistPath(
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

/**
 * Returns icon/label for search match type
 */
export function getMatchTypeLabel(matchType: string): string {
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
