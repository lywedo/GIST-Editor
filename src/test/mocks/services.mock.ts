/**
 * Mock services for testing
 */

import { Gist, GistComment } from '../../githubService';

export class MockGitHubService {
	private authenticated = true;
	private gists: Gist[] = [];
	private starredGists: Gist[] = [];

	isAuthenticated(): boolean {
		return this.authenticated;
	}

	setAuthenticated(auth: boolean) {
		this.authenticated = auth;
	}

	getTokenStatus(): string {
		return this.authenticated ? 'Authenticated' : 'Not authenticated';
	}

	async getOAuthToken(): Promise<string> {
		return 'mock-token';
	}

	async setToken(token: string): Promise<void> {
		this.authenticated = true;
	}

	async removeToken(): Promise<void> {
		this.authenticated = false;
	}

	async getCurrentUsername(): Promise<string> {
		return 'testuser';
	}

	async getMyGists(): Promise<Gist[]> {
		return this.gists;
	}

	async getStarredGists(): Promise<Gist[]> {
		return this.starredGists;
	}

	async getGist(gistId: string): Promise<Gist> {
		const gist = this.gists.find(g => g.id === gistId);
		if (!gist) {
			throw new Error('Gist not found');
		}
		return gist;
	}

	async createGist(description: string, files: any, isPublic: boolean): Promise<Gist> {
		const newGist: Gist = {
			id: `gist-${Date.now()}`,
			description,
			public: isPublic,
			files,
			html_url: `https://gist.github.com/test/${Date.now()}`,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			owner: { login: 'testuser', avatar_url: '' }
		};
		this.gists.push(newGist);
		return newGist;
	}

	async updateGist(gistId: string, description: string, files: any): Promise<Gist> {
		const gist = await this.getGist(gistId);
		gist.description = description;
		gist.files = { ...gist.files, ...files };
		return gist;
	}

	async deleteGist(gistId: string): Promise<void> {
		this.gists = this.gists.filter(g => g.id !== gistId);
	}

	async starGist(gistId: string): Promise<void> {
		const gist = await this.getGist(gistId);
		if (!this.starredGists.find(g => g.id === gistId)) {
			this.starredGists.push(gist);
		}
	}

	async unstarGist(gistId: string): Promise<void> {
		this.starredGists = this.starredGists.filter(g => g.id !== gistId);
	}

	async isGistStarred(gistId: string): Promise<boolean> {
		return this.starredGists.some(g => g.id === gistId);
	}

	async checkIfStarred(gistId: string): Promise<boolean> {
		return this.starredGists.some(g => g.id === gistId);
	}

	async getGistRevisions(gistId: string): Promise<any[]> {
		// Return mock revisions
		return [
			{
				version: 'abc123def',
				committed_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
				change_status: { additions: 10, deletions: 5 },
				user: { login: 'testuser' }
			},
			{
				version: 'xyz789abc',
				committed_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
				change_status: { additions: 5, deletions: 2 },
				user: { login: 'testuser' }
			}
		];
	}

	async getGistAtRevision(gistId: string, sha: string): Promise<Gist> {
		const gist = await this.getGist(gistId);
		// Return the gist with modified content to simulate revision
		return {
			...gist,
			files: {
				'test.js': {
					filename: 'test.js',
					type: 'application/javascript',
					language: 'JavaScript',
					raw_url: 'https://gist.github.com/raw/test.js',
					size: 50,
					content: `// Historical version ${sha.substring(0, 7)}\nconsole.log("old");`
				}
			}
		};
	}

	async checkTokenScopes(): Promise<string[]> {
		return ['gist'];
	}

	getApiUsageStats() {
		return {
			totalCalls: 10,
			callsByType: { gists: 5, 'user-info': 2 } as { [key: string]: number },
			rateLimit: {
				limit: 5000,
				remaining: 4990,
				reset: Date.now() + 3600000,
				resetTime: new Date(Date.now() + 3600000).toISOString()
			},
			sessionStartTime: Date.now() - 1000000
		};
	}

	async getGistComments(gistId: string): Promise<GistComment[]> {
		return [];
	}

	async createGistComment(gistId: string, body: string): Promise<GistComment> {
		return {
			id: Date.now(),
			body,
			user: { login: 'testuser', avatar_url: '' },
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			html_url: `https://gist.github.com/${gistId}#gistcomment-${Date.now()}`
		};
	}

	async deleteGistComment(gistId: string, commentId: number): Promise<void> {
		// Mock implementation
	}

