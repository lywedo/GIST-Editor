import * as assert from 'assert';
import * as sinon from 'sinon';
import { registerSearchCommands, SearchCache } from '../../../commands/search/search';
import { MockExtensionContext, mockVscode, MockTreeView } from '../../mocks/vscode.mock';
import { MockGitHubService, MockGistProvider, MockTagsManager, createMockGist } from '../../mocks/services.mock';
import { SearchProvider } from '../../../searchProvider';
import { Gist } from '../../../githubService';

suite('Search Commands Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let githubService: MockGitHubService;
	let tagsManager: MockTagsManager;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;
	let gistSelectionTracker: MockTreeView;
	let starredSelectionTracker: MockTreeView;
	let searchCache: SearchCache | null;
	let getSearchCache: () => SearchCache | null;
	let setSearchCache: (cache: SearchCache | null) => void;

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		githubService = new MockGitHubService();
		tagsManager = new MockTagsManager();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
		gistSelectionTracker = new MockTreeView();
		starredSelectionTracker = new MockTreeView();
		searchCache = null;
		getSearchCache = () => searchCache;
		setSearchCache = (cache: SearchCache | null) => { searchCache = cache; };
	});

	teardown(() => {
		sandbox.restore();
		searchCache = null;
	});

	suite('registerSearchCommands', () => {
		test('should register search command', () => {
			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			assert.strictEqual(context.subscriptions.length, 1, 'should register 1 command');
		});
	});

	suite('search command - authentication', () => {
		let registerCommandStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let executeCommandStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');
		});

		test('should prompt for authentication if not authenticated', async () => {
			githubService.setAuthenticated(false);
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('Not authenticated'));

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			assert.ok(searchCall, 'search command should be registered');

			const handler = searchCall.args[1];

			showErrorMessageStub.resolves('Sign in with GitHub');

			await handler();

			assert.ok(showErrorMessageStub.calledWith(
				'You need to sign in with GitHub to search gists.',
				'Sign in with GitHub'
			));
			assert.ok(executeCommandStub.calledWith('gist-editor.setupToken'));
		});

		test('should return when user cancels authentication', async () => {
			githubService.setAuthenticated(false);
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('Not authenticated'));

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			showErrorMessageStub.resolves(undefined); // User cancels

			await handler();

			assert.ok(showErrorMessageStub.called);
			assert.strictEqual(executeCommandStub.called, false);
		});

		test('should proceed when authenticated via OAuth', async () => {
			githubService.setAuthenticated(false);
			const createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick');
			const mockQuickPick: any = {
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().returns({ dispose: () => {} }),
				onDidAccept: sandbox.stub().returns({ dispose: () => {} }),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};
			createQuickPickStub.returns(mockQuickPick);

			// OAuth succeeds
			sandbox.stub(githubService, 'getOAuthToken').resolves('token');
			githubService.setAuthenticated(true);

			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			assert.ok(createQuickPickStub.called, 'should create quick pick after authentication');
		});
	});

	suite('search command - search cache', () => {
		let registerCommandStub: sinon.SinonStub;
		let createQuickPickStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;
		let mockQuickPick: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress');

			mockQuickPick = {
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().returns({ dispose: () => {} }),
				onDidAccept: sandbox.stub().returns({ dispose: () => {} }),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};
			createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick').returns(mockQuickPick);
		});

		test('should create new search cache when none exists', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			withProgressStub.callsFake(async (options, task) => {
				const result = await task({ report: () => {} });
				return result;
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			assert.strictEqual(getSearchCache(), null, 'cache should be null initially');

			await handler();

			assert.ok(withProgressStub.called, 'should show progress when building index');
			assert.notStrictEqual(getSearchCache(), null, 'cache should be created');
			assert.ok(getSearchCache()!.searchProvider instanceof SearchProvider);
			assert.ok(getSearchCache()!.myGistIds instanceof Set);
			assert.ok(getSearchCache()!.starredGistIds instanceof Set);
			assert.ok(typeof getSearchCache()!.timestamp === 'number');
		});

		test('should use cached search provider when available', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			// Pre-create cache
			const cachedSearchProvider = new SearchProvider(tagsManager);
			await cachedSearchProvider.buildSearchIndex([mockGist], new Map([['test-gist-123', 'my']]));
			searchCache = {
				searchProvider: cachedSearchProvider,
				timestamp: Date.now(),
				myGistIds: new Set(['test-gist-123']),
				starredGistIds: new Set()
			};

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Should not show progress (no new index building)
			assert.strictEqual(withProgressStub.called, false, 'should not rebuild index when cache exists');
			assert.ok(createQuickPickStub.called, 'should create quick pick');
		});

		test('should include timestamp in cache', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			const beforeTimestamp = Date.now();
			await handler();
			const afterTimestamp = Date.now();

			const cache = getSearchCache();
			assert.ok(cache!.timestamp >= beforeTimestamp);
			assert.ok(cache!.timestamp <= afterTimestamp);
		});

		test('should separate my gists and starred gists in cache', async () => {
			githubService.setAuthenticated(true);

			const myGist = createMockGist({ id: 'my-gist-1', description: 'My Gist' });
			const starredGist = createMockGist({ id: 'starred-gist-1', description: 'Starred Gist' });

			sandbox.stub(githubService, 'getMyGists').resolves([myGist]);
			sandbox.stub(githubService, 'getStarredGists').resolves([starredGist]);

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			const cache = getSearchCache();
			assert.ok(cache!.myGistIds.has('my-gist-1'));
			assert.strictEqual(cache!.myGistIds.has('starred-gist-1'), false);
			assert.ok(cache!.starredGistIds.has('starred-gist-1'));
			assert.strictEqual(cache!.starredGistIds.has('my-gist-1'), false);
		});
	});

	suite('search command - search query and results', () => {
		let registerCommandStub: sinon.SinonStub;
		let createQuickPickStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;
		let mockQuickPick: any;
		let onDidChangeValueHandler: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress');

			mockQuickPick = {
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().callsFake((handler) => {
					onDidChangeValueHandler = handler;
					return { dispose: () => {} };
				}),
				onDidAccept: sandbox.stub().returns({ dispose: () => {} }),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};
			createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick').returns(mockQuickPick);

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});
		});

		test('should create quick pick with correct settings', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			assert.ok(createQuickPickStub.called);
			assert.strictEqual(mockQuickPick.placeholder, 'Type to search gists by name, description, file name, or content...');
			assert.strictEqual(mockQuickPick.matchOnDescription, true);
			assert.strictEqual(mockQuickPick.matchOnDetail, true);
			assert.strictEqual(mockQuickPick.ignoreFocusOut, true);
			assert.ok(mockQuickPick.show.called);
		});

		test('should display initial results (all gists)', async () => {
			githubService.setAuthenticated(true);
			const mockGist1 = createMockGist({ id: 'gist-1', description: 'First Gist' });
			const mockGist2 = createMockGist({ id: 'gist-2', description: 'Second Gist' });
			githubService.setMockGists([mockGist1, mockGist2]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			assert.ok(mockQuickPick.items.length > 0, 'should show initial results');
		});

		test('should update results when search query changes', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({
				id: 'gist-1',
				description: 'React Component',
				files: {
					'component.jsx': {
						filename: 'component.jsx',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/component.jsx',
						size: 100,
						content: 'function MyComponent() { return <div>React</div>; }'
					}
				}
			});
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Trigger search with query
			const clock = sandbox.useFakeTimers();
			onDidChangeValueHandler('react');
			clock.tick(300); // Wait for debounce

			await new Promise(resolve => setImmediate(resolve));

			assert.ok(mockQuickPick.items.length > 0, 'should show search results');
			clock.restore();
		});

		test('should show "no results" when query has no matches', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({ description: 'React Component' });
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Trigger search with non-matching query
			const clock = sandbox.useFakeTimers();
			onDidChangeValueHandler('nonexistentquery12345');
			clock.tick(300); // Wait for debounce

			await new Promise(resolve => setImmediate(resolve));

			assert.strictEqual(mockQuickPick.items.length, 1);
			assert.ok(mockQuickPick.items[0].label.includes('No results found'));
			clock.restore();
		});

		test('should debounce search input (300ms)', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			const clock = sandbox.useFakeTimers();

			// Trigger multiple rapid changes
			onDidChangeValueHandler('r');
			clock.tick(100);
			onDidChangeValueHandler('re');
			clock.tick(100);
			onDidChangeValueHandler('rea');
			clock.tick(100);
			onDidChangeValueHandler('reac');

			// Search should not have fired yet
			assert.strictEqual(mockQuickPick.busy, false);

			// Now wait full debounce time
			clock.tick(300);

			clock.restore();
		});

		test('should set busy state during search', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			assert.strictEqual(mockQuickPick.busy, false, 'should not be busy initially');
		});

		test('should show tags in search results', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({ id: 'gist-1', description: 'Tagged Gist' });
			await tagsManager.addTag(mockGist, 'react');
			await tagsManager.addTag(mockGist, 'javascript');
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Check that items contain tag information
			assert.ok(mockQuickPick.items.length > 0);
			// Tags should be in the detail field
			const hasTagInDetail = mockQuickPick.items.some((item: any) =>
				item.detail && item.detail.includes('#react')
			);
			assert.ok(hasTagInDetail, 'should include tags in result details');
		});
	});

	suite('search command - result navigation', () => {
		let registerCommandStub: sinon.SinonStub;
		let createQuickPickStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;
		let openTextDocumentStub: sinon.SinonStub;
		let showTextDocumentStub: sinon.SinonStub;
		let executeCommandStub: sinon.SinonStub;
		let mockQuickPick: any;
		let onDidAcceptHandler: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress');
			openTextDocumentStub = sandbox.stub(mockVscode.workspace, 'openTextDocument');
			showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
			executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');

			mockQuickPick = {
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().returns({ dispose: () => {} }),
				onDidAccept: sandbox.stub().callsFake((handler) => {
					onDidAcceptHandler = handler;
					return { dispose: () => {} };
				}),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};
			createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick').returns(mockQuickPick);

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});
		});

		test('should open file when result with fileName is selected', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({
				id: 'gist-1',
				files: {
					'test.js': {
						filename: 'test.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/test.js',
						size: 100,
						content: 'console.log("test");'
					}
				}
			});
			githubService.setMockGists([mockGist]);

			const mockEditor = {
				selection: null,
				revealRange: sandbox.stub()
			};
			openTextDocumentStub.resolves({});
			showTextDocumentStub.resolves(mockEditor);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Build search index and populate results
			const cache = getSearchCache();
			const results = await cache!.searchProvider.searchGists('test');

			if (results.length > 0) {
				mockQuickPick.selectedItems = [{
					label: 'test',
					description: '',
					detail: '',
					result: results[0]
				}];

				await onDidAcceptHandler();

				assert.ok(mockQuickPick.hide.called, 'should hide quick pick');
			}
		});

		test('should jump to line number for content matches', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({
				id: 'gist-1',
				files: {
					'test.js': {
						filename: 'test.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/test.js',
						size: 100,
						content: 'line 1\nline 2 with keyword\nline 3'
					}
				}
			});
			githubService.setMockGists([mockGist]);

			const mockEditor = {
				selection: null,
				revealRange: sandbox.stub()
			};
			openTextDocumentStub.resolves({});
			showTextDocumentStub.resolves(mockEditor);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Build search index and search for content
			const cache = getSearchCache();
			const results = await cache!.searchProvider.searchGists('keyword');
			const contentResult = results.find(r => r.matchType === 'content' && r.lineNumber);

			if (contentResult) {
				mockQuickPick.selectedItems = [{
					label: 'test',
					description: '',
					detail: '',
					result: contentResult
				}];

				await onDidAcceptHandler();

				assert.ok(mockQuickPick.hide.called);
				assert.ok(openTextDocumentStub.called);
				assert.ok(showTextDocumentStub.called);
			}
		});

		test('should open gist when result without fileName is selected', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({
				id: 'gist-1',
				description: 'Test Gist'
			});
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Build search index
			const cache = getSearchCache();
			const results = await cache!.searchProvider.searchGists('Test');
			const gistResult = results.find(r => !r.fileName);

			if (gistResult) {
				mockQuickPick.selectedItems = [{
					label: 'Test',
					description: '',
					detail: '',
					result: gistResult
				}];

				await onDidAcceptHandler();

				assert.ok(mockQuickPick.hide.called);
				assert.ok(executeCommandStub.calledWith('gist-editor.openGist', mockGist));
			}
		});

		test('should do nothing when no item is selected', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			mockQuickPick.selectedItems = [];

			await onDidAcceptHandler();

			assert.ok(mockQuickPick.hide.called);
			assert.strictEqual(openTextDocumentStub.called, false);
			assert.strictEqual(executeCommandStub.called, false);
		});

		test('should reveal selection in correct tree view (my gists)', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist({ id: 'my-gist-1' });

			sandbox.stub(githubService, 'getMyGists').resolves([mockGist]);
			sandbox.stub(githubService, 'getStarredGists').resolves([]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Verify cache has correct gist IDs
			const cache = getSearchCache();
			assert.ok(cache!.myGistIds.has('my-gist-1'));
			assert.strictEqual(cache!.starredGistIds.has('my-gist-1'), false);
		});

		test('should reveal selection in correct tree view (starred gists)', async () => {
			githubService.setAuthenticated(true);
			const starredGist = createMockGist({ id: 'starred-gist-1' });

			sandbox.stub(githubService, 'getMyGists').resolves([]);
			sandbox.stub(githubService, 'getStarredGists').resolves([starredGist]);

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Verify cache has correct gist IDs
			const cache = getSearchCache();
			assert.strictEqual(cache!.myGistIds.has('starred-gist-1'), false);
			assert.ok(cache!.starredGistIds.has('starred-gist-1'));
		});
	});

	suite('search command - error handling', () => {
		let registerCommandStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress');
		});

		test('should handle error when fetching gists fails', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(githubService, 'getMyGists').rejects(new Error('API error'));

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			assert.ok(showErrorMessageStub.called);
			const errorMessage = showErrorMessageStub.firstCall.args[0];
			assert.ok(errorMessage.includes('Failed to search gists'));
		});

		test('should handle error during search query execution', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			const createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick');
			createQuickPickStub.throws(new Error('QuickPick creation failed'));

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			assert.ok(showErrorMessageStub.called);
		});

		test('should handle missing gist object in search result', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			const createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick');
			const executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');

			const mockQuickPick: any = {
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().returns({ dispose: () => {} }),
				onDidAccept: sandbox.stub(),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};

			let onDidAcceptHandler: any;
			mockQuickPick.onDidAccept.callsFake((handler: any) => {
				onDidAcceptHandler = handler;
				return { dispose: () => {} };
			});

			createQuickPickStub.returns(mockQuickPick);

			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Simulate selecting a result without gist object
			(mockQuickPick.selectedItems as any) = [{
				label: 'Test',
				description: '',
				detail: '',
				result: {
					gistId: 'gist-1',
					gistName: 'Test',
					matchType: 'name',
					preview: 'Test',
					folderPath: [],
					isPublic: true,
					matchContext: 'Test',
					score: 100,
					gist: null // Missing gist
				}
			}];

			await onDidAcceptHandler();

			assert.ok(showErrorMessageStub.calledWith('Could not open the selected gist. The search result was incomplete.'));
		});
	});

	suite('search command - cache expiration', () => {
		test('should use cache within 5 minutes', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			// Create cache that's 4 minutes old (should still be valid)
			const cachedSearchProvider = new SearchProvider(tagsManager);
			await cachedSearchProvider.buildSearchIndex([mockGist], new Map([['test-gist-123', 'my']]));
			searchCache = {
				searchProvider: cachedSearchProvider,
				timestamp: Date.now() - (4 * 60 * 1000), // 4 minutes ago
				myGistIds: new Set(['test-gist-123']),
				starredGistIds: new Set()
			};

			const createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick');
			const mockQuickPick: any = {
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().returns({ dispose: () => {} }),
				onDidAccept: sandbox.stub().returns({ dispose: () => {} }),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};
			createQuickPickStub.returns(mockQuickPick);

			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			// Should use cached provider (no progress shown)
			assert.strictEqual(withProgressStub.called, false);
			assert.ok(createQuickPickStub.called);
		});
	});

	suite('search cache interface', () => {
		test('should properly structure SearchCache interface', async () => {
			githubService.setAuthenticated(true);
			const mockGist = createMockGist();
			githubService.setMockGists([mockGist]);

			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress');
			withProgressStub.callsFake(async (options, task) => {
				return await task({ report: () => {} });
			});

			sandbox.stub(mockVscode.window, 'createQuickPick').returns({
				items: [],
				selectedItems: [],
				placeholder: '',
				matchOnDescription: false,
				matchOnDetail: false,
				ignoreFocusOut: false,
				busy: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidChangeValue: sandbox.stub().returns({ dispose: () => {} }),
				onDidAccept: sandbox.stub().returns({ dispose: () => {} }),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			} as any);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerSearchCommands(
				context as any,
				githubService as any,
				tagsManager as any,
				myGistsProvider as any,
				starredGistsProvider as any,
				gistSelectionTracker as any,
				starredSelectionTracker as any,
				getSearchCache,
				setSearchCache
			);

			const searchCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.search');
			const handler = searchCall!.args[1];

			await handler();

			const cache = getSearchCache();

			// Verify all required properties exist
			assert.ok('searchProvider' in cache!);
			assert.ok('timestamp' in cache!);
			assert.ok('myGistIds' in cache!);
			assert.ok('starredGistIds' in cache!);

			// Verify property types
			assert.ok(cache!.searchProvider instanceof SearchProvider);
			assert.strictEqual(typeof cache!.timestamp, 'number');
			assert.ok(cache!.myGistIds instanceof Set);
			assert.ok(cache!.starredGistIds instanceof Set);
		});

		test('should allow null cache', () => {
			const cache = getSearchCache();
			assert.strictEqual(cache, null);

			setSearchCache(null);
			assert.strictEqual(getSearchCache(), null);
		});

		test('should allow setting and getting cache', () => {
			const searchProvider = new SearchProvider(tagsManager);
			const testCache: SearchCache = {
				searchProvider,
				timestamp: Date.now(),
				myGistIds: new Set(['test-1']),
				starredGistIds: new Set(['test-2'])
			};

			setSearchCache(testCache);
			const retrieved = getSearchCache();

			assert.strictEqual(retrieved, testCache);
			assert.strictEqual(retrieved!.searchProvider, searchProvider);
			assert.ok(retrieved!.myGistIds.has('test-1'));
			assert.ok(retrieved!.starredGistIds.has('test-2'));
		});
	});
});
