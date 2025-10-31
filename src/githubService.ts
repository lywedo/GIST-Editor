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
            console.log('No legacy token found, will use OAuth via vscode.authentication');
        }
    }

    public async getOAuthToken(): Promise<string> {
        try {
            const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
            if (session) {
                this.token = session.accessToken;
                this.api.defaults.headers.common['Authorization'] = `token ${this.token}`;
                console.log('GitHub OAuth token obtained successfully');
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

    public async getCurrentUsername(): Promise<string> {
        if (this.currentUsername) {
            return this.currentUsername;
        }

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
        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            // First, let's verify the token works by checking the user
            console.log('Verifying GitHub authentication...');
            const userResponse = await this.api.get('/user');
            console.log('Authenticated user:', userResponse.data.login);

            console.log('Making API request to /gists...');
            // Try with pagination parameters to get all gists
            const response = await this.api.get('/gists', {
                params: {
                    per_page: 100 // Get up to 100 gists per page
                }
            });
            console.log('API Response status:', response.status);
            console.log('API Response headers:', response.headers);
            console.log('API Response data length:', response.data?.length);
            console.log('First gist (if any):', response.data?.[0]);
            
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
            }
            throw new Error(`Failed to fetch gists from GitHub: ${error.message}`);
        }
    }

    public async getStarredGists(): Promise<Gist[]> {
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
        if (!this.isAuthenticated()) {
            throw new Error('GitHub token not configured');
        }

        try {
            const response = await this.api.get(`/gists/${gistId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching gist:', error);
            throw new Error(`Failed to fetch gist ${gistId}`);
        }
    }

    public async createGist(description: string, files: { [filename: string]: { content: string } }, isPublic: boolean = false): Promise<Gist> {
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
}