	// Helper for tests
	setMockGists(gists: Gist[]) {
		this.gists = gists;
	}
}

export class MockGistProvider {
	private refreshCount = 0;
	private tagsCache: Map<string, string[]> = new Map();

	refresh() {
		this.refreshCount++;
	}

	getRefreshCount(): number {
		return this.refreshCount;
	}

	async getChildren(element?: any): Promise<any[]> {
		return [];
	}

	getTreeItem(element: any): any {
		return element;
	}

	getTagsCache(): Map<string, string[]> {
		return new Map(this.tagsCache);
	}

	setTagsCache(tagsCache: Map<string, string[]>) {
		this.tagsCache = tagsCache;
	}
}

export class MockCommentProvider {
	private selectedGist: Gist | null = null;
	private refreshCount = 0;

	setSelectedGist(gist: Gist) {
		this.selectedGist = gist;
	}

	clearSelectedGist() {
		this.selectedGist = null;
	}

	refresh() {
		this.refreshCount++;
	}

	getRefreshCount(): number {
		return this.refreshCount;
	}

	async getChildren(): Promise<any[]> {
		return [];
	}
}

export class MockTagsManager {
	private tags: Map<string, string[]> = new Map();
	private changeHandler: (() => void) | null = null;

	async getTags(gist: Gist): Promise<string[]> {
		return this.tags.get(gist.id) || [];
	}

	async addTag(gist: Gist, tag: string): Promise<void> {
		if (!this.isValidTag(tag)) {
			throw new Error('Invalid tag. Must contain only alphanumeric characters, hyphens, and underscores');
		}

		const normalizedTag = tag.toLowerCase();
		const existing = this.tags.get(gist.id) || [];

		if (existing.includes(normalizedTag)) {
			throw new Error(`Tag "${tag}" already exists on this gist`);
		}

		this.tags.set(gist.id, [...existing, normalizedTag]);
		this.changeHandler?.();
	}

	async removeTag(gist: Gist, tag: string): Promise<void> {
		const normalizedTag = tag.toLowerCase();
		const existing = this.tags.get(gist.id) || [];

		if (!existing.includes(normalizedTag)) {
			throw new Error(`Tag "${tag}" not found on this gist`);
		}

		this.tags.set(gist.id, existing.filter(t => t !== normalizedTag));
		this.changeHandler?.();
	}

	async clearTags(gist: Gist): Promise<void> {
		this.tags.delete(gist.id);
		this.changeHandler?.();
	}

	async getGistsWithTag(gists: Gist[], tag: string): Promise<Gist[]> {
		const normalizedTag = tag.toLowerCase();
		const result: Gist[] = [];

		for (const gist of gists) {
			const tags = await this.getTags(gist);
			if (tags.includes(normalizedTag)) {
				result.push(gist);
			}
		}

		return result;
	}

	async getAllUniqueTags(gists: Gist[]): Promise<string[]> {
		const uniqueTags = new Set<string>();

		for (const gist of gists) {
			const tags = await this.getTags(gist);
			tags.forEach(tag => uniqueTags.add(tag));
		}

		return Array.from(uniqueTags).sort();
	}

	async formatTagsForDisplay(gist: Gist): Promise<string> {
		const tags = await this.getTags(gist);
		if (tags.length === 0) {
			return '';
		}
		return tags.map(t => `[tag:${t}]`).join(' ');
	}

	getCleanDescription(gist: Gist): string {
		return gist.description || '';
	}

	isValidTag(tag: string): boolean {
		return /^[a-zA-Z0-9_-]+$/.test(tag);
	}

	onTagsChanged(handler: () => void) {
		this.changeHandler = handler;
	}
}

export class MockGistFileSystemProvider {
	// Mock implementation
	readFile(): Uint8Array {
		return new Uint8Array();
	}

	writeFile(): void {}

	invalidateCache(gistId: string): void {}
}

export function createMockGist(overrides: Partial<Gist> = {}): Gist {
	return {
		id: 'test-gist-123',
		description: 'Test Gist',
		public: true,
		files: {
			'test.js': {
				filename: 'test.js',
				type: 'application/javascript',
				language: 'JavaScript',
				raw_url: 'https://gist.github.com/raw/test.js',
				size: 100,
				content: 'console.log("test");'
			}
		},
		html_url: 'https://gist.github.com/test/123',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
		owner: {
			login: 'testuser',
			avatar_url: 'https://github.com/testuser.png'
		},
		...overrides
	};
}
