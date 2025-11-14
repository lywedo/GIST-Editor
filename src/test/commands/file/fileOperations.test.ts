import * as assert from 'assert';
import * as sinon from 'sinon';
import { registerFileCommands } from '../../../commands/file/fileOperations';
import { MockExtensionContext, mockVscode } from '../../mocks/vscode.mock';
import { MockGitHubService, MockGistProvider, MockGistFileSystemProvider, createMockGist } from '../../mocks/services.mock';
import { GistItem } from '../../../providers/gistItem';

suite('File Operations Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let githubService: MockGitHubService;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;
	let gistFileSystemProvider: MockGistFileSystemProvider;

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		githubService = new MockGitHubService();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
		gistFileSystemProvider = new MockGistFileSystemProvider();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('addFileToGist', () => {
		test('should show error when no gist is selected', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			assert.ok(addFileCall, 'addFileToGist command should be registered');

			const handler = addFileCall!.args[1];
			await handler(null);

			assert.ok(showErrorStub.calledWith('No gist selected'));
		});

		test('should show error when gistItem has no gist property', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			const gistItem = new GistItem(null);
			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No gist selected'));
		});

		test('should validate empty filename', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			// Simulate user entering empty filename
			showInputStub.onFirstCall().callsFake(async (options: any) => {
				const validation = options.validateInput('');
				assert.strictEqual(validation, 'Filename cannot be empty');
				return undefined; // User cancels
			});

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			assert.ok(showInputStub.calledOnce);
		});

		test('should validate duplicate filename', async () => {
			const mockGist = createMockGist({
				files: {
					'existing.js': {
						filename: 'existing.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/existing.js',
						size: 100,
						content: 'existing content'
					}
				}
			});
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			// Simulate user entering duplicate filename
			showInputStub.onFirstCall().callsFake(async (options: any) => {
				const validation = options.validateInput('existing.js');
				assert.strictEqual(validation, 'A file with this name already exists in the gist');
				return undefined; // User cancels
			});

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			assert.ok(showInputStub.calledOnce);
		});

		test('should return when user cancels filename input', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.onFirstCall().resolves(undefined); // User cancels

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			assert.ok(showInputStub.calledOnce);
			assert.ok(updateGistStub.notCalled);
		});

		test('should return when user cancels content input', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.onFirstCall().resolves('newfile.js'); // Filename
			showInputStub.onSecondCall().resolves(undefined); // User cancels content

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			assert.strictEqual(showInputStub.callCount, 2);
			assert.ok(updateGistStub.notCalled);
		});

		test('should successfully add file with content', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			githubService.setMockGists([mockGist]);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			const showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
			const invalidateCacheStub = sandbox.stub(gistFileSystemProvider, 'invalidateCache');

			showInputStub.onFirstCall().resolves('newfile.js');
			showInputStub.onSecondCall().resolves('console.log("test");');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			assert.strictEqual(showInputStub.callCount, 2);
			assert.ok(invalidateCacheStub.calledWith(mockGist.id));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.ok(showInfoStub.calledWith('✓ Added file "newfile.js" to gist'));
			assert.ok(showTextDocumentStub.called);
		});

		test('should successfully add file with empty content (space)', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			githubService.setMockGists([mockGist]);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.onFirstCall().resolves('newfile.txt');
			showInputStub.onSecondCall().resolves(''); // Empty content

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			// Verify that empty content is converted to a space for GitHub
			const updateCall = updateGistStub.getCall(0);
			assert.ok(updateCall);
			assert.deepStrictEqual(updateCall.args[2], { 'newfile.txt': { content: ' ' } });
		});

		test('should handle errors during file addition', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.onFirstCall().resolves('newfile.js');
			showInputStub.onSecondCall().resolves('content');
			updateGistStub.rejects(new Error('API Error'));

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const addFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.addFileToGist');
			const handler = addFileCall!.args[1];

			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('Failed to add file: Error: API Error'));
		});
	});

	suite('deleteFileFromGist', () => {
		test('should show error when no file is selected', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const deleteFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.deleteFileFromGist');
			assert.ok(deleteFileCall, 'deleteFileFromGist command should be registered');

			const handler = deleteFileCall!.args[1];
			await handler(null);

			assert.ok(showErrorStub.calledWith('No file selected'));
		});

		test('should show error when gistItem has no file property', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const deleteFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.deleteFileFromGist');
			const handler = deleteFileCall!.args[1];

			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No file selected'));
		});

		test('should return when user cancels deletion', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage') as any;
			const getGistStub = sandbox.stub(githubService, 'getGist');

			showWarningStub.resolves(undefined); // User doesn't click Delete

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const deleteFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.deleteFileFromGist');
			const handler = deleteFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showWarningStub.calledWith(
				'Are you sure you want to delete "test.js" from this gist?',
				{ modal: true },
				'Delete'
			));
			assert.ok(getGistStub.notCalled);
		});

		test('should prevent deletion of last file in gist', async () => {
			const mockGist = createMockGist({
				files: {
					'onlyfile.js': {
						filename: 'onlyfile.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/onlyfile.js',
						size: 100,
						content: 'content'
					}
				}
			});
			const fileItem = new GistItem(mockGist, mockGist.files['onlyfile.js']);

			githubService.setMockGists([mockGist]);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage') as any;
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showWarningStub.resolves('Delete');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const deleteFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.deleteFileFromGist');
			const handler = deleteFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showErrorStub.calledWith('Cannot delete the last file in a gist. GitHub Gists must contain at least one file.'));
			assert.ok(updateGistStub.notCalled);
		});

		test('should successfully delete file from gist with multiple files', async () => {
			const mockGist = createMockGist({
				files: {
					'file1.js': {
						filename: 'file1.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file1.js',
						size: 100,
						content: 'content1'
					},
					'file2.js': {
						filename: 'file2.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file2.js',
						size: 100,
						content: 'content2'
					}
				}
			});
			const fileItem = new GistItem(mockGist, mockGist.files['file1.js']);

			githubService.setMockGists([mockGist]);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage') as any;
			const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			const invalidateCacheStub = sandbox.stub(gistFileSystemProvider, 'invalidateCache');

			showWarningStub.resolves('Delete');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const deleteFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.deleteFileFromGist');
			const handler = deleteFileCall!.args[1];

			await handler(fileItem);

			assert.ok(invalidateCacheStub.calledWith(mockGist.id));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.ok(showInfoStub.calledWith('✓ Deleted file "file1.js"'));
		});

		test('should handle errors during file deletion', async () => {
			const mockGist = createMockGist({
				files: {
					'file1.js': {
						filename: 'file1.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file1.js',
						size: 100,
						content: 'content1'
					},
					'file2.js': {
						filename: 'file2.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file2.js',
						size: 100,
						content: 'content2'
					}
				}
			});
			const fileItem = new GistItem(mockGist, mockGist.files['file1.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage') as any;
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const getGistStub = sandbox.stub(githubService, 'getGist');

			showWarningStub.resolves('Delete');
			getGistStub.rejects(new Error('Network error'));

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const deleteFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.deleteFileFromGist');
			const handler = deleteFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showErrorStub.calledWith('Failed to delete file: Error: Network error'));
		});
	});

	suite('renameFileInGist', () => {
		test('should show error when no file is selected', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			assert.ok(renameFileCall, 'renameFileInGist command should be registered');

			const handler = renameFileCall!.args[1];
			await handler(null);

			assert.ok(showErrorStub.calledWith('No file selected'));
		});

		test('should show error when gistItem has no file property', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No file selected'));
		});

		test('should validate empty filename', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			showInputStub.callsFake(async (options: any) => {
				const validation = options.validateInput('');
				assert.strictEqual(validation, 'Filename cannot be empty');
				return undefined; // User cancels
			});

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showInputStub.called);
		});

		test('should validate duplicate filename', async () => {
			const mockGist = createMockGist({
				files: {
					'file1.js': {
						filename: 'file1.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file1.js',
						size: 100,
						content: 'content1'
					},
					'file2.js': {
						filename: 'file2.js',
						type: 'application/javascript',
						language: 'JavaScript',
						raw_url: 'https://gist.github.com/raw/file2.js',
						size: 100,
						content: 'content2'
					}
				}
			});
			const fileItem = new GistItem(mockGist, mockGist.files['file1.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			showInputStub.callsFake(async (options: any) => {
				const validation = options.validateInput('file2.js');
				assert.strictEqual(validation, 'A file with this name already exists in the gist');
				return undefined; // User cancels
			});

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showInputStub.called);
		});

		test('should allow same filename (validation passes)', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			showInputStub.callsFake(async (options: any) => {
				const validation = options.validateInput('test.js');
				assert.strictEqual(validation, null); // Validation passes for same name
				return 'test.js'; // User enters same name
			});

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showInputStub.called);
		});

		test('should return when user cancels rename', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.resolves(undefined); // User cancels

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showInputStub.called);
			assert.ok(updateGistStub.notCalled);
		});

		test('should return when filename unchanged', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.resolves('test.js'); // Same name

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showInputStub.called);
			assert.ok(updateGistStub.notCalled);
		});

		test('should successfully rename file', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			githubService.setMockGists([mockGist]);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			const showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
			const executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');
			const invalidateCacheStub = sandbox.stub(gistFileSystemProvider, 'invalidateCache');

			showInputStub.resolves('renamed.js');

			// Mock workspace.textDocuments to simulate no open document
			sandbox.stub(mockVscode.workspace, 'textDocuments' as any).value([]);

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(invalidateCacheStub.calledWith(mockGist.id));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.ok(showInfoStub.calledWith('✓ Renamed "test.js" to "renamed.js"'));
			assert.ok(showTextDocumentStub.called);
		});

		test('should close old document when renaming', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			githubService.setMockGists([mockGist]);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const showTextDocumentStub = sandbox.stub(mockVscode.window, 'showTextDocument');
			const executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');

			showInputStub.resolves('renamed.js');

			// Mock an open document
			const oldUri = { toString: () => `gist:/${mockGist.id}/test.js` };
			const openDoc = { uri: oldUri };
			sandbox.stub(mockVscode.workspace, 'textDocuments' as any).value([openDoc]);

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			// Verify old document was shown and closed
			assert.ok(showTextDocumentStub.calledWith(openDoc));
			const closeEditorCall = executeCommandStub.getCalls().find((call: any) => call.args[0] === 'workbench.action.closeActiveEditor');
			assert.ok(closeEditorCall);
		});

		test('should handle errors during rename', async () => {
			const mockGist = createMockGist();
			const fileItem = new GistItem(mockGist, mockGist.files['test.js']);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const updateGistStub = sandbox.stub(githubService, 'updateGist');

			showInputStub.resolves('renamed.js');
			updateGistStub.rejects(new Error('API Error'));

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const renameFileCall = registerCommandStub.getCalls().find((call: any) => call.args[0] === 'gist-editor.renameFileInGist');
			const handler = renameFileCall!.args[1];

			await handler(fileItem);

			assert.ok(showErrorStub.calledWith('Failed to rename file: Error: API Error'));
		});
	});

	suite('Command Registration', () => {
		test('should register all three file operation commands', () => {
			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			assert.strictEqual(context.subscriptions.length, 3);
		});

		test('should register commands with correct names', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerFileCommands(context as any, githubService as any, myGistsProvider as any, starredGistsProvider as any, gistFileSystemProvider as any);

			const commandNames = registerCommandStub.getCalls().map((call: any) => call.args[0]);
			assert.ok(commandNames.includes('gist-editor.addFileToGist'));
			assert.ok(commandNames.includes('gist-editor.deleteFileFromGist'));
			assert.ok(commandNames.includes('gist-editor.renameFileInGist'));
		});
	});
});
