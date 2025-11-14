import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerTagCommands } from '../../../commands/tags/tagOperations';
import { MockExtensionContext, mockVscode } from '../../mocks/vscode.mock';
import { MockTagsManager, MockGitHubService, MockGistProvider, createMockGist } from '../../mocks/services.mock';
import { GistItem } from '../../../providers/gistItem';
import { Gist } from '../../../githubService';

suite('Tag Operations Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let tagsManager: MockTagsManager;
	let githubService: MockGitHubService;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		tagsManager = new MockTagsManager();
		githubService = new MockGitHubService();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('registerTagCommands', () => {
		test('should register all tag commands', () => {
			registerTagCommands(
				context as any as vscode.ExtensionContext,
				tagsManager as any,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			assert.strictEqual(context.subscriptions.length, 4, 'should register 4 commands');
		});
	});

	suite('addTag command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
		});

		test('should show error when gistItem is null', async () => {
			registerTagCommands(
				context as any as vscode.ExtensionContext,
				tagsManager as any,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			assert.ok(addTagCall, 'addTag command should be registered');

			const handler = addTagCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('Please select a gist to add a tag'));
		});

		test('should show error when gistItem.gist is null', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const gistItem = new GistItem(null);
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('Please select a gist to add a tag'));
		});

		test('should validate tag input and show error for invalid tag', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			// Get the validator function from the showInputBox call
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves('invalid tag!'); // Invalid tag with special chars

			await handler(gistItem);

			// Check that showInputBox was called and get the validator
			assert.ok(showInputBoxStub.called);
			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			// Test validator
			assert.strictEqual(
				validator('invalid tag!'),
				'Tag must contain only alphanumeric characters, hyphens, and underscores'
			);
			assert.strictEqual(validator('valid-tag'), null);
			assert.strictEqual(validator('valid_tag'), null);
			assert.strictEqual(validator('validTag123'), null);
		});

		test('should return when user cancels tag input', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showInputBoxStub.called);
			assert.strictEqual(withProgressStub.called, false);
		});

		test('should successfully add a tag to a gist', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-1' });
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves('react');

			await handler(gistItem);

			assert.ok(withProgressStub.called);
			assert.ok(showInformationMessageStub.calledWith('Tag "react" added to gist. Format: [tag:react]'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);

			// Verify tag was added
			const tags = await tagsManager.getTags(mockGist);
			assert.deepStrictEqual(tags, ['react']);
		});

		test('should normalize tags to lowercase', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-2' });
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves('React');

			await handler(gistItem);

			// Verify tag was normalized to lowercase
			const tags = await tagsManager.getTags(mockGist);
			assert.deepStrictEqual(tags, ['react']);
		});

		test('should handle error when adding duplicate tag', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-3' });
			const gistItem = new GistItem(mockGist);

			// Add tag first time
			showInputBoxStub.resolves('python');
			await handler(gistItem);

			// Try to add same tag again
			showInputBoxStub.resolves('python');
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('Error adding tag: Tag "python" already exists on this gist'));
		});

		test('should handle error when tag manager fails', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves('valid-tag');
			sandbox.stub(tagsManager, 'addTag').rejects(new Error('Network error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('Error adding tag: Network error'));
		});
	});

	suite('removeTag command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
		});

		test('should show error when gistItem is null', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const removeTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.removeTag');
			assert.ok(removeTagCall, 'removeTag command should be registered');

			const handler = removeTagCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('Please select a gist'));
		});

		test('should show message when gist has no tags', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const removeTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.removeTag');
			const handler = removeTagCall!.args[1];

			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledWith('This gist has no tags'));
		});

		test('should return when user cancels tag selection', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const removeTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.removeTag');
			const handler = removeTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-4' });
			const gistItem = new GistItem(mockGist);

			// Add a tag first
			await tagsManager.addTag(mockGist, 'react');

			showQuickPickStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showQuickPickStub.called);
			assert.strictEqual(withProgressStub.called, false);
		});

		test('should successfully remove a tag from a gist', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const removeTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.removeTag');
			const handler = removeTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-5' });
			const gistItem = new GistItem(mockGist);

			// Add tags first
			await tagsManager.addTag(mockGist, 'react');
			await tagsManager.addTag(mockGist, 'javascript');

			showQuickPickStub.resolves('react');

			await handler(gistItem);

			assert.ok(withProgressStub.called);
			assert.ok(showInformationMessageStub.calledWith('Tag "react" removed from gist'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);

			// Verify tag was removed
			const tags = await tagsManager.getTags(mockGist);
			assert.deepStrictEqual(tags, ['javascript']);
		});

		test('should display all tags in quick pick', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const removeTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.removeTag');
			const handler = removeTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-6' });
			const gistItem = new GistItem(mockGist);

			// Add multiple tags
			await tagsManager.addTag(mockGist, 'react');
			await tagsManager.addTag(mockGist, 'javascript');
			await tagsManager.addTag(mockGist, 'frontend');

			showQuickPickStub.resolves('javascript');

			await handler(gistItem);

			// Verify quick pick was called with all tags
			const quickPickArgs = showQuickPickStub.firstCall.args;
			assert.deepStrictEqual(quickPickArgs[0], ['react', 'javascript', 'frontend']);
			assert.strictEqual(quickPickArgs[1].placeHolder, 'Select a tag to remove');
		});

		test('should handle error when removing tag', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const removeTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.removeTag');
			const handler = removeTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-7' });
			const gistItem = new GistItem(mockGist);

			await tagsManager.addTag(mockGist, 'react');

			showQuickPickStub.resolves('react');
			sandbox.stub(tagsManager, 'removeTag').rejects(new Error('Network error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('Error removing tag: Network error'));
		});
	});

	suite('filterByTag command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let createQuickPickStub: sinon.SinonStub;
		let executeCommandStub: sinon.SinonStub;
		let mockQuickPick: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');

			// Create mock QuickPick
			mockQuickPick = {
				items: [],
				title: '',
				canSelectMany: false,
				onDidChangeSelection: sandbox.stub().returns({ dispose: () => {} }),
				onDidHide: sandbox.stub().returns({ dispose: () => {} }),
				show: sandbox.stub(),
				hide: sandbox.stub(),
				dispose: sandbox.stub()
			};

			createQuickPickStub = sandbox.stub(mockVscode.window, 'createQuickPick').returns(mockQuickPick);
		});

		test('should prompt for authentication if not authenticated', async () => {
			githubService.setAuthenticated(false);
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			showErrorMessageStub.resolves('Sign in with GitHub');

			await handler();

			assert.ok(showErrorMessageStub.calledWith(
				'You need to sign in with GitHub to filter by tag.',
				'Sign in with GitHub'
			));
			assert.ok(executeCommandStub.calledWith('gist-editor.setupToken'));
		});

		test('should show message when no tags exist', async () => {
			githubService.setAuthenticated(true);
			githubService.setMockGists([]);
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			await handler();

			assert.ok(showInformationMessageStub.calledWith(
				'No tags found. Add tags to your gists first. Format: [tag:tagname]'
			));
		});

		test('should return when user cancels tag selection', async () => {
			githubService.setAuthenticated(true);

			const mockGist1 = createMockGist({ id: 'gist-1' });
			await tagsManager.addTag(mockGist1, 'react');
			githubService.setMockGists([mockGist1]);

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			showQuickPickStub.resolves(undefined); // User cancels

			await handler();

			assert.ok(showQuickPickStub.called);
			assert.strictEqual(createQuickPickStub.called, false);
		});

		test('should show message when no gists have selected tag', async () => {
			githubService.setAuthenticated(true);

			const mockGist1 = createMockGist({ id: 'gist-1' });
			await tagsManager.addTag(mockGist1, 'react');
			githubService.setMockGists([mockGist1]);

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			showQuickPickStub.resolves('python'); // Tag that doesn't exist on any gist

			await handler();

			assert.ok(showInformationMessageStub.calledWith('No gists found with tag "[tag:python]"'));
		});

		test('should create quick pick with gists for selected tag', async () => {
			githubService.setAuthenticated(true);

			const mockGist1 = createMockGist({ id: 'gist-1', description: 'React Component' });
			const mockGist2 = createMockGist({ id: 'gist-2', description: 'React Hook' });
			const mockGist3 = createMockGist({ id: 'gist-3', description: 'Python Script' });

			await tagsManager.addTag(mockGist1, 'react');
			await tagsManager.addTag(mockGist2, 'react');
			await tagsManager.addTag(mockGist3, 'python');

			githubService.setMockGists([mockGist1, mockGist2, mockGist3]);

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			showQuickPickStub.resolves('react');

			await handler();

			// Verify quick pick was created and shown
			assert.ok(createQuickPickStub.called);
			assert.strictEqual(mockQuickPick.title, 'Gists with tag "[tag:react]" (2)');
			assert.strictEqual(mockQuickPick.items.length, 2);
			assert.ok(mockQuickPick.show.called);
		});

		test('should display all unique tags from all gists', async () => {
			githubService.setAuthenticated(true);

			const mockGist1 = createMockGist({ id: 'gist-1' });
			const mockGist2 = createMockGist({ id: 'gist-2' });

			await tagsManager.addTag(mockGist1, 'react');
			await tagsManager.addTag(mockGist1, 'javascript');
			await tagsManager.addTag(mockGist2, 'python');
			await tagsManager.addTag(mockGist2, 'javascript'); // Duplicate

			githubService.setMockGists([mockGist1, mockGist2]);

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			showQuickPickStub.resolves('react');

			await handler();

			// Verify unique tags were shown (sorted)
			const quickPickArgs = showQuickPickStub.firstCall.args;
			assert.deepStrictEqual(quickPickArgs[0], ['javascript', 'python', 'react']);
		});

		test('should handle error when filtering by tag', async () => {
			githubService.setAuthenticated(true);
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			sandbox.stub(githubService, 'getMyGists').rejects(new Error('API error'));

			await handler();

			assert.ok(showErrorMessageStub.calledWith('Error filtering by tag: API error'));
		});

		test('should open gist when selected from filtered list', async () => {
			githubService.setAuthenticated(true);

			const mockGist1 = createMockGist({ id: 'gist-1', description: 'Test Gist' });
			await tagsManager.addTag(mockGist1, 'react');

			githubService.setMockGists([mockGist1]);

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const filterByTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.filterByTag');
			const handler = filterByTagCall!.args[1];

			showQuickPickStub.resolves('react');

			await handler();

			// Simulate user selecting a gist
			const onDidChangeSelectionHandler = mockQuickPick.onDidChangeSelection.firstCall.args[0];
			await onDidChangeSelectionHandler([mockQuickPick.items[0]]);

			assert.ok(executeCommandStub.calledWith('gist-editor.openGist', mockGist1));
			assert.ok(mockQuickPick.hide.called);
		});
	});

	suite('clearTags command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
		});

		test('should show error when gistItem is null', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			assert.ok(clearTagsCall, 'clearTags command should be registered');

			const handler = clearTagsCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('Please select a gist'));
		});

		test('should show message when gist has no tags', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			const handler = clearTagsCall!.args[1];

			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledWith('This gist has no tags'));
		});

		test('should return when user cancels confirmation', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			const handler = clearTagsCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-8' });
			const gistItem = new GistItem(mockGist);

			// Add tags first
			await tagsManager.addTag(mockGist, 'react');
			await tagsManager.addTag(mockGist, 'javascript');

			showWarningMessageStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showWarningMessageStub.called);
			assert.strictEqual(withProgressStub.called, false);

			// Verify tags still exist
			const tags = await tagsManager.getTags(mockGist);
			assert.strictEqual(tags.length, 2);
		});

		test('should show confirmation dialog with tag count', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			const handler = clearTagsCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-9' });
			const gistItem = new GistItem(mockGist);

			// Add tags first
			await tagsManager.addTag(mockGist, 'react');
			await tagsManager.addTag(mockGist, 'javascript');
			await tagsManager.addTag(mockGist, 'frontend');

			showWarningMessageStub.resolves('Clear All');

			await handler(gistItem);

			// Verify warning message shows correct count
			const warningCall = showWarningMessageStub.firstCall;
			assert.strictEqual(warningCall.args[0], 'Clear 3 tag(s) from this gist?');
			assert.deepStrictEqual(warningCall.args[1], { modal: true });
			assert.strictEqual(warningCall.args[2], 'Clear All');
		});

		test('should successfully clear all tags from a gist', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			const handler = clearTagsCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-10' });
			const gistItem = new GistItem(mockGist);

			// Add tags first
			await tagsManager.addTag(mockGist, 'react');
			await tagsManager.addTag(mockGist, 'javascript');

			showWarningMessageStub.resolves('Clear All');

			await handler(gistItem);

			assert.ok(withProgressStub.called);
			assert.ok(showInformationMessageStub.calledWith('All tags cleared from gist'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);

			// Verify all tags were cleared
			const tags = await tagsManager.getTags(mockGist);
			assert.strictEqual(tags.length, 0);
		});

		test('should handle error when clearing tags', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			const handler = clearTagsCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-11' });
			const gistItem = new GistItem(mockGist);

			await tagsManager.addTag(mockGist, 'react');

			showWarningMessageStub.resolves('Clear All');
			sandbox.stub(tagsManager, 'clearTags').rejects(new Error('Network error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('Error clearing tags: Network error'));
		});

		test('should not clear when user clicks outside modal', async () => {
			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const clearTagsCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.clearTags');
			const handler = clearTagsCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-12' });
			const gistItem = new GistItem(mockGist);

			await tagsManager.addTag(mockGist, 'react');

			showWarningMessageStub.resolves('Cancel'); // User clicked Cancel button

			await handler(gistItem);

			assert.strictEqual(withProgressStub.called, false);

			// Verify tags still exist
			const tags = await tagsManager.getTags(mockGist);
			assert.strictEqual(tags.length, 1);
		});
	});

	suite('Tag validation', () => {
		test('should accept valid tags', () => {
			assert.strictEqual(tagsManager.isValidTag('react'), true);
			assert.strictEqual(tagsManager.isValidTag('React'), true);
			assert.strictEqual(tagsManager.isValidTag('react-native'), true);
			assert.strictEqual(tagsManager.isValidTag('react_native'), true);
			assert.strictEqual(tagsManager.isValidTag('tag123'), true);
			assert.strictEqual(tagsManager.isValidTag('123tag'), true);
		});

		test('should reject invalid tags', () => {
			assert.strictEqual(tagsManager.isValidTag('react native'), false);
			assert.strictEqual(tagsManager.isValidTag('react!'), false);
			assert.strictEqual(tagsManager.isValidTag('react@home'), false);
			assert.strictEqual(tagsManager.isValidTag('react.js'), false);
			assert.strictEqual(tagsManager.isValidTag('react#'), false);
			assert.strictEqual(tagsManager.isValidTag(''), false);
		});
	});

	suite('Provider refresh behavior', () => {
		test('should refresh both providers after successful add tag', async () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist({ id: 'test-gist-refresh' });
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves('test-tag' as any);

			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should not refresh providers when add tag is cancelled', async () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0);
		});

		test('should not refresh providers when add tag fails', async () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			sandbox.stub(mockVscode.window, 'showErrorMessage');
			sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});

			registerTagCommands(
			context as any as vscode.ExtensionContext,
			tagsManager as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);

			const addTagCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addTag');
			const handler = addTagCall!.args[1];

			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			showInputBoxStub.resolves('test-tag' as any);
			sandbox.stub(tagsManager, 'addTag').rejects(new Error('Test error'));

			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0);
		});
	});
});
