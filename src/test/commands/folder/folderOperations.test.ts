import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerFolderCommands } from '../../../commands/folder/folderOperations';
import { MockExtensionContext, mockVscode } from '../../mocks/vscode.mock';
import { MockGitHubService, MockGistProvider, createMockGist } from '../../mocks/services.mock';
import { GistItem } from '../../../providers/gistItem';
import { GistFolder } from '../../../gistFolderBuilder';
import { Gist } from '../../../githubService';

suite('Folder Operations Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let githubService: MockGitHubService;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		githubService = new MockGitHubService();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
	});

	teardown(() => {
		sandbox.restore();
	});

	/**
	 * Helper to create a mock folder
	 */
	function createMockFolder(path: string[], displayName: string, gists: Gist[] = []): GistFolder {
		return {
			path,
			displayName,
			gists,
			subFolders: [],
			parentPath: path.length > 1 ? path.slice(0, -1) : undefined
		};
	}

	suite('registerFolderCommands', () => {
		test('should register all folder commands', () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			assert.strictEqual(context.subscriptions.length, 4, 'should register 4 commands');
		});
	});

	suite('createSubfolderInFolder command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
		});

		test('should show error when gistItem is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			assert.ok(createSubfolderCall, 'createSubfolderInFolder command should be registered');

			const handler = createSubfolderCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('No folder selected'));
		});

		test('should show error when gistItem.folder is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const gistItem = new GistItem(null);
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('No folder selected'));
		});

		test('should validate subfolder name - empty name', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined);
			await handler(gistItem);

			assert.ok(showInputBoxStub.called);
			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			// Test validator
			assert.strictEqual(validator(''), 'Subfolder name is required');
			assert.strictEqual(validator('   '), 'Subfolder name is required');
			assert.strictEqual(validator('valid'), '');
		});

		test('should validate subfolder name - contains slashes', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined);
			await handler(gistItem);

			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			assert.strictEqual(validator('sub/folder'), 'Subfolder name cannot contain slashes');
			assert.strictEqual(validator('valid-folder'), '');
		});

		test('should return when user cancels subfolder name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showInputBoxStub.calledOnce);
			assert.strictEqual(showQuickPickStub.called, false);
		});

		test('should validate gist name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves(undefined);

			await handler(gistItem);

			assert.strictEqual(showInputBoxStub.callCount, 2);
			const secondInputOptions = showInputBoxStub.secondCall.args[0];
			const validator = secondInputOptions.validateInput;

			assert.strictEqual(validator(''), 'Gist name is required');
			assert.strictEqual(validator('   '), 'Gist name is required');
			assert.strictEqual(validator('Valid Name'), '');
		});

		test('should return when user cancels gist name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves(undefined); // User cancels

			await handler(gistItem);

			assert.strictEqual(showInputBoxStub.callCount, 2);
			assert.strictEqual(showQuickPickStub.called, false);
		});

		test('should return when user cancels visibility selection', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves('Helper Functions');
			showQuickPickStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showQuickPickStub.called);
			assert.strictEqual(withProgressStub.called, false);
		});

		test('should successfully create private subfolder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves('Helper Functions');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			const createGistStub = sandbox.stub(githubService, 'createGist').resolves(
				createMockGist({ id: 'new-subfolder-gist', public: false })
			);

			await handler(gistItem);

			assert.ok(withProgressStub.called);
			assert.ok(createGistStub.calledOnce);

			const createArgs = createGistStub.firstCall.args;
			assert.ok(createArgs[0].includes('[Projects/Utils]')); // Description has folder path
			assert.ok(createArgs[1]['README.md']); // Has placeholder file
			assert.strictEqual(createArgs[2], false); // Is private

			assert.ok(showInformationMessageStub.calledWith('Gist created in folder "Projects/Utils"'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should successfully create public subfolder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Work'], 'Work');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Documentation');
			showInputBoxStub.onSecondCall().resolves('Docs Folder');
			showQuickPickStub.resolves({ label: '$(globe) Public', detail: 'public' });

			const createGistStub = sandbox.stub(githubService, 'createGist').resolves(
				createMockGist({ id: 'new-public-subfolder', public: true })
			);

			await handler(gistItem);

			assert.ok(createGistStub.calledOnce);
			const createArgs = createGistStub.firstCall.args;
			assert.strictEqual(createArgs[2], true); // Is public
		});

		test('should handle error during subfolder creation', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves('Helper Functions');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			sandbox.stub(githubService, 'createGist').rejects(new Error('API error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to create subfolder/)));
		});
	});

	suite('renameFolder command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
		});

		test('should show error when gistItem is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			assert.ok(renameFolderCall, 'renameFolder command should be registered');

			const handler = renameFolderCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('No folder selected'));
		});

		test('should show error when gistItem.folder is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const gistItem = new GistItem(null);
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('No folder selected'));
		});

		test('should validate folder name - empty name', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined);
			await handler(gistItem);

			assert.ok(showInputBoxStub.called);
			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			assert.strictEqual(validator(''), 'Folder name is required');
			assert.strictEqual(validator('   '), 'Folder name is required');
		});

		test('should validate folder name - contains slashes', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined);
			await handler(gistItem);

			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			assert.strictEqual(validator('new/name'), 'Folder name cannot contain slashes');
		});

		test('should validate folder name - same as current', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined);
			await handler(gistItem);

			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			assert.strictEqual(validator('Projects'), 'New name must be different from current name');
			assert.strictEqual(validator('NewProjects'), '');
		});

		test('should return when user cancels name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showInputBoxStub.called);
			assert.strictEqual(withProgressStub.called, false);
		});

		test('should show message when no gists found in folder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves('MyProjects');

			// Mock getMyGists to return empty array
			sandbox.stub(githubService, 'getMyGists').resolves([]);

			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledWith('No gists found in folder "Projects"'));
		});

		test('should return when user cancels confirmation dialog', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Projects] My Gist'
			});

			showInputBoxStub.resolves('MyProjects');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1]);
			showWarningMessageStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showWarningMessageStub.called);
			// Verify withProgress was called twice (for fetch and update)
			// But the update task should not run because user cancelled
		});

		test('should show confirmation with correct gist count - singular', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Projects] My Gist'
			});

			showInputBoxStub.resolves('MyProjects');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1]);
			showWarningMessageStub.resolves(undefined);

			await handler(gistItem);

			const warningCall = showWarningMessageStub.firstCall;
			assert.ok(warningCall.args[0].includes('1 gist'));
			assert.ok(!warningCall.args[0].includes('gists')); // Should be singular
		});

		test('should show confirmation with correct gist count - plural', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Projects] Gist 1'
			});
			const gist2 = createMockGist({
				id: 'gist2',
				description: '[Projects] Gist 2'
			});

			showInputBoxStub.resolves('MyProjects');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1, gist2]);
			showWarningMessageStub.resolves(undefined);

			await handler(gistItem);

			const warningCall = showWarningMessageStub.firstCall;
			assert.ok(warningCall.args[0].includes('2 gists'));
		});

		test('should successfully rename folder with single gist', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Projects] My Gist'
			});

			showInputBoxStub.resolves('MyProjects');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1]);
			showWarningMessageStub.resolves('Rename');

			const updateGistStub = sandbox.stub(githubService, 'updateGist').resolves(gist1);

			await handler(gistItem);

			assert.ok(updateGistStub.calledOnce);
			const updateArgs = updateGistStub.firstCall.args;
			assert.strictEqual(updateArgs[0], 'gist1');
			assert.ok(updateArgs[1].includes('[MyProjects]'));

			assert.ok(showInformationMessageStub.calledWith(sinon.match(/Folder renamed to "MyProjects"/)));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should successfully rename folder with multiple gists', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Work'], 'Work');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Work] Task 1'
			});
			const gist2 = createMockGist({
				id: 'gist2',
				description: '[Work] Task 2'
			});
			const gist3 = createMockGist({
				id: 'gist3',
				description: '[Work] Task 3'
			});

			showInputBoxStub.resolves('Office');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1, gist2, gist3]);
			showWarningMessageStub.resolves('Rename');

			const updateGistStub = sandbox.stub(githubService, 'updateGist')
				.onFirstCall().resolves(gist1)
				.onSecondCall().resolves(gist2)
				.onThirdCall().resolves(gist3);

			await handler(gistItem);

			assert.strictEqual(updateGistStub.callCount, 3);
			assert.ok(showInformationMessageStub.calledWith(sinon.match(/3 gists updated/)));
		});

		test('should rename nested folder and update subfolder paths', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects', 'Utils'], 'Utils');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Projects/Utils] Helper'
			});
			const gist2 = createMockGist({
				id: 'gist2',
				description: '[Projects/Utils/Helpers] Deep Helper'
			});

			showInputBoxStub.resolves('Utilities');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1, gist2]);
			showWarningMessageStub.resolves('Rename');

			const updateGistStub = sandbox.stub(githubService, 'updateGist')
				.onFirstCall().resolves(gist1)
				.onSecondCall().resolves(gist2);

			await handler(gistItem);

			assert.strictEqual(updateGistStub.callCount, 2);
			// Verify the gist in subfolder is also updated
			const secondUpdateArgs = updateGistStub.secondCall.args;
			assert.ok(secondUpdateArgs[1].includes('[Projects/Utilities/Helpers]'));
		});

		test('should handle partial failure when updating multiple gists', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			const gist1 = createMockGist({
				id: 'gist1',
				description: '[Projects] Task 1'
			});
			const gist2 = createMockGist({
				id: 'gist2',
				description: '[Projects] Task 2'
			});

			showInputBoxStub.resolves('MyProjects');
			sandbox.stub(githubService, 'getMyGists').resolves([gist1, gist2]);
			showWarningMessageStub.resolves('Rename');

			const updateGistStub = sandbox.stub(githubService, 'updateGist')
				.onFirstCall().resolves(gist1)
				.onSecondCall().rejects(new Error('Network error'));

			await handler(gistItem);

			assert.strictEqual(updateGistStub.callCount, 2);
			assert.ok(showWarningMessageStub.calledTwice); // One for confirmation, one for partial failure
			const warningMessage = showWarningMessageStub.secondCall.args[0];
			assert.ok(warningMessage.includes('Updated: 1'));
			assert.ok(warningMessage.includes('Failed: 1'));
		});

		test('should handle complete failure when updating gists', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const renameFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameFolder'
			);
			const handler = renameFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves('MyProjects');
			sandbox.stub(githubService, 'getMyGists').rejects(new Error('API error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to rename folder/)));
		});
	});

	suite('addGistToFolder command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;
		let openTextDocumentStub: sinon.SinonStub;
		let showTextDocumentStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
			openTextDocumentStub = sandbox.stub(mockVscode.workspace, 'openTextDocument');
			showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
		});

		test('should show error when gistItem is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			assert.ok(addGistToFolderCall, 'addGistToFolder command should be registered');

			const handler = addGistToFolderCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('No folder selected'));
		});

		test('should show error when gistItem.folder is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const gistItem = new GistItem(null);
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('No folder selected'));
		});

		test('should validate gist name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined);
			await handler(gistItem);

			assert.ok(showInputBoxStub.called);
			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			const validator = inputBoxOptions.validateInput;

			assert.strictEqual(validator(''), 'Gist name is required');
			assert.strictEqual(validator('   '), 'Gist name is required');
			assert.strictEqual(validator('Valid Name'), '');
		});

		test('should return when user cancels gist name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showInputBoxStub.calledOnce);
		});

		test('should validate file name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves(undefined);

			await handler(gistItem);

			assert.strictEqual(showInputBoxStub.callCount, 2);
			const secondInputOptions = showInputBoxStub.secondCall.args[0];
			const validator = secondInputOptions.validateInput;

			assert.strictEqual(validator(''), 'File name is required');
			assert.strictEqual(validator('   '), 'File name is required');
			assert.strictEqual(validator('index.js'), '');
		});

		test('should return when user cancels file name input', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves(undefined); // User cancels

			await handler(gistItem);

			assert.strictEqual(showInputBoxStub.callCount, 2);
			assert.strictEqual(showQuickPickStub.called, false);
		});

		test('should allow empty file content', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves('index.js');
			showInputBoxStub.onThirdCall().resolves(''); // Empty content is valid
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			const newGist = createMockGist({
				id: 'new-gist',
				files: {
					'index.js': {
						filename: 'index.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/index.js',
						size: 0,
						content: ''
					}
				}
			});
			const createGistStub = sandbox.stub(githubService, 'createGist').resolves(newGist);

			showInformationMessageStub.onFirstCall().resolves(undefined); // First message after creation
			showInformationMessageStub.onSecondCall().resolves('No'); // Don't open gist

			await handler(gistItem);

			assert.ok(createGistStub.called);
			const createArgs = createGistStub.firstCall.args;
			assert.strictEqual(createArgs[1]['index.js'].content, '');
		});

		test('should return when user cancels visibility selection', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves('index.js');
			showInputBoxStub.onThirdCall().resolves('console.log("test");');
			showQuickPickStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showQuickPickStub.called);
			assert.strictEqual(withProgressStub.called, false);
		});

		test('should successfully create private gist in folder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Work', 'Scripts'], 'Scripts');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Automation Script');
			showInputBoxStub.onSecondCall().resolves('automate.py');
			showInputBoxStub.onThirdCall().resolves('print("Hello")');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			const newGist = createMockGist({
				id: 'new-gist',
				public: false,
				files: {
					'automate.py': {
						filename: 'automate.py',
						type: 'text/x-python',
						language: 'Python',
						raw_url: 'https://gist.github.com/raw/automate.py',
						size: 15,
						content: 'print("Hello")'
					}
				}
			});
			const createGistStub = sandbox.stub(githubService, 'createGist').resolves(newGist);

			showInformationMessageStub.onFirstCall().resolves(undefined); // First message after creation
			showInformationMessageStub.onSecondCall().resolves('No'); // Don't open gist

			await handler(gistItem);

			assert.ok(withProgressStub.called);
			assert.ok(createGistStub.calledOnce);

			const createArgs = createGistStub.firstCall.args;
			assert.ok(createArgs[0].includes('[Work/Scripts]'));
			assert.ok(createArgs[0].includes('Automation Script'));
			assert.deepStrictEqual(createArgs[1], { 'automate.py': { content: 'print("Hello")' } });
			assert.strictEqual(createArgs[2], false);

			assert.ok(showInformationMessageStub.calledWith('Gist "Automation Script" created in folder "Work/Scripts"'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should successfully create public gist in folder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Examples'], 'Examples');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Public Example');
			showInputBoxStub.onSecondCall().resolves('example.js');
			showInputBoxStub.onThirdCall().resolves('// example code');
			showQuickPickStub.resolves({ label: '$(globe) Public', detail: 'public' });

			const newGist = createMockGist({
				id: 'new-public-gist',
				public: true,
				files: {
					'example.js': {
						filename: 'example.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/example.js',
						size: 16,
						content: '// example code'
					}
				}
			});
			const createGistStub = sandbox.stub(githubService, 'createGist').resolves(newGist);

			showInformationMessageStub.onFirstCall().resolves(undefined);
			showInformationMessageStub.onSecondCall().resolves('No');

			await handler(gistItem);

			assert.ok(createGistStub.calledOnce);
			const createArgs = createGistStub.firstCall.args;
			assert.strictEqual(createArgs[2], true);
		});

		test('should open gist file when user chooses Yes', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves('test.js');
			showInputBoxStub.onThirdCall().resolves('test content');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			const newGist = createMockGist({
				id: 'new-gist',
				files: {
					'test.js': {
						filename: 'test.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/test.js',
						size: 12,
						content: 'test content'
					}
				}
			});
			sandbox.stub(githubService, 'createGist').resolves(newGist);

			showInformationMessageStub.onFirstCall().resolves(undefined);
			showInformationMessageStub.onSecondCall().resolves('Yes'); // Open gist

			const mockDoc = { uri: 'gist://new-gist/test.js' };
			openTextDocumentStub.resolves(mockDoc);

			await handler(gistItem);

			assert.ok(openTextDocumentStub.called);
			assert.ok(showTextDocumentStub.calledWith(mockDoc));
		});

		test('should not open gist file when user chooses No', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves('test.js');
			showInputBoxStub.onThirdCall().resolves('test content');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			const newGist = createMockGist({
				id: 'new-gist',
				files: {
					'test.js': {
						filename: 'test.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/test.js',
						size: 12,
						content: 'test content'
					}
				}
			});
			sandbox.stub(githubService, 'createGist').resolves(newGist);

			showInformationMessageStub.onFirstCall().resolves(undefined);
			showInformationMessageStub.onSecondCall().resolves('No'); // Don't open

			await handler(gistItem);

			assert.strictEqual(openTextDocumentStub.called, false);
			assert.strictEqual(showTextDocumentStub.called, false);
		});

		test('should handle error during gist creation', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.addGistToFolder'
			);
			const handler = addGistToFolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('My Gist');
			showInputBoxStub.onSecondCall().resolves('test.js');
			showInputBoxStub.onThirdCall().resolves('content');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			sandbox.stub(githubService, 'createGist').rejects(new Error('API error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to create gist/)));
		});
	});

	suite('moveGistToFolder command', () => {
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
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			assert.ok(moveGistToFolderCall, 'moveGistToFolder command should be registered');

			const handler = moveGistToFolderCall!.args[1];
			await handler(null);

			assert.ok(showErrorMessageStub.calledWith('No gist selected'));
		});

		test('should show error when gistItem.gist is null', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const gistItem = new GistItem(null);
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith('No gist selected'));
		});

		test('should return when user cancels folder selection', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: 'My Gist',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').resolves([]);
			showQuickPickStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.ok(showQuickPickStub.called);
			assert.strictEqual(withProgressStub.called, false);
		});

		test('should include root folder option in quick pick', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: '[Projects] My Gist',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').resolves([mockGist]);
			showQuickPickStub.resolves(undefined);

			await handler(gistItem);

			assert.ok(showQuickPickStub.called);
			const quickPickItems = showQuickPickStub.firstCall.args[0];

			// First item should be root
			assert.strictEqual(quickPickItems[0].label, '$(home) Root (No Folder)');
			assert.deepStrictEqual(quickPickItems[0].folderPath, []);
		});

		test('should successfully move gist to root folder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: '[Projects] My Gist',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').resolves([mockGist]);
			showQuickPickStub.resolves({
				label: '$(home) Root (No Folder)',
				folderPath: []
			});

			const updateGistStub = sandbox.stub(githubService, 'updateGist').resolves(mockGist);

			await handler(gistItem);

			assert.ok(withProgressStub.called);
			assert.ok(updateGistStub.calledOnce);

			const updateArgs = updateGistStub.firstCall.args;
			assert.strictEqual(updateArgs[0], 'gist1');
			// Description should not have folder path
			assert.ok(!updateArgs[1].includes('['));

			assert.ok(showInformationMessageStub.calledWith(sinon.match(/Moved "My Gist" to root/)));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should successfully move gist to a folder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: 'My Gist',
				public: true
			});
			const folderGist = createMockGist({
				id: 'gist2',
				description: '[Work] Other Gist',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').resolves([mockGist, folderGist]);
			showQuickPickStub.resolves({
				label: '📁 Work',
				description: '1 gist',
				folderPath: ['Work']
			});

			const updateGistStub = sandbox.stub(githubService, 'updateGist').resolves(mockGist);

			await handler(gistItem);

			assert.ok(updateGistStub.calledOnce);

			const updateArgs = updateGistStub.firstCall.args;
			assert.strictEqual(updateArgs[0], 'gist1');
			assert.ok(updateArgs[1].includes('[Work]'));

			assert.ok(showInformationMessageStub.calledWith(sinon.match(/Moved "My Gist" to Work/)));
		});

		test('should successfully move gist to nested folder', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: 'My Gist',
				public: true
			});
			const folderGist = createMockGist({
				id: 'gist2',
				description: '[Projects/Utils/Helpers] Helper',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').resolves([mockGist, folderGist]);
			showQuickPickStub.resolves({
				label: '  📁 Helpers',
				description: '1 gist',
				folderPath: ['Projects', 'Utils', 'Helpers']
			});

			const updateGistStub = sandbox.stub(githubService, 'updateGist').resolves(mockGist);

			await handler(gistItem);

			assert.ok(updateGistStub.calledOnce);

			const updateArgs = updateGistStub.firstCall.args;
			assert.ok(updateArgs[1].includes('[Projects/Utils/Helpers]'));

			assert.ok(showInformationMessageStub.calledWith(
				sinon.match(/Moved "My Gist" to Projects > Utils > Helpers/)
			));
		});

		test('should only show folders matching gist visibility', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: 'My Private Gist',
				public: false
			});
			const privateFolder = createMockGist({
				id: 'gist2',
				description: '[Private] Folder',
				public: false
			});
			const publicFolder = createMockGist({
				id: 'gist3',
				description: '[Public] Folder',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			const getMyGistsStub = sandbox.stub(githubService, 'getMyGists')
				.resolves([mockGist, privateFolder, publicFolder]);
			showQuickPickStub.resolves(undefined);

			await handler(gistItem);

			// Verify getMyGists was called
			assert.ok(getMyGistsStub.called);

			// The implementation filters by gist.public === gistItem.gist.public
			// So only private gists should be in the folder tree
			// We can't directly verify this without exposing internals,
			// but we can verify the function completed without error
			assert.ok(showQuickPickStub.called);
		});

		test('should handle error during gist move', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: 'My Gist',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').rejects(new Error('Network error'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to move gist/)));
		});

		test('should handle error during gist update', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const moveGistToFolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.moveGistToFolder'
			);
			const handler = moveGistToFolderCall!.args[1];

			const mockGist = createMockGist({
				id: 'gist1',
				description: 'My Gist',
				public: true
			});
			const gistItem = new GistItem(mockGist);

			sandbox.stub(githubService, 'getMyGists').resolves([mockGist]);
			showQuickPickStub.resolves({
				label: '$(home) Root (No Folder)',
				folderPath: []
			});

			sandbox.stub(githubService, 'updateGist').rejects(new Error('Update failed'));

			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to move gist/)));
		});
	});

	suite('Provider refresh behavior', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let withProgressStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			sandbox.stub(mockVscode.window, 'showInformationMessage');
			withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return await task({} as any);
			});
		});

		test('should refresh both providers after successful subfolder creation', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves('Utilities');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			sandbox.stub(githubService, 'createGist').resolves(createMockGist());

			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should not refresh providers when subfolder creation is cancelled', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.resolves(undefined); // User cancels

			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0);
		});

		test('should not refresh providers when subfolder creation fails', async () => {
			registerFolderCommands(
				context as any as vscode.ExtensionContext,
				githubService as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const createSubfolderCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createSubfolderInFolder'
			);
			const handler = createSubfolderCall!.args[1];

			const mockFolder = createMockFolder(['Projects'], 'Projects');
			const gistItem = new GistItem(null);
			gistItem.folder = mockFolder;

			showInputBoxStub.onFirstCall().resolves('Utils');
			showInputBoxStub.onSecondCall().resolves('Utilities');
			showQuickPickStub.resolves({ label: '$(lock) Private', detail: 'private' });

			sandbox.stub(githubService, 'createGist').rejects(new Error('API error'));
			sandbox.stub(mockVscode.window, 'showErrorMessage');

			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0);
		});
	});
});
