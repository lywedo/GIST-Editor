import * as vscode from 'vscode';
import { GitHubService, Gist, GistComment } from './githubService';
import {
	extractTags,
	normalizeTag,
	isValidTag,
	formatTagsForDisplay
} from './tagsProtocol';

/**
 * Manages tags stored in gist comments
 * Tags are stored in a special comment with format: [tag:tagname1] [tag:tagname2]
 * Tags are synced with GitHub automatically
 */
export class TagsManager {
	private _onTagsChanged = new vscode.EventEmitter<string>();
	readonly onTagsChanged = this._onTagsChanged.event;

	// Special marker to identify the tags comment
	private readonly TAGS_COMMENT_MARKER = '[GIST_TAGS]';

	constructor(private githubService: GitHubService) {}

	/**
	 * Find the tags comment for a gist
	 */
	private async findTagsComment(gistId: string): Promise<GistComment | undefined> {
		try {
			const comments = await this.githubService.getGistComments(gistId);
			return comments.find(c => c.body.includes(this.TAGS_COMMENT_MARKER));
		} catch (error) {
			console.error('[TagsManager] Error finding tags comment:', error);
			return undefined;
		}
	}

	/**
	 * Get all tags for a gist from its comment
	 */
	async getTags(gist: Gist): Promise<string[]> {
		const tagsComment = await this.findTagsComment(gist.id);
		if (!tagsComment) {
			return [];
		}
		return extractTags(tagsComment.body);
	}

	/**
	 * Get description of gist (for display)
	 */
	getCleanDescription(gist: Gist): string {
		return gist.description || '';
	}

	/**
	 * Add a tag to a gist (updates on GitHub comment)
	 */
	async addTag(gist: Gist, tag: string): Promise<void> {
		if (!isValidTag(tag)) {
			throw new Error('Invalid tag. Must contain only alphanumeric characters, hyphens, and underscores');
		}

		const normalizedTag = normalizeTag(tag);
		const currentTags = await this.getTags(gist);

		// Check if tag already exists
		if (currentTags.includes(normalizedTag)) {
			throw new Error(`Tag "${tag}" already exists on this gist`);
		}

		// Build new tags string
		const newTags = [...currentTags, normalizedTag];
		const tagsString = newTags.map(t => `[tag:${t}]`).join(' ');
		const commentBody = `${this.TAGS_COMMENT_MARKER}\n${tagsString}`;

		// Find existing tags comment
		const tagsComment = await this.findTagsComment(gist.id);

		if (tagsComment) {
			// Update existing comment
			await this.githubService.updateGistComment(gist.id, tagsComment.id, commentBody);
		} else {
			// Create new comment
			await this.githubService.createGistComment(gist.id, commentBody);
		}

		this._onTagsChanged.fire(gist.id);
	}

	/**
	 * Remove a tag from a gist (updates on GitHub comment)
	 */
	async removeTag(gist: Gist, tag: string): Promise<void> {
		const normalizedTag = normalizeTag(tag);
		const currentTags = await this.getTags(gist);

		if (!currentTags.includes(normalizedTag)) {
			throw new Error(`Tag "${tag}" not found on this gist`);
		}

		// Build new tags string without the removed tag
		const newTags = currentTags.filter(t => t !== normalizedTag);
		const tagsComment = await this.findTagsComment(gist.id);

		if (!tagsComment) {
			throw new Error('Tags comment not found');
		}

		if (newTags.length === 0) {
			// Delete the comment if no tags remain
			await this.githubService.deleteGistComment(gist.id, tagsComment.id);
		} else {
			// Update comment with remaining tags
			const tagsString = newTags.map(t => `[tag:${t}]`).join(' ');
			const commentBody = `${this.TAGS_COMMENT_MARKER}\n${tagsString}`;
			await this.githubService.updateGistComment(gist.id, tagsComment.id, commentBody);
		}

		this._onTagsChanged.fire(gist.id);
	}

	/**
	 * Replace all tags on a gist (updates on GitHub comment)
	 */
	async setTags(gist: Gist, tags: string[]): Promise<void> {
		// Validate all tags
		for (const tag of tags) {
			if (!isValidTag(tag)) {
				throw new Error(`Invalid tag: "${tag}"`);
			}
		}

		// Normalize all tags
		const normalizedTags = tags.map(t => normalizeTag(t));
		const tagsString = normalizedTags.map(t => `[tag:${t}]`).join(' ');
		const commentBody = `${this.TAGS_COMMENT_MARKER}\n${tagsString}`;

		// Find existing tags comment
		const tagsComment = await this.findTagsComment(gist.id);

		if (tagsComment) {
			// Update existing comment
			await this.githubService.updateGistComment(gist.id, tagsComment.id, commentBody);
		} else {
			// Create new comment
			await this.githubService.createGistComment(gist.id, commentBody);
		}

		this._onTagsChanged.fire(gist.id);
	}

	/**
	 * Clear all tags from a gist (updates on GitHub comment)
	 */
	async clearTags(gist: Gist): Promise<void> {
		const currentTags = await this.getTags(gist);

		if (currentTags.length === 0) {
			return; // No tags to clear
		}

		const tagsComment = await this.findTagsComment(gist.id);

		if (tagsComment) {
			// Delete the tags comment
			await this.githubService.deleteGistComment(gist.id, tagsComment.id);
		}

		this._onTagsChanged.fire(gist.id);
	}

	/**
	 * Get all gists with a specific tag from a list
	 */
	async getGistsWithTag(gists: Gist[], tag: string): Promise<Gist[]> {
		const normalizedTag = normalizeTag(tag);
		const result: Gist[] = [];

		for (const gist of gists) {
			const tags = await this.getTags(gist);
			if (tags.includes(normalizedTag)) {
				result.push(gist);
			}
		}

		return result;
	}

	/**
	 * Get all unique tags from a list of gists
	 */
	async getAllUniqueTags(gists: Gist[]): Promise<string[]> {
		const uniqueTags = new Set<string>();

		for (const gist of gists) {
			const tags = await this.getTags(gist);
			tags.forEach(tag => uniqueTags.add(tag));
		}

		return Array.from(uniqueTags).sort();
	}

	/**
	 * Format tags for display (async version)
	 */
	async formatTagsForDisplay(gist: Gist): Promise<string> {
		const tags = await this.getTags(gist);
		return formatTagsForDisplay(tags);
	}

	/**
	 * Validate tag string
	 */
	isValidTag(tag: string): boolean {
		return isValidTag(tag);
	}
}
