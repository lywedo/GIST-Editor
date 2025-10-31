import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

export interface GistFile {
    filename: string;
    type: string;
    language: string;
    raw_url: string;
    size: number;
    content?: string;
}

export interface Gist {
    id: string;
    description: string;
    public: boolean;
    created_at: string;
    updated_at: string;
    html_url: string;
    files: { [filename: string]: GistFile };
    owner?: {
        login: string;
        avatar_url: string;
    };
}

export interface GistRevision {
    version: string;
    committed_at: string;
    change_status: {
        total: number;
        additions: number;
        deletions: number;
    };
    user: {
        login: string;
        avatar_url: string;
    };
    url: string;
}

export class GitHubService {
    private api: AxiosInstance;
    private token: string | undefined;
    private currentUsername: string | undefined;

    constructor() {
        this.api = axios.create({
            baseURL: 'https://api.github.com',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'VSCode-Gist-Editor'
            }
        });

        this.loadToken();
    }

    private loadToken(): void {
        // First try to load from legacy config (backwards compatibility)
        const config = vscode.workspace.getConfiguration('gistEditor');
        this.token = config.get<string>('githubToken');

        if (this.token) {
            this.api.defaults.headers.common['Authorization'] = `token ${this.token}`;
            console.log('GitHub token loaded from legacy config');
        } else {
            console.log('No legacy token found, will restore OAuth session on demand');
        }
    }

    private async ensureTokenLoaded(): Promise<void> {
        // If we already have a token, nothing to do
        if (this.token) {
            return;
        }

        // Try to restore from existing OAuth session (doesn't prompt user)
        try {
            console.log('Attempting to restore GitHub OAuth session...');
            const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: false });
            if (session) {
                this.token = session.accessToken;
                this.api.defaults.headers.common['Authorization'] = `token ${this.token}`;
                console.log('Successfully restored GitHub OAuth session from VS Code');
                return;
            }
        } catch (error) {
            console.log('No existing GitHub OAuth session found');
        }
    }

    public async getOAuthToken(): Promise<string> {
        try {
            // Request gist scope for full access to private and public gists
            const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
            if (session) {
                this.token = session.accessToken;
                this.api.defaults.headers.common['Authorization'] = `token ${this.token}`;
                console.log('GitHub OAuth token obtained successfully');
                console.log('Token scopes:', session.scopes);

                // Verify the token works by fetching user info
                try {
                    const userResponse = await this.api.get('/user');
                    console.log('Authenticated as:', userResponse.data.login);
                } catch (verifyError) {
                    console.error('Token verification failed:', verifyError);
                }

                return this.token;
            }
        } catch (error) {
            console.error('Failed to get GitHub session:', error);
            throw new Error('Failed to authenticate with GitHub. Please try again.');
        }
        throw new Error('Failed to obtain GitHub OAuth token');
    }

    public async setToken(token: string): Promise<void> {
        this.token = token;
        this.api.defaults.headers.common['Authorization'] = `token ${this.token}`;

        const config = vscode.workspace.getConfiguration('gistEditor');
        await config.update('githubToken', token, vscode.ConfigurationTarget.Global);

        console.log('GitHub token saved and configured');
    }

    public isAuthenticated(): boolean {
        return !!this.token;
    }

    public async removeToken(): Promise<void> {
        this.token = undefined;
        delete this.api.defaults.headers.common['Authorization'];

        const config = vscode.workspace.getConfiguration('gistEditor');
        await config.update('githubToken', undefined, vscode.ConfigurationTarget.Global);

        console.log('GitHub token removed');
    }

    public getTokenStatus(): string {
        if (!this.token) {
            return 'Not configured';
        }
        // Show partial token for security
        const masked = this.token.substring(0, 8) + '...' + this.token.substring(this.token.length - 4);
        return `Configured (${masked})`;
    }

    public async checkTokenScopes(): Promise<string[]> {
        await this.ensureTokenLoaded();
        
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await this.api.get('/user');
            const scopesHeader = response.headers['x-oauth-scopes'] || '';
            const scopes = scopesHeader.split(',').map((s: string) => s.trim()).filter(Boolean);
            
            console.log('Token scopes:', scopes);
            
            if (!scopes.includes('gist')) {
                console.error('❌ CRITICAL: Token is missing "gist" scope!');
                console.error('Available scopes:', scopes);
                console.error('You will NOT be able to access private gists or create gists without this scope.');
            } else {
                console.log('✓ Token has "gist" scope - private gists should be accessible');
            }
            
            return scopes;
        } catch (error) {
            console.error('Failed to check token scopes:', error);
            throw error;
        }
    }

    public async getCurrentUsername(): Promise<string> {
        if (this.currentUsername) {
            return this.currentUsername;
        }

        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await this.api.get('/user');
            const username: string = response.data.login;
            this.currentUsername = username;
            return username;
        } catch (error) {
            console.error('Failed to fetch current user:', error);
            throw new Error('Failed to fetch GitHub user information');
        }
    }

    public async getMyGists(): Promise<Gist[]> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            // First, let's verify the token works by checking the user
            console.log('Verifying GitHub authentication...');
            const userResponse = await this.api.get('/user');
            console.log('Authenticated user:', userResponse.data.login);
            console.log('User scopes available:', userResponse.headers['x-oauth-scopes']);

            // Check if gist scope is present
            const scopes = userResponse.headers['x-oauth-scopes'] || '';
            console.log('Token scopes:', scopes);
            if (!scopes.includes('gist')) {
                console.warn('⚠️ WARNING: Token does not have "gist" scope! Private gists may not be accessible.');
                console.warn('Token scopes found:', scopes);
            }

            console.log('Making API request to /gists...');
            // Try with pagination parameters to get all gists
            const response = await this.api.get('/gists', {
                params: {
                    per_page: 100 // Get up to 100 gists per page
                }
            });
            console.log('API Response status:', response.status);
            console.log('API Response data length:', response.data?.length);
            console.log('API Response headers (scopes):', response.headers['x-oauth-scopes']);

            // Log gist visibility info
            if (response.data && Array.isArray(response.data)) {
                console.log('Gist visibility summary:');
                const publicCount = response.data.filter((g: Gist) => g.public).length;
                const privateCount = response.data.filter((g: Gist) => !g.public).length;
                console.log(`  - Public gists: ${publicCount}`);
                console.log(`  - Private gists: ${privateCount}`);
                console.log('First gist (if any):', {
                    id: response.data[0]?.id,
                    public: response.data[0]?.public,
                    description: response.data[0]?.description
                });
            }

            if (!Array.isArray(response.data)) {
                console.error('Expected array but got:', typeof response.data);
                return [];
            }

            return response.data;
        } catch (error: any) {
            console.error('Error fetching gists:', error);
            if (error.response) {
                console.error('Error response status:', error.response.status);
                console.error('Error response data:', error.response.data);
                console.error('Error response headers (scopes):', error.response.headers['x-oauth-scopes']);
            }
            throw new Error(`Failed to fetch gists from GitHub: ${error.message}`);
        }
    }

    public async getStarredGists(): Promise<Gist[]> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            const response = await this.api.get('/gists/starred');
            return response.data;
        } catch (error) {
            console.error('Error fetching starred gists:', error);
            throw new Error('Failed to fetch starred gists from GitHub');
        }
    }

    public async getGist(gistId: string): Promise<Gist> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            console.log(`Fetching gist ${gistId}...`);
            const response = await this.api.get(`/gists/${gistId}`);
            console.log(`Successfully fetched gist ${gistId}:`, {
                id: response.data.id,
                public: response.data.public,
                fileCount: Object.keys(response.data.files).length,
                description: response.data.description,
                owner: response.data.owner?.login
            });
            return response.data;
        } catch (error: any) {
            console.error(`Error fetching gist ${gistId}:`, error);
            if (error.response) {
                console.error('Error response status:', error.response.status);
                console.error('Error response data:', error.response.data);
                
                if (error.response.status === 403) {
                    throw new Error(`Access denied to gist ${gistId}. This might be a private gist that requires proper authentication.`);
                } else if (error.response.status === 404) {
                    throw new Error(`Gist ${gistId} not found. It may have been deleted or you don't have access to it.`);
                }
            }
            throw new Error(`Failed to fetch gist ${gistId}: ${error.message}`);
        }
    }

    public async createGist(description: string, files: { [filename: string]: { content: string } }, isPublic: boolean = false): Promise<Gist> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            const response = await this.api.post('/gists', {
                description,
                files,
                public: isPublic
            });
            return response.data;
        } catch (error) {
            console.error('Error creating gist:', error);
            throw new Error('Failed to create gist');
        }
    }

    public async updateGist(gistId: string, description?: string, files?: { [filename: string]: { content: string } }): Promise<Gist> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            const payload: any = {};
            if (description !== undefined) {
                payload.description = description;
            }
            if (files !== undefined) {
                payload.files = files;
            }

            const response = await this.api.patch(`/gists/${gistId}`, payload);
            return response.data;
        } catch (error) {
            console.error('Error updating gist:', error);
            throw new Error(`Failed to update gist ${gistId}`);
        }
    }

    public async deleteGist(gistId: string): Promise<void> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            await this.api.delete(`/gists/${gistId}`);
        } catch (error) {
            console.error('Error deleting gist:', error);
            throw new Error(`Failed to delete gist ${gistId}`);
        }
    }

    public async getGistRevisions(gistId: string): Promise<GistRevision[]> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            console.log(`Fetching revisions for gist ${gistId}...`);
            const response = await this.api.get(`/gists/${gistId}/commits`);
            console.log(`Found ${response.data.length} revisions`);
            return response.data;
        } catch (error) {
            console.error('Error fetching gist revisions:', error);
            throw new Error(`Failed to fetch revisions for gist ${gistId}`);
        }
    }

    public async getGistAtRevision(gistId: string, sha: string): Promise<Gist> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            console.log(`Fetching gist ${gistId} at revision ${sha}...`);
            const response = await this.api.get(`/gists/${gistId}/${sha}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching gist at revision:', error);
            throw new Error(`Failed to fetch gist ${gistId} at revision ${sha}`);
        }
    }

    public async starGist(gistId: string): Promise<void> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            console.log(`[starGist] Starring gist ${gistId}`);
            await this.api.put(`/gists/${gistId}/star`);
            console.log(`[starGist] Successfully starred gist ${gistId}`);
        } catch (error) {
            console.error('Error starring gist:', error);
            throw new Error(`Failed to star gist ${gistId}`);
        }
    }

    public async unstarGist(gistId: string): Promise<void> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            console.log(`[unstarGist] Unstarring gist ${gistId}`);
            await this.api.delete(`/gists/${gistId}/star`);
            console.log(`[unstarGist] Successfully unstarred gist ${gistId}`);
        } catch (error) {
            console.error('Error unstarring gist:', error);
            throw new Error(`Failed to unstar gist ${gistId}`);
        }
    }

    public async checkIfStarred(gistId: string): Promise<boolean> {
        // Restore OAuth session if needed
        await this.ensureTokenLoaded();

        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            console.log(`[checkIfStarred] Checking if gist ${gistId} is starred`);
            await this.api.get(`/gists/${gistId}/star`);
            console.log(`[checkIfStarred] Gist ${gistId} is starred`);
            return true;
        } catch (error: any) {
            if (error.response?.status === 404) {
                console.log(`[checkIfStarred] Gist ${gistId} is not starred`);
                return false;
            }
            console.error('Error checking if gist is starred:', error);
            throw new Error(`Failed to check if gist is starred: ${error.message}`);
        }
    }
}