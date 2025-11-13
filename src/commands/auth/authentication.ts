import * as vscode from 'vscode';
import { GitHubService } from '../../githubService';
import { GistProvider } from '../../providers/gistProvider';
import { CommentProvider } from '../../providers/commentProvider';

/**
 * Registers authentication and API-related commands
 */
export function registerAuthCommands(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider,
	commentProvider: CommentProvider,
	apiUsageOutputChannel: vscode.OutputChannel
): void {
	// Setup GitHub token (OAuth or manual)
	const setupTokenCommand = vscode.commands.registerCommand('gist-editor.setupToken', async () => {
		const isAuthenticated = githubService.isAuthenticated();

		// Show current status and options
		const tokenStatus = githubService.getTokenStatus();
		const action = await vscode.window.showQuickPick([
			{
				label: isAuthenticated ? '$(github) Sign in with GitHub' : '$(github) Sign in with GitHub',
				description: isAuthenticated ? 'Sign in again or switch account' : 'Quick OAuth login - opens your browser',
				detail: 'oauth'
			},
			{
				label: '$(key) Use Personal Access Token',
				description: 'Manually enter a GitHub Personal Access Token',
				detail: 'manual'
			},
			...(isAuthenticated ? [{
				label: '$(trash) Sign Out',
				description: 'Sign out and remove GitHub authentication',
				detail: 'logout'
			}] : [])
		], {
			placeHolder: `Current Status: ${tokenStatus}`,
			ignoreFocusOut: true
		});

		if (!action) {
			return;
		}

		if (action.detail === 'oauth') {
			// Use OAuth flow
			try {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Signing in with GitHub...',
					cancellable: false
				}, async () => {
					await githubService.getOAuthToken();

					// Get username to confirm login
					const username = await githubService.getCurrentUsername();

					vscode.window.showInformationMessage(
						`Successfully signed in as @${username}!`,
						'Refresh Gists'
					).then(selection => {
						if (selection === 'Refresh Gists') {
							myGistsProvider.refresh();
							starredGistsProvider.refresh();
						}
					});

					// Auto-refresh after successful authentication
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
					commentProvider.refresh();
				});
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to authenticate with GitHub: ${error}`,
					'Try Again'
				).then(selection => {
					if (selection === 'Try Again') {
						vscode.commands.executeCommand('gist-editor.setupToken');
					}
				});
			}
			return;
		}

		if (action.detail === 'logout') {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to sign out?',
				{ modal: true },
				'Sign Out',
				'Cancel'
			);

			if (confirm === 'Sign Out') {
				try {
					await githubService.removeToken();
					vscode.window.showInformationMessage('You have been signed out!');
					myGistsProvider.refresh();
					starredGistsProvider.refresh();
					commentProvider.clearSelectedGist();
					commentProvider.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to sign out: ${error}`);
				}
			}
			return;
		}

		// Manual token entry
		const token = await vscode.window.showInputBox({
			prompt: 'Enter your GitHub Personal Access Token',
			password: true,
			placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value) {
					return 'Token cannot be empty';
				}
				if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
					return 'Invalid token format. GitHub tokens start with "ghp_" or "github_pat_"';
				}
				return null;
			}
		});

		if (token) {
			try {
				await githubService.setToken(token);
				vscode.window.showInformationMessage(
					'GitHub token configured successfully!',
					'Refresh Gists'
				).then(selection => {
					if (selection === 'Refresh Gists') {
						myGistsProvider.refresh();
						starredGistsProvider.refresh();
					}
				});

				// Auto-refresh after successful token setup
				myGistsProvider.refresh();
				starredGistsProvider.refresh();
				commentProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to configure GitHub token: ${error}`,
					'Try Again'
				).then(selection => {
					if (selection === 'Try Again') {
						vscode.commands.executeCommand('gist-editor.setupToken');
					}
				});
			}
		}
	});

	// Test API connection
	const testApiCommand = vscode.commands.registerCommand('gist-editor.testAPI', async () => {
		try {
			console.log('Testing GitHub API...');
			const isAuth = githubService.isAuthenticated();
			console.log('Is authenticated:', isAuth);

			if (!isAuth) {
				vscode.window.showWarningMessage('Please set up GitHub token first');
				return;
			}

			// Test fetching user and check scopes
			const username = await githubService.getCurrentUsername();
			console.log('Current user:', username);

			const gists = await githubService.getMyGists();

			// Count public vs private
			const publicCount = gists.filter(g => g.public).length;
			const privateCount = gists.filter(g => !g.public).length;

			vscode.window.showInformationMessage(
				`Found ${gists.length} gists!\nPublic: ${publicCount}, Private: ${privateCount}`,
				'Show Details'
			).then(selection => {
				if (selection === 'Show Details') {
					const details = gists.map(g => `${g.public ? '🌐' : '🔒'} ${g.description || 'Untitled'}`).join('\n');
					vscode.window.showInformationMessage(details);
				}
			});
			console.log('Gists:', gists.map(g => ({ id: g.id, public: g.public, desc: g.description })));
		} catch (error) {
			console.error('API test error:', error);
			vscode.window.showErrorMessage(`API test failed: ${error}`);
		}
	});

	// Check token scopes and permissions
	const checkScopesCommand = vscode.commands.registerCommand('gist-editor.checkScopes', async () => {
		try {
			if (!githubService.isAuthenticated()) {
				vscode.window.showWarningMessage('No GitHub token configured. Please set up authentication first.');
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Checking GitHub token permissions...',
				cancellable: false
			}, async () => {
				try {
					// Check token scopes
					const scopes = await githubService.checkTokenScopes();
					const hasGistScope = scopes.includes('gist');

					// Fetch username and gists
					const username = await githubService.getCurrentUsername();
					const gists = await githubService.getMyGists();

					const publicCount = gists.filter(g => g.public).length;
					const privateCount = gists.filter(g => !g.public).length;

					let message = `✓ Authenticated as: ${username}\n`;
					message += `✓ Token scopes: ${scopes.join(', ')}\n\n`;
					message += `Total gists: ${gists.length}\n`;
					message += `📂 Public gists: ${publicCount}\n`;
					message += `🔒 Private gists: ${privateCount}\n\n`;

					if (!hasGistScope) {
						message += `❌ PROBLEM FOUND: Your token is missing the "gist" scope!\n\n`;
						message += `This is why you cannot access private gists.\n\n`;
						message += `To fix this:\n`;
						message += `1. Go to github.com/settings/tokens\n`;
						message += `2. Click "Generate new token (classic)"\n`;
						message += `3. Check the "gist" checkbox ✓\n`;
						message += `4. Generate and copy the token\n`;
						message += `5. Click the gear (⚙️) button in "My Gists" view\n`;
						message += `6. Select "Change GitHub Token" and paste your new token`;

						vscode.window.showErrorMessage(message, 'Open GitHub Settings', 'Setup Token').then(selection => {
							if (selection === 'Open GitHub Settings') {
								vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
							} else if (selection === 'Setup Token') {
								vscode.commands.executeCommand('gist-editor.setupToken');
							}
						});
					} else if (privateCount === 0 && publicCount > 0) {
						message += `✓ Your token has the "gist" scope.\n`;
						message += `ℹ️ You either have no private gists, or they're not showing up.\n\n`;
						message += `Try:\n`;
						message += `1. Check on github.com/gists if you have private gists\n`;
						message += `2. Click the refresh button in the Gist Editor sidebar`;

						vscode.window.showInformationMessage(message, 'Refresh Gists').then(selection => {
							if (selection === 'Refresh Gists') {
								vscode.commands.executeCommand('gist-editor.refresh');
							}
						});
					} else {
						message += `✓ Everything looks good! Your token has proper access.`;
						vscode.window.showInformationMessage(message, 'OK');
					}
				} catch (error: any) {
					let errorMsg = '❌ Token Permission Check Failed\n\n';

					if (error.response?.status === 403) {
						errorMsg += 'Your token does not have the required permissions.\n\n';
						errorMsg += '🔧 FIX: Create a new GitHub Personal Access Token\n\n';
						errorMsg += 'Steps:\n';
						errorMsg += '1. Visit: github.com/settings/tokens\n';
						errorMsg += '2. "Generate new token (classic)"\n';
						errorMsg += '3. Name: "VS Code Gist Editor"\n';
						errorMsg += '4. ✓ Check the "gist" scope\n';
						errorMsg += '5. Click "Generate token"\n';
						errorMsg += '6. Copy the token (you only see it once!)\n';
						errorMsg += '7. In VS Code: Click ⚙️ in Gist Editor → Update token';
					} else if (error.response?.status === 401) {
						errorMsg += 'Your token is invalid or has been revoked.\n\n';
						errorMsg += 'Please create a new token with the "gist" scope.';
					} else {
						errorMsg += `Error: ${error.message}\n\n`;
						errorMsg += 'This might be a network issue or GitHub API problem.';
					}

					vscode.window.showErrorMessage(errorMsg, 'Open Token Settings', 'Setup Token').then(selection => {
						if (selection === 'Open Token Settings') {
							vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens'));
						} else if (selection === 'Setup Token') {
							vscode.commands.executeCommand('gist-editor.setupToken');
						}
					});
				}
			});
		} catch (error) {
			console.error('Scope check error:', error);
			vscode.window.showErrorMessage(`Failed to check permissions: ${error}`);
		}
	});

	// View API usage statistics
	const viewApiUsageCommand = vscode.commands.registerCommand('gist-editor.viewApiUsage', async () => {
		try {
			if (!githubService.isAuthenticated()) {
				vscode.window.showWarningMessage('No GitHub token configured. Please set up authentication first.');
				return;
			}

			const stats = githubService.getApiUsageStats();

			// Clear previous output
			apiUsageOutputChannel.clear();

			// Build detailed message
			let message = `📊 GitHub API Usage Statistics\n`;
			message += `${'═'.repeat(60)}\n\n`;

			message += `SESSION INFORMATION\n`;
			message += `${'-'.repeat(60)}\n`;
			const sessionStart = new Date(stats.sessionStartTime);
			const now = new Date();
			const sessionDuration = Math.floor((now.getTime() - stats.sessionStartTime) / 1000);
			const hours = Math.floor(sessionDuration / 3600);
			const minutes = Math.floor((sessionDuration % 3600) / 60);
			const seconds = sessionDuration % 60;
			const durationStr = hours > 0
				? `${hours}h ${minutes}m ${seconds}s`
				: minutes > 0
				? `${minutes}m ${seconds}s`
				: `${seconds}s`;

			message += `Session Start:     ${sessionStart.toLocaleString()}\n`;
			message += `Session Duration:  ${durationStr}\n`;
			message += `Total API Calls:   ${stats.totalCalls}\n\n`;

			message += `API CALLS BY OPERATION\n`;
			message += `${'-'.repeat(60)}\n`;
			const callTypes = Object.entries(stats.callsByType)
				.sort((a, b) => (b[1] as number) - (a[1] as number))
				.map(([type, count]) => {
					const icon = type === 'gists' ? '📝' :
								 type === 'gist-comments' ? '💬' :
								 type === 'gist-history' ? '📜' :
								 type === 'star-unstar' ? '⭐' :
								 type === 'user-info' ? '👤' :
								 '🔧';
					return `  ${icon} ${type.padEnd(20)} : ${count}`;
				});

			if (callTypes.length === 0) {
				message += '  No API calls made yet\n\n';
			} else {
				message += callTypes.join('\n') + '\n\n';
			}

			message += `RATE LIMIT STATUS\n`;
			message += `${'-'.repeat(60)}\n`;
			const remaining = stats.rateLimit.remaining;
			const limit = stats.rateLimit.limit;
			const usedPercent = limit > 0 ? Math.round((limit - remaining) / limit * 100) : 0;
			const resetDate = new Date(stats.rateLimit.reset);

			message += `Calls Remaining:   ${remaining} / ${limit}\n`;
			message += `Usage:             ${usedPercent}% (${limit - remaining} calls used)\n`;
			message += `Rate Limit Resets: ${resetDate.toLocaleString()}\n\n`;

			message += `STATUS\n`;
			message += `${'-'.repeat(60)}\n`;
			if (remaining < 100 && limit > 0) {
				message += `⚠️  WARNING: You're approaching your rate limit!\n`;
				message += `    Please wait until the limit resets before making more requests.`;
			} else if (remaining === 0) {
				message += `❌ RATE LIMITED: You've hit your API limit!\n`;
				message += `    Please wait until ${resetDate.toLocaleString()} to continue.`;
			} else {
				message += `✓ You have plenty of API calls available.`;
			}

			message += `\n\n${'-'.repeat(60)}\n`;
			message += `Use 'gist-editor.resetApiUsageStats' command to reset statistics.\n`;

			// Write to output channel
			apiUsageOutputChannel.appendLine(message);
			apiUsageOutputChannel.show(true);

			vscode.window.showInformationMessage('API usage statistics displayed in "Gist Editor - API Usage" output panel');

		} catch (error) {
			console.error('Error viewing API usage:', error);
			vscode.window.showErrorMessage(`Failed to retrieve API usage stats: ${error}`);
		}
	});

	context.subscriptions.push(
		setupTokenCommand,
		testApiCommand,
		checkScopesCommand,
		viewApiUsageCommand
	);
}
