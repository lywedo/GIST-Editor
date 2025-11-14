import * as assert from 'assert';
import * as sinon from 'sinon';
import { registerCommentCommands } from '../../../commands/comment/commentOperations';
import { MockExtensionContext, mockVscode } from '../../mocks/vscode.mock';
import { MockGitHubService, MockGistProvider, MockCommentProvider, createMockGist } from '../../mocks/services.mock';
import { GistItem } from '../../../providers/gistItem';

suite('Comment Operations Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let githubService: MockGitHubService;
	let commentProvider: MockCommentProvider;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		githubService = new MockGitHubService();
		commentProvider = new MockCommentProvider();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('Command Registration', () => {
		test('should register all comment commands', () => {
			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			assert.strictEqual(context.subscriptions.length, 3, 'Should register 3 commands');
		});

		test('should register addGistComment command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			assert.ok(addCommentCall, 'addGistComment command should be registered');
		});

		test('should register deleteGistComment command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			assert.ok(deleteCommentCall, 'deleteGistComment command should be registered');
		});

		test('should register viewGistCommentOnGitHub command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const viewCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.viewGistCommentOnGitHub');
			assert.ok(viewCommentCall, 'viewGistCommentOnGitHub command should be registered');
		});
	});

	suite('addGistComment Command', () => {
		test('should add comment successfully', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);
			const commentBody = 'Test comment';

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox').resolves(commentBody as any);
			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			const createCommentStub = sandbox.stub(githubService, 'createGistComment').resolves({
				id: 123,
				body: commentBody,
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			} as any);
			const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showInputBoxStub.calledOnce, 'Should prompt for comment text');
			assert.ok(createCommentStub.calledOnce, 'Should create comment via GitHub service');
			assert.ok(createCommentStub.calledWith(mockGist.id, commentBody), 'Should pass correct gist ID and comment body');
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1, 'Should refresh my gists provider');
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1, 'Should refresh starred gists provider');
			assert.strictEqual(commentProvider.getRefreshCount(), 1, 'Should refresh comment provider');
			assert.ok(showInfoStub.calledWith('Comment added successfully!'), 'Should show success message');
		});

		test('should validate empty comment input', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			let validateInput: any;
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox').callsFake(async (options: any) => {
				validateInput = options.validateInput;
				return undefined;
			});

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(validateInput, 'Should have validation function');
			assert.strictEqual(validateInput(''), 'Comment cannot be empty', 'Should reject empty comment');
			assert.strictEqual(validateInput('   '), 'Comment cannot be empty', 'Should reject whitespace-only comment');
			assert.strictEqual(validateInput('Valid comment'), '', 'Should accept valid comment');
		});

		test('should handle user cancellation', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox').resolves(undefined);
			const createCommentStub = sandbox.stub(githubService, 'createGistComment');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showInputBoxStub.calledOnce, 'Should prompt for comment text');
			assert.ok(createCommentStub.notCalled, 'Should not create comment when cancelled');
			assert.strictEqual(myGistsProvider.getRefreshCount(), 0, 'Should not refresh providers when cancelled');
		});

		test('should show error message when no gist is selected', async () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(null);

			assert.ok(showErrorStub.calledWith('No gist selected'), 'Should show error for no gist');
		});

		test('should show error message when gist item has no gist', async () => {
			const gistItem = new GistItem(null);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No gist selected'), 'Should show error for missing gist');
		});

		test('should handle API error gracefully', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);
			const commentBody = 'Test comment';
			const errorMessage = 'API error';

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox').resolves(commentBody as any);
			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			const createCommentStub = sandbox.stub(githubService, 'createGistComment').rejects(new Error(errorMessage));
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(createCommentStub.calledOnce, 'Should attempt to create comment');
			assert.ok(showErrorStub.calledOnce, 'Should show error message');
			assert.ok(showErrorStub.firstCall.args[0].includes('Failed to add comment'), 'Error message should indicate failure');
		});

		test('should trim whitespace from comment body', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);
			const commentBody = '  Test comment  ';
			const trimmedBody = 'Test comment';

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox').resolves(commentBody as any);
			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			const createCommentStub = sandbox.stub(githubService, 'createGistComment').resolves({
				id: 123,
				body: trimmedBody,
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			} as any);

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(createCommentStub.calledWith(mockGist.id, trimmedBody), 'Should trim whitespace from comment body');
		});
	});

	suite('deleteGistComment Command', () => {
		test('should delete comment successfully', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage').resolves('Delete' as any);
			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			const deleteCommentStub = sandbox.stub(githubService, 'deleteGistComment').resolves();
			const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showWarningStub.calledOnce, 'Should show confirmation dialog');
			assert.ok(deleteCommentStub.calledOnce, 'Should delete comment via GitHub service');
			assert.ok(deleteCommentStub.calledWith(mockGist.id, mockComment.id), 'Should pass correct gist ID and comment ID');
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1, 'Should refresh my gists provider');
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1, 'Should refresh starred gists provider');
			assert.strictEqual(commentProvider.getRefreshCount(), 1, 'Should refresh comment provider');
			assert.ok(showInfoStub.calledWith('Comment deleted successfully!'), 'Should show success message');
		});

		test('should handle user cancellation of delete confirmation', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage').resolves(undefined);
			const deleteCommentStub = sandbox.stub(githubService, 'deleteGistComment');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showWarningStub.calledOnce, 'Should show confirmation dialog');
			assert.ok(deleteCommentStub.notCalled, 'Should not delete comment when cancelled');
			assert.strictEqual(myGistsProvider.getRefreshCount(), 0, 'Should not refresh providers when cancelled');
		});

		test('should show error message when no comment is selected', async () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(null);

			assert.ok(showErrorStub.calledWith('No comment selected'), 'Should show error for no comment');
		});

		test('should show error message when gist item is not a comment', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No comment selected'), 'Should show error for non-comment item');
		});

		test('should show error message when comment has no parent gist ID', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, undefined);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No comment selected'), 'Should show error for missing parent gist ID');
		});

		test('should handle API error gracefully', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);
			const errorMessage = 'API error';

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage').resolves('Delete' as any);
			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			const deleteCommentStub = sandbox.stub(githubService, 'deleteGistComment').rejects(new Error(errorMessage));
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(deleteCommentStub.calledOnce, 'Should attempt to delete comment');
			assert.ok(showErrorStub.calledOnce, 'Should show error message');
			assert.ok(showErrorStub.firstCall.args[0].includes('Failed to delete comment'), 'Error message should indicate failure');
		});

		test('should display confirmation dialog with modal option', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showWarningStub = sandbox.stub(mockVscode.window, 'showWarningMessage').resolves('Delete' as any);
			const withProgressStub = sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			const deleteCommentStub = sandbox.stub(githubService, 'deleteGistComment').resolves();

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showWarningStub.calledOnce, 'Should show confirmation dialog');
			const callArgs = showWarningStub.firstCall.args;
			assert.strictEqual(callArgs[0], 'Are you sure you want to delete this comment?', 'Should show correct message');
			assert.deepStrictEqual(callArgs[1], { modal: true }, 'Should use modal option');
			assert.strictEqual(callArgs[2], 'Delete', 'Should have Delete button');
		});
	});

	suite('viewGistCommentOnGitHub Command', () => {
		test('should open comment URL in browser successfully', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const openExternalStub = sandbox.stub(mockVscode.env, 'openExternal').resolves(true);
			const parseStub = sandbox.stub(mockVscode.Uri, 'parse').callsFake((uri: string) => ({ toString: () => uri }) as any);

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const viewCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.viewGistCommentOnGitHub');
			const handler = viewCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(parseStub.calledWith(mockComment.html_url), 'Should parse comment URL');
			assert.ok(openExternalStub.calledOnce, 'Should open URL in browser');
		});

		test('should show error message when no comment is selected', async () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const viewCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.viewGistCommentOnGitHub');
			const handler = viewCommentCall!.args[1];
			await handler(null);

			assert.ok(showErrorStub.calledWith('No comment selected'), 'Should show error for no comment');
		});

		test('should show error message when gist item is not a comment', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const viewCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.viewGistCommentOnGitHub');
			const handler = viewCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No comment selected'), 'Should show error for non-comment item');
		});

		test('should show error message when comment has no HTML URL', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: ''
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const openExternalStub = sandbox.stub(mockVscode.env, 'openExternal');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const viewCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.viewGistCommentOnGitHub');
			const handler = viewCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(showErrorStub.calledWith('No GitHub URL found for this comment'), 'Should show error for missing URL');
			assert.ok(openExternalStub.notCalled, 'Should not attempt to open URL');
		});

		test('should handle error when opening URL fails', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);
			const errorMessage = 'Failed to open URL';

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			const openExternalStub = sandbox.stub(mockVscode.env, 'openExternal').rejects(new Error(errorMessage));
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const viewCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.viewGistCommentOnGitHub');
			const handler = viewCommentCall!.args[1];
			await handler(gistItem);

			assert.ok(openExternalStub.calledOnce, 'Should attempt to open URL');
			assert.ok(showErrorStub.calledOnce, 'Should show error message');
			assert.ok(showErrorStub.firstCall.args[0].includes('Failed to open comment'), 'Error message should indicate failure');
		});
	});

	suite('Provider Refresh Integration', () => {
		test('should refresh all providers after adding comment', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			sandbox.stub(mockVscode.window, 'showInputBox').resolves('Test comment' as any);
			sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			sandbox.stub(githubService, 'createGistComment').resolves({
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			} as any);

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1, 'My gists provider should be refreshed');
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1, 'Starred gists provider should be refreshed');
			assert.strictEqual(commentProvider.getRefreshCount(), 1, 'Comment provider should be refreshed');
		});

		test('should refresh all providers after deleting comment', async () => {
			const mockGist = createMockGist();
			const mockComment = {
				id: 123,
				body: 'Test comment',
				user: { login: 'testuser', avatar_url: '' },
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				html_url: 'https://gist.github.com/test-gist-123#gistcomment-123'
			};
			const gistItem = new GistItem(mockGist, undefined, undefined, undefined, undefined, mockComment, mockGist.id);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			sandbox.stub(mockVscode.window, 'showWarningMessage').resolves('Delete' as any);
			sandbox.stub(mockVscode.window, 'withProgress').callsFake(async (options, task) => {
				return task({ report: () => {} });
			});
			sandbox.stub(githubService, 'deleteGistComment').resolves();

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const deleteCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.deleteGistComment');
			const handler = deleteCommentCall!.args[1];
			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 1, 'My gists provider should be refreshed');
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1, 'Starred gists provider should be refreshed');
			assert.strictEqual(commentProvider.getRefreshCount(), 1, 'Comment provider should be refreshed');
		});

		test('should not refresh providers when operations are cancelled', async () => {
			const mockGist = createMockGist();
			const gistItem = new GistItem(mockGist);

			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			sandbox.stub(mockVscode.window, 'showInputBox').resolves(undefined);

			registerCommentCommands(
				context as any,
				githubService as any,
				commentProvider as any,
				myGistsProvider as any,
				starredGistsProvider as any
			);

			const addCommentCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.addGistComment');
			const handler = addCommentCall!.args[1];
			await handler(gistItem);

			assert.strictEqual(myGistsProvider.getRefreshCount(), 0, 'My gists provider should not be refreshed');
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0, 'Starred gists provider should not be refreshed');
			assert.strictEqual(commentProvider.getRefreshCount(), 0, 'Comment provider should not be refreshed');
		});
	});
});
