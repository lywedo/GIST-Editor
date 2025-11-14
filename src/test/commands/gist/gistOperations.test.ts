import * as assert from 'assert';
import * as sinon from 'sinon';
import { registerGistCommands } from '../../../commands/gist/gistOperations';
import { MockExtensionContext, mockVscode } from '../../mocks/vscode.mock';
import { MockGitHubService, MockGistProvider, createMockGist } from '../../mocks/services.mock';
import { GistItem } from '../../../providers/gistItem';

suite('Gist Operations Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let githubService: MockGitHubService;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;

	/**
	 * Helper function to register gist commands with proper type casting
	 */
	const registerCommands = () => {
		registerGistCommands(
			context as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any
		);
	};

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

	suite('Command Registration', () => {
		test('should register all gist operation commands', () => {
			registerCommands();

			// Should register 11 commands:
			// createGist, createGistFromFile, createGistFromSelection, openGist, openGistFile,
			// saveGist, deleteGist, renameGist, toggleStarGist, viewGistHistory, openInGitHub
			assert.strictEqual(context.subscriptions.length, 11);
		});

		test('should register createGist command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			assert.ok(createGistCall, 'createGist command should be registered');
		});

		test('should register createGistFromFile command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const createGistFromFileCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromFile'
			);
			assert.ok(createGistFromFileCall, 'createGistFromFile command should be registered');
		});

		test('should register createGistFromSelection command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const createGistFromSelectionCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromSelection'
			);
			assert.ok(createGistFromSelectionCall, 'createGistFromSelection command should be registered');
		});

		test('should register openGist command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const openGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGist'
			);
			assert.ok(openGistCall, 'openGist command should be registered');
		});

		test('should register openGistFile command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const openGistFileCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGistFile'
			);
			assert.ok(openGistFileCall, 'openGistFile command should be registered');
		});

		test('should register saveGist command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const saveGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.saveGist'
			);
			assert.ok(saveGistCall, 'saveGist command should be registered');
		});

		test('should register deleteGist command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const deleteGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.deleteGist'
			);
			assert.ok(deleteGistCall, 'deleteGist command should be registered');
		});

		test('should register renameGist command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const renameGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameGist'
			);
			assert.ok(renameGistCall, 'renameGist command should be registered');
		});

		test('should register toggleStarGist command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const toggleStarGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.toggleStarGist'
			);
			assert.ok(toggleStarGistCall, 'toggleStarGist command should be registered');
		});

		test('should register viewGistHistory command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			assert.ok(viewGistHistoryCall, 'viewGistHistory command should be registered');
		});

		test('should register openInGitHub command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const openInGitHubCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openInGitHub'
			);
			assert.ok(openInGitHubCall, 'openInGitHub command should be registered');
		});
	});

	suite('createGist Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let activeTextEditor: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			// Mock active text editor
			activeTextEditor = {
				document: {
					getText: () => 'console.log("test");',
					fileName: '/path/to/test.js',
					uri: { scheme: 'file' },
					selection: new (class {
						isEmpty = false;
					})()
				},
				selection: {
					isEmpty: false
				}
			};
		});

		test('should prompt user to authenticate if not authenticated', async () => {
			githubService.setAuthenticated(false);
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('Not authenticated'));
			showErrorMessageStub.resolves(undefined); // User cancels

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('sign in with GitHub'));
		});

		test('should execute setupToken command when user clicks Sign in with GitHub', async () => {
			const executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');
			githubService.setAuthenticated(false);
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('Not authenticated'));
			showErrorMessageStub.resolves('Sign in with GitHub');

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.ok(executeCommandStub.calledWith('gist-editor.setupToken'));
		});

		test('should show creation method options when authenticated', async () => {
			githubService.setAuthenticated(true);
			showQuickPickStub.resolves(undefined); // User cancels

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.ok(showQuickPickStub.calledOnce);
			const options = showQuickPickStub.firstCall.args[0];
			assert.strictEqual(options.length, 4); // current-file, selection, empty, multi-file
			assert.ok(options.some((o: any) => o.detail === 'current-file'));
			assert.ok(options.some((o: any) => o.detail === 'selection'));
			assert.ok(options.some((o: any) => o.detail === 'empty'));
			assert.ok(options.some((o: any) => o.detail === 'multi-file'));
		});

		test('should handle user cancelling creation method selection', async () => {
			githubService.setAuthenticated(true);
			showQuickPickStub.resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			// Should not proceed to create gist
			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
		});

		test('should create gist from current file', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);

			// Method selection
			showQuickPickStub.onCall(0).resolves({ detail: 'current-file' });
			// Folder organization
			showQuickPickStub.onCall(1).resolves({ detail: 'no-folder' });
			// Description
			showInputBoxStub.onCall(0).resolves('My test gist');
			// Visibility
			showQuickPickStub.onCall(2).resolves({ detail: 'private' });
			// Success action
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			// Verify gist was created
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('Gist created successfully'));
		});

		test('should create gist from selection', async () => {
			githubService.setAuthenticated(true);
			const editor = {
				...activeTextEditor,
				document: {
					...activeTextEditor.document,
					getText: (selection: any) => 'const x = 42;'
				}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(editor);

			// Method selection
			showQuickPickStub.onCall(0).resolves({ detail: 'selection' });
			// Filename for selection
			showInputBoxStub.onCall(0).resolves('snippet.js');
			// Folder organization
			showQuickPickStub.onCall(1).resolves({ detail: 'no-folder' });
			// Description
			showInputBoxStub.onCall(1).resolves('Code snippet');
			// Visibility
			showQuickPickStub.onCall(2).resolves({ detail: 'public' });
			// Success action
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.ok(showInformationMessageStub.calledOnce);
		});

		test('should create empty gist with default content', async () => {
			githubService.setAuthenticated(true);

			// Method selection
			showQuickPickStub.onCall(0).resolves({ detail: 'empty' });
			// Filename
			showInputBoxStub.onCall(0).resolves('example.js');
			// Content (use default)
			showInputBoxStub.onCall(1).resolves('console.log("Hello, World!");');
			// Folder organization
			showQuickPickStub.onCall(1).resolves({ detail: 'no-folder' });
			// Description
			showInputBoxStub.onCall(2).resolves('New gist');
			// Visibility
			showQuickPickStub.onCall(2).resolves({ detail: 'public' });
			// Success action
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should create multi-file gist', async () => {
			githubService.setAuthenticated(true);

			// Method selection
			showQuickPickStub.onCall(0).resolves({ detail: 'multi-file' });
			// First file name
			showInputBoxStub.onCall(0).resolves('file1.js');
			// First file content
			showInputBoxStub.onCall(1).resolves('console.log("file1");');
			// Add more files? No
			showQuickPickStub.onCall(1).resolves({ detail: 'finish' });
			// Folder organization
			showQuickPickStub.onCall(2).resolves({ detail: 'no-folder' });
			// Description
			showInputBoxStub.onCall(2).resolves('Multi-file gist');
			// Visibility
			showQuickPickStub.onCall(3).resolves({ detail: 'private' });
			// Success action
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should organize gist in folder when requested', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);

			// Method selection
			showQuickPickStub.onCall(0).resolves({ detail: 'current-file' });
			// Folder organization
			showQuickPickStub.onCall(1).resolves({ detail: 'with-folder' });
			// Folder path
			showInputBoxStub.onCall(0).resolves('React/Components');
			// Display name
			showInputBoxStub.onCall(1).resolves('Button Component');
			// Visibility
			showQuickPickStub.onCall(2).resolves({ detail: 'public' });
			// Success action
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should handle Copy URL action after creation', async () => {
			const clipboardStub = sandbox.stub(mockVscode.env.clipboard, 'writeText');
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);

			showQuickPickStub.onCall(0).resolves({ detail: 'current-file' });
			showQuickPickStub.onCall(1).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('Test');
			showQuickPickStub.onCall(2).resolves({ detail: 'public' });
			showInformationMessageStub.onCall(0).resolves('Copy URL');
			showInformationMessageStub.onCall(1).resolves(undefined);

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.ok(clipboardStub.called);
			assert.strictEqual(showInformationMessageStub.callCount, 2);
		});

		test('should handle Open Gist action after creation', async () => {
			const openExternalStub = sandbox.stub(mockVscode.env, 'openExternal');
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);

			showQuickPickStub.onCall(0).resolves({ detail: 'current-file' });
			showQuickPickStub.onCall(1).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('Test');
			showQuickPickStub.onCall(2).resolves({ detail: 'public' });
			showInformationMessageStub.resolves('Open Gist');

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.ok(openExternalStub.called);
		});

		test('should handle error during gist creation', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);
			sandbox.stub(githubService, 'createGist').rejects(new Error('Creation failed'));

			showQuickPickStub.onCall(0).resolves({ detail: 'current-file' });
			showQuickPickStub.onCall(1).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('Test');
			showQuickPickStub.onCall(2).resolves({ detail: 'public' });

			registerCommands();

			const createGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGist'
			);
			const handler = createGistCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to create gist'));
		});
	});

	suite('createGistFromFile Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let activeTextEditor: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			activeTextEditor = {
				document: {
					getText: () => 'console.log("test");',
					fileName: '/path/to/test.js'
				}
			};
		});

		test('should prompt authentication if not authenticated', async () => {
			githubService.setAuthenticated(false);
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('Not authenticated'));
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const createGistFromFileCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromFile'
			);
			const handler = createGistFromFileCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
		});

		test('should create gist from current file when authenticated', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);

			showQuickPickStub.onCall(0).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('Test gist');
			showQuickPickStub.onCall(1).resolves({ detail: 'public' });
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistFromFileCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromFile'
			);
			const handler = createGistFromFileCall!.args[1];
			await handler();

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should handle error when creating gist from file', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);
			sandbox.stub(githubService, 'createGist').rejects(new Error('Failed'));

			showQuickPickStub.onCall(0).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('Test');
			showQuickPickStub.onCall(1).resolves({ detail: 'public' });

			registerCommands();

			const createGistFromFileCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromFile'
			);
			const handler = createGistFromFileCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
		});
	});

	suite('createGistFromSelection Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let activeTextEditor: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			activeTextEditor = {
				document: {
					getText: (selection: any) => 'const x = 42;',
					fileName: '/path/to/test.js'
				},
				selection: {}
			};
		});

		test('should prompt authentication if not authenticated', async () => {
			githubService.setAuthenticated(false);
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('Not authenticated'));
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const createGistFromSelectionCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromSelection'
			);
			const handler = createGistFromSelectionCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
		});

		test('should create gist from selection when authenticated', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);

			showInputBoxStub.onCall(0).resolves('snippet.js');
			showQuickPickStub.onCall(0).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(1).resolves('Code snippet');
			showQuickPickStub.onCall(1).resolves({ detail: 'public' });
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const createGistFromSelectionCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromSelection'
			);
			const handler = createGistFromSelectionCall!.args[1];
			await handler();

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should handle error when creating gist from selection', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeTextEditor);
			sandbox.stub(githubService, 'createGist').rejects(new Error('Failed'));

			showInputBoxStub.onCall(0).resolves('snippet.js');
			showQuickPickStub.onCall(0).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(1).resolves('Snippet');
			showQuickPickStub.onCall(1).resolves({ detail: 'public' });

			registerCommands();

			const createGistFromSelectionCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.createGistFromSelection'
			);
			const handler = createGistFromSelectionCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
		});
	});

	suite('openGist Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let mockGist: any;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			mockGist = createMockGist();
		});

		test('should show message when no gist selected', async () => {
			registerCommands();

			const openGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGist'
			);
			const handler = openGistCall!.args[1];
			await handler(undefined);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('No gist selected'));
		});

		test('should open single-file gist directly', async () => {
			const openTextDocumentStub = sandbox.stub(mockVscode.workspace, 'openTextDocument');
			const showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
			openTextDocumentStub.resolves(undefined);
			showTextDocumentStub.resolves(undefined);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const openGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGist'
			);
			const handler = openGistCall!.args[1];
			await handler(mockGist);

			assert.ok(openTextDocumentStub.called);
		});

		test('should show file picker for multi-file gist', async () => {
			const multiFileGist = createMockGist({
				files: {
					'file1.js': {
						filename: 'file1.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file1.js',
						size: 100,
						content: 'console.log("file1");'
					},
					'file2.js': {
						filename: 'file2.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file2.js',
						size: 100,
						content: 'console.log("file2");'
					}
				}
			});

			showQuickPickStub.resolves(undefined); // User cancels

			registerCommands();

			const openGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGist'
			);
			const handler = openGistCall!.args[1];
			await handler(multiFileGist);

			assert.ok(showQuickPickStub.calledOnce);
		});

		test('should show message for gist with no files', async () => {
			const emptyGist = createMockGist({ files: {} });

			registerCommands();

			const openGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGist'
			);
			const handler = openGistCall!.args[1];
			await handler(emptyGist);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('no files'));
		});

		test('should handle error when opening gist', async () => {
			sandbox.stub(githubService, 'getGist').rejects(new Error('Failed to load gist'));

			registerCommands();

			const openGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGist'
			);
			const handler = openGistCall!.args[1];
			await handler(mockGist);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to open gist'));
		});
	});

	suite('openGistFile Command', () => {
		let registerCommandStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
		});

		test('should register openGistFile command', () => {
			registerCommands();

			const openGistFileCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openGistFile'
			);
			assert.ok(openGistFileCall);
		});
	});

	suite('saveGist Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
		});

		test('should show error when no active editor', async () => {
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(undefined);

			registerCommands();

			const saveGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.saveGist'
			);
			const handler = saveGistCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('No active editor'));
		});

		test('should show error when document is not a gist', async () => {
			const activeEditor = {
				document: {
					uri: { scheme: 'file', path: '/test.js' },
					save: () => Promise.resolve(true)
				}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeEditor);

			registerCommands();

			const saveGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.saveGist'
			);
			const handler = saveGistCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('not a gist file'));
		});

		test('should save gist successfully', async () => {
			const activeEditor = {
				document: {
					uri: { scheme: 'gist', path: '/gist-123/test.js' },
					save: () => Promise.resolve(true)
				}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeEditor);

			registerCommands();

			const saveGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.saveGist'
			);
			const handler = saveGistCall!.args[1];
			await handler();

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('Saved'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should handle save error', async () => {
			const activeEditor = {
				document: {
					uri: { scheme: 'gist', path: '/gist-123/test.js' },
					save: () => Promise.reject(new Error('Save failed'))
				}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(activeEditor);

			registerCommands();

			const saveGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.saveGist'
			);
			const handler = saveGistCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to save gist'));
		});
	});

	suite('deleteGist Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let mockGist: any;
		let gistItem: GistItem;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			mockGist = createMockGist();
			githubService.setMockGists([mockGist]);
			gistItem = new GistItem(mockGist);
		});

		test('should show error when no gist selected', async () => {
			registerCommands();

			const deleteGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.deleteGist'
			);
			const handler = deleteGistCall!.args[1];
			await handler(undefined);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('No gist selected'));
		});

		test('should show confirmation dialog', async () => {
			showWarningMessageStub.resolves('Cancel'); // User cancels

			registerCommands();

			const deleteGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.deleteGist'
			);
			const handler = deleteGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showWarningMessageStub.calledOnce);
			assert.ok(showWarningMessageStub.firstCall.args[0].includes('Are you sure'));
		});

		test('should delete gist when confirmed', async () => {
			showWarningMessageStub.resolves('Delete');

			registerCommands();

			const deleteGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.deleteGist'
			);
			const handler = deleteGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('Deleted gist'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should not delete when user cancels', async () => {
			showWarningMessageStub.resolves(undefined); // User cancels

			registerCommands();

			const deleteGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.deleteGist'
			);
			const handler = deleteGistCall!.args[1];
			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
		});

		test('should handle delete error', async () => {
			showWarningMessageStub.resolves('Delete');
			sandbox.stub(githubService, 'deleteGist').rejects(new Error('Delete failed'));

			registerCommands();

			const deleteGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.deleteGist'
			);
			const handler = deleteGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to delete gist'));
		});
	});

	suite('renameGist Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let mockGist: any;
		let gistItem: GistItem;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			mockGist = createMockGist({ description: 'Old Name' });
			githubService.setMockGists([mockGist]);
			gistItem = new GistItem(mockGist);
		});

		test('should show error when no gist selected', async () => {
			registerCommands();

			const renameGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameGist'
			);
			const handler = renameGistCall!.args[1];
			await handler(undefined);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('No gist selected'));
		});

		test('should rename gist without folder', async () => {
			showQuickPickStub.onCall(0).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('New Name');

			registerCommands();

			const renameGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameGist'
			);
			const handler = renameGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('Renamed gist'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should rename gist with folder', async () => {
			showQuickPickStub.onCall(0).resolves({ detail: 'with-folder' });
			showInputBoxStub.onCall(0).resolves('React/Components');
			showInputBoxStub.onCall(1).resolves('Button Component');

			registerCommands();

			const renameGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameGist'
			);
			const handler = renameGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
		});

		test('should handle user cancellation', async () => {
			showQuickPickStub.resolves(undefined); // User cancels

			registerCommands();

			const renameGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameGist'
			);
			const handler = renameGistCall!.args[1];
			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
		});

		test('should handle rename error', async () => {
			showQuickPickStub.onCall(0).resolves({ detail: 'no-folder' });
			showInputBoxStub.onCall(0).resolves('New Name');
			sandbox.stub(githubService, 'updateGist').rejects(new Error('Rename failed'));

			registerCommands();

			const renameGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.renameGist'
			);
			const handler = renameGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to rename gist'));
		});
	});

	suite('toggleStarGist Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let mockGist: any;
		let gistItem: GistItem;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			mockGist = createMockGist();
			githubService.setMockGists([mockGist]);
			gistItem = new GistItem(mockGist);
		});

		test('should show error when no gist selected', async () => {
			registerCommands();

			const toggleStarGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.toggleStarGist'
			);
			const handler = toggleStarGistCall!.args[1];
			await handler(undefined);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('No gist selected'));
		});

		test('should star an unstarred gist', async () => {
			sandbox.stub(githubService, 'checkIfStarred').resolves(false);
			sandbox.stub(githubService, 'starGist').resolves();

			registerCommands();

			const toggleStarGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.toggleStarGist'
			);
			const handler = toggleStarGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('Starred'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should unstar a starred gist', async () => {
			sandbox.stub(githubService, 'checkIfStarred').resolves(true);
			sandbox.stub(githubService, 'unstarGist').resolves();

			registerCommands();

			const toggleStarGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.toggleStarGist'
			);
			const handler = toggleStarGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('Removed star'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
		});

		test('should handle star toggle error', async () => {
			sandbox.stub(githubService, 'checkIfStarred').rejects(new Error('Failed'));

			registerCommands();

			const toggleStarGistCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.toggleStarGist'
			);
			const handler = toggleStarGistCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to toggle star'));
		});
	});

	suite('viewGistHistory Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let mockGist: any;
		let gistItem: GistItem;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			mockGist = createMockGist();
			githubService.setMockGists([mockGist]);
			gistItem = new GistItem(mockGist);
		});

		test('should show error when no gist selected', async () => {
			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(undefined);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('select a gist'));
		});

		test('should show error when file is selected instead of gist', async () => {
			const fileItem = new GistItem(mockGist, { filename: 'test.js' });

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(fileItem);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('not a file'));
		});

		test('should show revision list', async () => {
			showQuickPickStub.onCall(0).resolves(undefined); // User cancels revision selection

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(gistItem);

			assert.ok(showQuickPickStub.calledOnce);
			const revisionItems = showQuickPickStub.firstCall.args[0];
			assert.ok(revisionItems.length > 0);
		});

		test('should show file list from selected revision', async () => {
			const revisionItem = {
				revision: {
					version: 'abc123def',
					committed_at: new Date().toISOString(),
					user: { login: 'testuser' }
				}
			};
			showQuickPickStub.onCall(0).resolves(revisionItem);
			showQuickPickStub.onCall(1).resolves(undefined); // User cancels file selection

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(gistItem);

			assert.strictEqual(showQuickPickStub.callCount, 2);
		});

		test('should open historical file in read-only mode', async () => {
			const openTextDocumentStub = sandbox.stub(mockVscode.workspace, 'openTextDocument');
			const showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
			openTextDocumentStub.resolves(undefined);
			showTextDocumentStub.resolves(undefined);

			const revisionItem = {
				revision: {
					version: 'abc123def',
					committed_at: new Date().toISOString(),
					user: { login: 'testuser' }
				}
			};
			const fileItem = {
				file: { filename: 'test.js', content: 'old content' }
			};
			showQuickPickStub.onCall(0).resolves(revisionItem);
			showQuickPickStub.onCall(1).resolves(fileItem);

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(gistItem);

			assert.ok(openTextDocumentStub.called);
			assert.ok(showTextDocumentStub.called);
			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('read-only'));
		});

		test('should show message when no revision history found', async () => {
			sandbox.stub(githubService, 'getGistRevisions').resolves([]);

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(gistItem);

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('No revision history'));
		});

		test('should handle history loading error', async () => {
			sandbox.stub(githubService, 'getGistRevisions').rejects(new Error('Failed'));

			registerCommands();

			const viewGistHistoryCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewGistHistory'
			);
			const handler = viewGistHistoryCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to load history'));
		});
	});

	suite('openInGitHub Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let openExternalStub: sinon.SinonStub;
		let mockGist: any;
		let gistItem: GistItem;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			openExternalStub = sandbox.stub(mockVscode.env, 'openExternal');

			mockGist = createMockGist();
			gistItem = new GistItem(mockGist);
		});

		test('should show error when no gist selected', async () => {
			registerCommands();

			const openInGitHubCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openInGitHub'
			);
			const handler = openInGitHubCall!.args[1];
			await handler(undefined);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('No gist or file selected'));
		});

		test('should open gist URL in browser', async () => {
			registerCommands();

			const openInGitHubCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openInGitHub'
			);
			const handler = openInGitHubCall!.args[1];
			await handler(gistItem);

			assert.ok(openExternalStub.calledOnce);
		});

		test('should open file URL when file is selected', async () => {
			const fileItem = new GistItem(mockGist, {
				filename: 'test.js',
				raw_url: 'https://gist.github.com/raw/test.js'
			});

			registerCommands();

			const openInGitHubCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openInGitHub'
			);
			const handler = openInGitHubCall!.args[1];
			await handler(fileItem);

			assert.ok(openExternalStub.calledOnce);
		});

		test('should handle missing URL', async () => {
			const gistNoUrl = new GistItem(createMockGist({ html_url: '' }));

			registerCommands();

			const openInGitHubCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.openInGitHub'
			);
			const handler = openInGitHubCall!.args[1];
			await handler(gistNoUrl);

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('No GitHub URL found'));
		});
	});
});
