import * as assert from 'assert';
import * as sinon from 'sinon';
import { registerAuthCommands } from '../../../commands/auth/authentication';
import { MockExtensionContext, mockVscode, MockOutputChannel } from '../../mocks/vscode.mock';
import { MockGitHubService, MockGistProvider, MockCommentProvider, createMockGist } from '../../mocks/services.mock';

suite('Authentication Commands Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let githubService: MockGitHubService;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;
	let commentProvider: MockCommentProvider;
	let apiUsageOutputChannel: MockOutputChannel;

	/**
	 * Helper function to register auth commands with proper type casting
	 */
	const registerCommands = () => {
		registerAuthCommands(
			context as any,
			githubService as any,
			myGistsProvider as any,
			starredGistsProvider as any,
			commentProvider as any,
			apiUsageOutputChannel as any
		);
	};

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		githubService = new MockGitHubService();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
		commentProvider = new MockCommentProvider();
		apiUsageOutputChannel = new MockOutputChannel();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('Command Registration', () => {
		test('should register all authentication commands', () => {
			registerCommands();

			assert.strictEqual(context.subscriptions.length, 4);
		});

		test('should register setupToken command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			assert.ok(setupTokenCall, 'setupToken command should be registered');
		});

		test('should register testAPI command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const testApiCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.testAPI'
			);
			assert.ok(testApiCall, 'testAPI command should be registered');
		});

		test('should register checkScopes command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			assert.ok(checkScopesCall, 'checkScopes command should be registered');
		});

		test('should register viewApiUsage command', () => {
			const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			assert.ok(viewApiUsageCall, 'viewApiUsage command should be registered');
		});
	});

	suite('setupToken Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showQuickPickStub: sinon.SinonStub;
		let showInputBoxStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick');
			showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
		});

		test('should show OAuth and manual token options when not authenticated', async () => {
			githubService.setAuthenticated(false);
			showQuickPickStub.resolves(undefined); // User cancels

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showQuickPickStub.calledOnce);
			const quickPickOptions = showQuickPickStub.firstCall.args[0];
			assert.strictEqual(quickPickOptions.length, 2); // OAuth and manual token, no logout
		});

		test('should show OAuth, manual token, and logout options when authenticated', async () => {
			githubService.setAuthenticated(true);
			showQuickPickStub.resolves(undefined); // User cancels

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showQuickPickStub.calledOnce);
			const quickPickOptions = showQuickPickStub.firstCall.args[0];
			assert.strictEqual(quickPickOptions.length, 3); // OAuth, manual token, and logout
		});

		test('should handle successful OAuth flow', async () => {
			showQuickPickStub.resolves({ detail: 'oauth' });
			sandbox.stub(githubService, 'getOAuthToken').resolves('oauth-token');
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(
				showInformationMessageStub.firstCall.args[0].includes('Successfully signed in as @testuser')
			);
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(commentProvider.getRefreshCount(), 1);
		});

		test('should handle OAuth flow with user clicking Refresh Gists button', async () => {
			showQuickPickStub.resolves({ detail: 'oauth' });
			sandbox.stub(githubService, 'getOAuthToken').resolves('oauth-token');
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			showInformationMessageStub.resolves('Refresh Gists');

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			// Should refresh twice: once in auto-refresh, once from button click
			assert.strictEqual(myGistsProvider.getRefreshCount(), 2);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 2);
		});

		test('should handle OAuth flow error', async () => {
			showQuickPickStub.resolves({ detail: 'oauth' });
			const oauthError = new Error('OAuth failed');
			sandbox.stub(githubService, 'getOAuthToken').rejects(oauthError);
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(
				showErrorMessageStub.firstCall.args[0].includes('Failed to authenticate with GitHub')
			);
		});

		test('should handle OAuth error with user clicking Try Again', async () => {
			const executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');
			showQuickPickStub.resolves({ detail: 'oauth' });
			sandbox.stub(githubService, 'getOAuthToken').rejects(new Error('OAuth failed'));
			showErrorMessageStub.resolves('Try Again');

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(executeCommandStub.calledWith('gist-editor.setupToken'));
		});

		test('should handle successful manual token entry', async () => {
			showQuickPickStub.resolves({ detail: 'manual' });
			showInputBoxStub.resolves('ghp_validtoken123456789');
			sandbox.stub(githubService, 'setToken').resolves();
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showInputBoxStub.calledOnce);
			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(
				showInformationMessageStub.firstCall.args[0].includes('GitHub token configured successfully')
			);
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(commentProvider.getRefreshCount(), 1);
		});

		test('should validate manual token input', async () => {
			showQuickPickStub.resolves({ detail: 'manual' });
			showInputBoxStub.resolves('ghp_validtoken123456789');

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			const inputBoxOptions = showInputBoxStub.firstCall.args[0];
			assert.ok(inputBoxOptions.validateInput);

			// Test validation function
			const validate = inputBoxOptions.validateInput;
			assert.strictEqual(validate(''), 'Token cannot be empty');
			assert.strictEqual(
				validate('invalid_token'),
				'Invalid token format. GitHub tokens start with "ghp_" or "github_pat_"'
			);
			assert.strictEqual(validate('ghp_validtoken'), null);
			assert.strictEqual(validate('github_pat_validtoken'), null);
		});

		test('should handle manual token entry cancellation', async () => {
			showQuickPickStub.resolves({ detail: 'manual' });
			showInputBoxStub.resolves(undefined); // User cancels

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			// Should not call setToken or show success message
			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0);
		});

		test('should handle manual token entry error', async () => {
			showQuickPickStub.resolves({ detail: 'manual' });
			showInputBoxStub.resolves('ghp_validtoken123456789');
			sandbox.stub(githubService, 'setToken').rejects(new Error('Token setup failed'));
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(
				showErrorMessageStub.firstCall.args[0].includes('Failed to configure GitHub token')
			);
		});

		test('should handle logout with confirmation', async () => {
			githubService.setAuthenticated(true);
			showQuickPickStub.resolves({ detail: 'logout' });
			showWarningMessageStub.resolves('Sign Out');
			sandbox.stub(githubService, 'removeToken').resolves();
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showWarningMessageStub.calledOnce);
			assert.ok(showWarningMessageStub.firstCall.args[0].includes('Are you sure you want to sign out'));
			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(showInformationMessageStub.firstCall.args[0].includes('You have been signed out'));
			assert.strictEqual(myGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 1);
			assert.strictEqual(commentProvider.getRefreshCount(), 1);
		});

		test('should handle logout cancellation', async () => {
			githubService.setAuthenticated(true);
			showQuickPickStub.resolves({ detail: 'logout' });
			showWarningMessageStub.resolves('Cancel');

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			// Should not refresh providers
			assert.strictEqual(myGistsProvider.getRefreshCount(), 0);
			assert.strictEqual(starredGistsProvider.getRefreshCount(), 0);
		});

		test('should handle logout error', async () => {
			githubService.setAuthenticated(true);
			showQuickPickStub.resolves({ detail: 'logout' });
			showWarningMessageStub.resolves('Sign Out');
			sandbox.stub(githubService, 'removeToken').rejects(new Error('Logout failed'));
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to sign out'));
		});

		test('should handle quick pick cancellation', async () => {
			showQuickPickStub.resolves(undefined);

			registerCommands();

			const setupTokenCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.setupToken'
			);
			const handler = setupTokenCall!.args[1];
			await handler();

			// Should not proceed with any action
			assert.ok(showQuickPickStub.calledOnce);
			assert.ok(showInputBoxStub.notCalled);
		});
	});

	suite('testAPI Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
		});

		test('should show warning when not authenticated', async () => {
			githubService.setAuthenticated(false);

			registerCommands();

			const testApiCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.testAPI'
			);
			const handler = testApiCall!.args[1];
			await handler();

			assert.ok(showWarningMessageStub.calledOnce);
			assert.ok(showWarningMessageStub.firstCall.args[0].includes('Please set up GitHub token first'));
		});

		test('should successfully test API when authenticated', async () => {
			const mockGists = [
				createMockGist({ id: 'gist1', public: true }),
				createMockGist({ id: 'gist2', public: false }),
				createMockGist({ id: 'gist3', public: true })
			];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const testApiCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.testAPI'
			);
			const handler = testApiCall!.args[1];
			await handler();

			assert.ok(showInformationMessageStub.calledOnce);
			const message = showInformationMessageStub.firstCall.args[0];
			assert.ok(message.includes('Found 3 gists'));
			assert.ok(message.includes('Public: 2'));
			assert.ok(message.includes('Private: 1'));
		});

		test('should show details when user clicks Show Details button', async () => {
			const mockGists = [
				createMockGist({ id: 'gist1', public: true, description: 'Test Gist 1' }),
				createMockGist({ id: 'gist2', public: false, description: 'Test Gist 2' })
			];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showInformationMessageStub.resolves('Show Details');

			registerCommands();

			const testApiCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.testAPI'
			);
			const handler = testApiCall!.args[1];
			await handler();

			assert.strictEqual(showInformationMessageStub.callCount, 2);
			const detailsMessage = showInformationMessageStub.secondCall.args[0];
			assert.ok(detailsMessage.includes('Test Gist 1'));
			assert.ok(detailsMessage.includes('Test Gist 2'));
		});

		test('should handle API error', async () => {
			githubService.setAuthenticated(true);
			const apiError = new Error('API request failed');
			sandbox.stub(githubService, 'getCurrentUsername').rejects(apiError);

			registerCommands();

			const testApiCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.testAPI'
			);
			const handler = testApiCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('API test failed'));
		});

		test('should handle gists with no description', async () => {
			const mockGists = [
				createMockGist({ id: 'gist1', public: true, description: '' })
			];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showInformationMessageStub.resolves('Show Details');

			registerCommands();

			const testApiCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.testAPI'
			);
			const handler = testApiCall!.args[1];
			await handler();

			const detailsMessage = showInformationMessageStub.secondCall.args[0];
			assert.ok(detailsMessage.includes('Untitled'));
		});
	});

	suite('checkScopes Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;
		let executeCommandStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			executeCommandStub = sandbox.stub(mockVscode.commands, 'executeCommand');
		});

		test('should show warning when not authenticated', async () => {
			githubService.setAuthenticated(false);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showWarningMessageStub.calledOnce);
			assert.ok(showWarningMessageStub.firstCall.args[0].includes('No GitHub token configured'));
		});

		test('should show success when token has gist scope and both public/private gists exist', async () => {
			const mockGists = [
				createMockGist({ id: 'gist1', public: true }),
				createMockGist({ id: 'gist2', public: false })
			];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'checkTokenScopes').resolves(['gist', 'user']);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showInformationMessageStub.calledOnce);
			const message = showInformationMessageStub.firstCall.args[0];
			assert.ok(message.includes('Authenticated as: testuser'));
			assert.ok(message.includes('Token scopes: gist, user'));
			assert.ok(message.includes('Total gists: 2'));
			assert.ok(message.includes('Public gists: 1'));
			assert.ok(message.includes('Private gists: 1'));
			assert.ok(message.includes('Everything looks good'));
		});

		test('should show error when token is missing gist scope', async () => {
			const mockGists = [
				createMockGist({ id: 'gist1', public: true })
			];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'checkTokenScopes').resolves(['user']); // No gist scope
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			const message = showErrorMessageStub.firstCall.args[0];
			assert.ok(message.includes('PROBLEM FOUND'));
			assert.ok(message.includes('missing the "gist" scope'));
		});

		test('should handle user clicking Setup Token from missing scope error', async () => {
			const mockGists = [createMockGist({ id: 'gist1', public: true })];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'checkTokenScopes').resolves(['user']);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showErrorMessageStub.resolves('Setup Token');

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(executeCommandStub.calledWith('gist-editor.setupToken'));
		});

		test('should show info when no private gists but has gist scope', async () => {
			const mockGists = [
				createMockGist({ id: 'gist1', public: true }),
				createMockGist({ id: 'gist2', public: true })
			];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'checkTokenScopes').resolves(['gist']);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showInformationMessageStub.calledOnce);
			const message = showInformationMessageStub.firstCall.args[0];
			assert.ok(message.includes('Your token has the "gist" scope'));
			assert.ok(message.includes('no private gists'));
		});

		test('should handle user clicking Refresh Gists from no private gists message', async () => {
			const mockGists = [createMockGist({ id: 'gist1', public: true })];

			githubService.setAuthenticated(true);
			githubService.setMockGists(mockGists);
			sandbox.stub(githubService, 'checkTokenScopes').resolves(['gist']);
			sandbox.stub(githubService, 'getCurrentUsername').resolves('testuser');
			sandbox.stub(githubService, 'getMyGists').resolves(mockGists);
			showInformationMessageStub.resolves('Refresh Gists');

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(executeCommandStub.calledWith('gist-editor.refresh'));
		});

		test('should handle 403 error with proper message', async () => {
			githubService.setAuthenticated(true);
			const error: any = new Error('Forbidden');
			error.response = { status: 403 };
			sandbox.stub(githubService, 'checkTokenScopes').rejects(error);
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			const message = showErrorMessageStub.firstCall.args[0];
			assert.ok(message.includes('does not have the required permissions'));
		});

		test('should handle 401 error with proper message', async () => {
			githubService.setAuthenticated(true);
			const error: any = new Error('Unauthorized');
			error.response = { status: 401 };
			sandbox.stub(githubService, 'checkTokenScopes').rejects(error);
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			const message = showErrorMessageStub.firstCall.args[0];
			assert.ok(message.includes('invalid or has been revoked'));
		});

		test('should handle generic error', async () => {
			githubService.setAuthenticated(true);
			const error = new Error('Network error');
			sandbox.stub(githubService, 'checkTokenScopes').rejects(error);
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			const message = showErrorMessageStub.firstCall.args[0];
			assert.ok(message.includes('Network error'));
			assert.ok(message.includes('network issue or GitHub API problem'));
		});

		test('should handle user clicking Open Token Settings from error', async () => {
			const openExternalStub = sandbox.stub(mockVscode.env, 'openExternal');
			githubService.setAuthenticated(true);
			const error: any = new Error('Unauthorized');
			error.response = { status: 401 };
			sandbox.stub(githubService, 'checkTokenScopes').rejects(error);
			showErrorMessageStub.resolves('Open Token Settings');

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(openExternalStub.calledOnce);
		});

		test('should handle outer catch block for unexpected errors', async () => {
			githubService.setAuthenticated(true);
			// Create an error that happens in the outer try block
			sandbox.stub(githubService, 'isAuthenticated').throws(new Error('Unexpected error'));
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const checkScopesCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.checkScopes'
			);
			const handler = checkScopesCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			const message = showErrorMessageStub.firstCall.args[0];
			assert.ok(message.includes('Failed to check permissions'));
		});
	});

	suite('viewApiUsage Command', () => {
		let registerCommandStub: sinon.SinonStub;
		let showWarningMessageStub: sinon.SinonStub;
		let showInformationMessageStub: sinon.SinonStub;
		let showErrorMessageStub: sinon.SinonStub;

		setup(() => {
			registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');
			showWarningMessageStub = sandbox.stub(mockVscode.window, 'showWarningMessage');
			showInformationMessageStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
			showErrorMessageStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
		});

		test('should show warning when not authenticated', async () => {
			githubService.setAuthenticated(false);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			assert.ok(showWarningMessageStub.calledOnce);
			assert.ok(showWarningMessageStub.firstCall.args[0].includes('No GitHub token configured'));
		});

		test('should display API usage statistics', async () => {
			githubService.setAuthenticated(true);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			// Check output channel was cleared and populated
			assert.strictEqual(apiUsageOutputChannel.messages.length > 0, true);

			// Check that the output contains expected sections
			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('GitHub API Usage Statistics'));
			assert.ok(output.includes('SESSION INFORMATION'));
			assert.ok(output.includes('API CALLS BY OPERATION'));
			assert.ok(output.includes('RATE LIMIT STATUS'));
			assert.ok(output.includes('Total API Calls'));
		});

		test('should show rate limit information', async () => {
			githubService.setAuthenticated(true);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('Calls Remaining'));
			assert.ok(output.includes('4990 / 5000'));
		});

		test('should show warning when approaching rate limit', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(githubService, 'getApiUsageStats').returns({
				totalCalls: 100,
				callsByType: { gists: 50, 'user-info': 50 } as { [key: string]: number },
				rateLimit: {
					limit: 5000,
					remaining: 50,
					reset: Date.now() + 3600000,
					resetTime: new Date(Date.now() + 3600000).toISOString()
				},
				sessionStartTime: Date.now() - 1000000
			});
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('WARNING'));
			assert.ok(output.includes('approaching your rate limit'));
		});

		test('should show error when rate limited', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(githubService, 'getApiUsageStats').returns({
				totalCalls: 5000,
				callsByType: { gists: 5000 } as { [key: string]: number },
				rateLimit: {
					limit: 5000,
					remaining: 0,
					reset: Date.now() + 3600000,
					resetTime: new Date(Date.now() + 3600000).toISOString()
				},
				sessionStartTime: Date.now() - 1000000
			});
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('RATE LIMITED'));
			assert.ok(output.includes('hit your API limit'));
		});

		test('should display call types with icons', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(githubService, 'getApiUsageStats').returns({
				totalCalls: 50,
				callsByType: {
					'gists': 20,
					'gist-comments': 10,
					'gist-history': 5,
					'star-unstar': 8,
					'user-info': 7
				} as { [key: string]: number },
				rateLimit: {
					limit: 5000,
					remaining: 4950,
					reset: Date.now() + 3600000,
					resetTime: new Date(Date.now() + 3600000).toISOString()
				},
				sessionStartTime: Date.now() - 1000000
			});
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('📝 gists'));
			assert.ok(output.includes('💬 gist-comments'));
			assert.ok(output.includes('📜 gist-history'));
			assert.ok(output.includes('⭐ star-unstar'));
			assert.ok(output.includes('👤 user-info'));
		});

		test('should handle empty call types', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(githubService, 'getApiUsageStats').returns({
				totalCalls: 0,
				callsByType: {} as { [key: string]: number },
				rateLimit: {
					limit: 5000,
					remaining: 5000,
					reset: Date.now() + 3600000,
					resetTime: new Date(Date.now() + 3600000).toISOString()
				},
				sessionStartTime: Date.now() - 1000000
			});
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('No API calls made yet'));
		});

		test('should format session duration correctly', async () => {
			githubService.setAuthenticated(true);
			const oneHourAgo = Date.now() - (3600 * 1000); // 1 hour ago
			sandbox.stub(githubService, 'getApiUsageStats').returns({
				totalCalls: 10,
				callsByType: { gists: 10 } as { [key: string]: number },
				rateLimit: {
					limit: 5000,
					remaining: 4990,
					reset: Date.now() + 3600000,
					resetTime: new Date(Date.now() + 3600000).toISOString()
				},
				sessionStartTime: oneHourAgo
			});
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(output.includes('Session Duration'));
			// Should include hours in the duration
			assert.ok(output.includes('h'));
		});

		test('should handle error when retrieving stats', async () => {
			githubService.setAuthenticated(true);
			sandbox.stub(githubService, 'getApiUsageStats').throws(new Error('Stats error'));
			showErrorMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			assert.ok(showErrorMessageStub.calledOnce);
			assert.ok(showErrorMessageStub.firstCall.args[0].includes('Failed to retrieve API usage stats'));
		});

		test('should clear output channel before displaying new stats', async () => {
			githubService.setAuthenticated(true);
			apiUsageOutputChannel.appendLine('Old content');
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			// Output channel should have been cleared (messages reset)
			const output = apiUsageOutputChannel.messages.join('');
			assert.ok(!output.includes('Old content'));
		});

		test('should show information message after displaying stats', async () => {
			githubService.setAuthenticated(true);
			showInformationMessageStub.resolves(undefined);

			registerCommands();

			const viewApiUsageCall = registerCommandStub.getCalls().find(
				call => call.args[0] === 'gist-editor.viewApiUsage'
			);
			const handler = viewApiUsageCall!.args[1];
			await handler();

			assert.ok(showInformationMessageStub.calledOnce);
			assert.ok(
				showInformationMessageStub.firstCall.args[0].includes('API usage statistics displayed')
			);
		});
	});
});
