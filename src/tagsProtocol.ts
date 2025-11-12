/**
 * Tags Protocol for Gist Editor
 *
 * Format: Tags are embedded in gist descriptions using the format:
 * [tag:tagname1] [tag:tagname2] [tag:tagname3]
 *
 * Example description:
 * "React custom hooks for authentication [tag:react] [tag:hooks] [tag:auth]"
 *
 * Benefits:
 * - Tags are stored in GitHub (synced across devices)
 * - Visible in GitHub web interface
 * - No local storage needed
 * - Works with collaboration
 * - Easy to parse and understand
 */

const TAG_PATTERN = /\[tag:([^\]]+)\]/gi;
const TAG_PREFIX = '[tag:';
const TAG_SUFFIX = ']';

/**
 * Extract tags from a gist description
 */
export function extractTags(description: string): string[] {
	if (!description) {
		return [];
	}

	const tags: string[] = [];
	let match;

	// Reset regex state
	TAG_PATTERN.lastIndex = 0;

	while ((match = TAG_PATTERN.exec(description)) !== null) {
		const tag = match[1].trim().toLowerCase();
		if (tag && !tags.includes(tag)) {
			tags.push(tag);
		}
	}

	return tags;
}

/**
 * Add a tag to a description (returns updated description)
 */
export function addTagToDescription(description: string, tag: string): string {
	if (!tag) {
		return description;
	}

	const normalizedTag = normalizeTag(tag);
	const existingTags = extractTags(description);

	// Tag already exists
	if (existingTags.includes(normalizedTag)) {
		return description;
	}

	// Add the tag at the end
	const tagMarkup = `${TAG_PREFIX}${normalizedTag}${TAG_SUFFIX}`;
	return description.trim() + ' ' + tagMarkup;
}

/**
 * Remove a tag from a description (returns updated description)
 */
export function removeTagFromDescription(description: string, tag: string): string {
	if (!tag || !description) {
		return description;
	}

	const normalizedTag = normalizeTag(tag);
	const regex = new RegExp(`\\[tag:${normalizedTag}\\]\\s*`, 'gi');
	return description.replace(regex, '').trim();
}

/**
 * Replace all tags in a description
 */
export function replaceTagsInDescription(description: string, newTags: string[]): string {
	if (!description) {
		return '';
	}

	// Remove all existing tags first
	let cleaned = description.replace(TAG_PATTERN, '').trim();

	// Add new tags
	if (newTags.length > 0) {
		const tagMarkup = newTags
			.map(tag => `${TAG_PREFIX}${normalizeTag(tag)}${TAG_SUFFIX}`)
			.join(' ');
		cleaned = cleaned + ' ' + tagMarkup;
	}

	return cleaned.trim();
}

/**
 * Get description without tags
 */
export function getDescriptionWithoutTags(description: string): string {
	if (!description) {
		return '';
	}
	return description.replace(TAG_PATTERN, '').trim();
}

/**
 * Check if a description has tags
 */
export function hasTags(description: string): boolean {
	if (!description) {
		return false;
	}
	return TAG_PATTERN.test(description);
}

/**
 * Normalize a tag string
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove special characters except hyphens and underscores
 * - Max 30 characters
 */
export function normalizeTag(tag: string): string {
	return tag
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\-_]/g, '')
		.substring(0, 30);
}

/**
 * Validate a tag string
 */
export function isValidTag(tag: string): boolean {
	return normalizeTag(tag).length > 0;
}

/**
 * Format tags for display (e.g., "#tag1 #tag2")
 */
export function formatTagsForDisplay(tags: string[]): string {
	return tags.map(tag => `#${tag}`).join(' ');
}
