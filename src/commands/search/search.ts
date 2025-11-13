import * as vscode from 'vscode';
import { GitHubService } from '../../githubService';
import { TagsManager } from '../../tagsManager';
import { GistProvider } from '../../providers/gistProvider';
import { GistItem } from '../../providers/gistItem';
import { SearchProvider, SearchResult } from '../../searchProvider';
import { revealSearchSelection, getMatchTypeLabel } from '../helpers/searchHelpers';

export interface SearchCache {
	searchProvider: SearchProvider;
	timestamp: number;
	myGistIds: Set<string>;
	starredGistIds: Set<string>;
}

/**
 * Registers search commands
 */
export function registerSearchCommands(
	context: vscode.ExtensionContext,
	githubService: GitHubService,
	tagsManager: TagsManager,
	myGistsProvider: GistProvider,
	starredGistsProvider: GistProvider,
	gistSelectionTracker: vscode.TreeView<GistItem>,
	starredSelectionTracker: vscode.TreeView<GistItem>,
	getSearchCache: () => SearchCache | null,
	setSearchCache: (cache: SearchCache | null) => void
): void {
	const searchCommand = vscode.commands.registerCommand('gist-editor.search', async () => {
		if (!githubService.isAuthenticated()) {
			try {
				await githubService.getOAuthToken();
			} catch (error) {
				const setup = await vscode.window.showErrorMessage(
					'You need to sign in with GitHub to search gists.',
					'Sign in with GitHub'
				);
				if (setup === 'Sign in with GitHub') {
					vscode.commands.executeCommand('gist-editor.setupToken');
				}
				return;
			}
		}

		try {
			let searchProvider: SearchProvider;
			let myGistIds: Set<string>;
			let starredGistIds: Set<string>;

			const searchCache = getSearchCache();

			// Use cached search provider if available
			if (searchCache) {
				console.log('[Search] Using cached search provider');
				searchProvider = searchCache.searchProvider;
				myGistIds = searchCache.myGistIds;
				starredGistIds = searchCache.starredGistIds;
			} else {
				// Build search index (shown only on first open)
				console.log('[Search] Building new search index');
				({ searchProvider, myGistIds, starredGistIds } = await vscode.window.withProgress({
					location: vscode.ProgressLocation.Window,
					title: 'Searching gists...'
				}, async (progress) => {
					// Fetch all gists
					progress.report({ message: 'Fetching gists...' });
					const myGists = await githubService.getMyGists();
					const starredGists = await githubService.getStarredGists();
					const allGists = [...myGists, ...starredGists];
					const gistSources = new Map<string, 'my' | 'starred'>();
					myGists.forEach((gistItem) => gistSources.set(gistItem.id, 'my'));
					starredGists.forEach((gistItem) => {
						if (!gistSources.has(gistItem.id)) {
							gistSources.set(gistItem.id, 'starred');
						}
					});
					const myGistIds = new Set(myGists.map(g => g.id));
					const starredGistIds = new Set(starredGists.map(g => g.id));

					// Build search index with tags
					progress.report({ message: 'Building search index with tags...' });
					const searchProvider = new SearchProvider(tagsManager);
					// Use cached tags from both providers to avoid refetching
					const cachedTags = new Map(myGistsProvider.getTagsCache());
					for (const [gistId, tags] of starredGistsProvider.getTagsCache()) {
						if (!cachedTags.has(gistId)) {
							cachedTags.set(gistId, tags);
						}
					}
					await searchProvider.buildSearchIndex(allGists, gistSources, cachedTags);

					return { searchProvider, myGistIds, starredGistIds };
				}));

				// Cache the search provider
				setSearchCache({
					searchProvider,
					myGistIds,
					starredGistIds,
					timestamp: Date.now()
				});
			}

			// Create quick pick with dynamic filtering
			const quickPick = vscode.window.createQuickPick<{
				label: string;
				description: string;
				detail: string;
				result: SearchResult;
			}>();

			quickPick.placeholder = 'Type to search gists by name, description, file name, or content...';
			quickPick.matchOnDescription = true;
			quickPick.matchOnDetail = true;
			quickPick.ignoreFocusOut = true;

			// Helper to format tags in search results
			const formatSearchTags = (tags?: string[]): string => {
				if (!tags || tags.length === 0) {
					return '';
				}
				return ` | ${tags.map(t => `#${t}`).join(' ')}`;
			};

			// Initial results - show all gists
			const initialResults = await searchProvider.searchGists('');
			quickPick.items = initialResults.slice(0, 50).map((result: SearchResult) => ({
				label: `$(${result.matchType === 'content' ? 'file-text' : 'gist'}) ${result.gistName}${result.fileName ? ` → ${result.fileName}` : ''}`,
				description: result.folderPath.length > 0 ? result.folderPath.join(' > ') : 'Root',
				detail: `${getMatchTypeLabel(result.matchType)}${result.lineNumber ? ` (Line ${result.lineNumber})` : ''} • ${result.isPublic ? 'Public' : 'Private'} • ${result.preview}${formatSearchTags(result.tags)}`,
				result
			}));

			// Update results as user types with debouncing
			let searchTimeout: NodeJS.Timeout | undefined;
			let isSearching = false;

			quickPick.onDidChangeValue(async (value) => {
				// Clear previous timeout
				if (searchTimeout) {
					clearTimeout(searchTimeout);
				}

				// Debounce search: wait 300ms before searching
				searchTimeout = setTimeout(async () => {
					try {
						isSearching = true;
						quickPick.busy = true;

						if (!value.trim()) {
							// Show all when empty
							const allResults = await searchProvider.searchGists('');
							quickPick.items = allResults.slice(0, 50).map((result: SearchResult) => ({
								label: `$(${result.matchType === 'content' ? 'file-text' : 'gist'}) ${result.gistName}${result.fileName ? ` → ${result.fileName}` : ''}`,
								description: result.folderPath.length > 0 ? result.folderPath.join(' > ') : 'Root',
								detail: `${getMatchTypeLabel(result.matchType)}${result.lineNumber ? ` (Line ${result.lineNumber})` : ''} • ${result.isPublic ? 'Public' : 'Private'} • ${result.preview}${formatSearchTags(result.tags)}`,
								result
							}));
						} else {
							// Perform search with current query
							const results = await searchProvider.searchGists(value);

							if (results.length === 0) {
								quickPick.items = [{
									label: '$(search) No results found',
									description: '',
									detail: `No gists match "${value}"`,
									result: null as any
								}];
							} else {
								quickPick.items = results.map((result: SearchResult) => ({
									label: `$(${result.matchType === 'content' ? 'file-text' : 'gist'}) ${result.gistName}${result.fileName ? ` → ${result.fileName}` : ''}`,
									description: result.folderPath.length > 0 ? result.folderPath.join(' > ') : 'Root',
									detail: `${getMatchTypeLabel(result.matchType)}${result.lineNumber ? ` (Line ${result.lineNumber})` : ''} • ${result.isPublic ? 'Public' : 'Private'} • ${result.preview}${formatSearchTags(result.tags)}`,
									result
								}));
							}
						}
					} finally {
						isSearching = false;
						quickPick.busy = false;
					}
				}, 300);
			});

			// Handle selection
			quickPick.onDidAccept(async () => {
				const selected = quickPick.selectedItems[0];
				quickPick.hide();

				if (!selected || !selected.result) {
					return;
				}

				const result = selected.result;
				await revealSearchSelection(
					result,
					myGistIds,
					starredGistIds,
					gistSelectionTracker,
					myGistsProvider,
					starredSelectionTracker,
					starredGistsProvider
				);

				// Open the file or gist
				if (result.fileName) {
					// Open specific file
					const uri = vscode.Uri.parse(`gist:/${result.gistId}/${encodeURIComponent(result.fileName)}`);
					const doc = await vscode.workspace.openTextDocument(uri);
					const editor = await vscode.window.showTextDocument(doc);

					// If content match, jump to line
					if (result.matchType === 'content' && result.lineNumber) {
						const line = result.lineNumber - 1;
						editor.selection = new vscode.Selection(line, 0, line, 0);
						editor.revealRange(new vscode.Range(line, 0, line, 0));
					}
				} else {
					// Open gist (will show files)
					if (result.gist && result.gist.id) {
						console.log(`[Search] Opening gist from search result: ${result.gist.id}`);
						vscode.commands.executeCommand('gist-editor.openGist', result.gist);
					} else {
						console.error('[Search] Cannot open gist: search result is missing gist object or gist ID.', result);
						vscode.window.showErrorMessage('Could not open the selected gist. The search result was incomplete.');
					}
				}
			});

			quickPick.onDidHide(() => quickPick.dispose());
			quickPick.show();
		} catch (error) {
			console.error('Error searching gists:', error);
			vscode.window.showErrorMessage(`Failed to search gists: ${error}`);
		}
	});

	context.subscriptions.push(searchCommand);
}
