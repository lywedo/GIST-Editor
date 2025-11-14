import * as assert from 'assert';
import * as sinon from 'sinon';
import { registerBasicCommands } from '../../../commands/basic/basicCommands';
import { MockExtensionContext } from '../../mocks/vscode.mock';
import { MockGistProvider } from '../../mocks/services.mock';
import { mockVscode } from '../../mocks/vscode.mock';

suite('Basic Commands Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let context: MockExtensionContext;
	let myGistsProvider: MockGistProvider;
	let starredGistsProvider: MockGistProvider;
	let clearSearchCacheCalled: boolean;

	setup(() => {
		sandbox = sinon.createSandbox();
		context = new MockExtensionContext();
		myGistsProvider = new MockGistProvider();
		starredGistsProvider = new MockGistProvider();
		clearSearchCacheCalled = false;
	});

	teardown(() => {
		sandbox.restore();
	});

	test('should register helloWorld and refresh commands', () => {
		const clearSearchCache = () => { clearSearchCacheCalled = true; };

		registerBasicCommands(context as any, myGistsProvider as any, starredGistsProvider as any, clearSearchCache);

		assert.strictEqual(context.subscriptions.length, 2);
	});

	test('helloWorld command should show information message', () => {
		const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
		const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

		const clearSearchCache = () => { clearSearchCacheCalled = true; };
		registerBasicCommands(context as any, myGistsProvider as any, starredGistsProvider as any, clearSearchCache);

		// Get the helloWorld command handler
		const helloWorldCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.helloWorld');
		assert.ok(helloWorldCall, 'helloWorld command should be registered');

		// Execute the handler
		const handler = helloWorldCall.args[1];
		handler();

		assert.ok(showInfoStub.calledWith('Hello World from Gist Editor!'));
	});

	test('refresh command should clear cache and refresh providers', () => {
		const showInfoStub = sandbox.stub(mockVscode.window, 'showInformationMessage');
		const registerCommandStub = sandbox.stub(mockVscode.commands, 'registerCommand');

		const clearSearchCache = () => { clearSearchCacheCalled = true; };
		registerBasicCommands(context as any, myGistsProvider as any, starredGistsProvider as any, clearSearchCache);

		// Get the refresh command handler
		const refreshCall = registerCommandStub.getCalls().find(call => call.args[0] === 'gist-editor.refresh');
		assert.ok(refreshCall, 'refresh command should be registered');

		// Execute the handler
		const handler = refreshCall.args[1];
		handler();

		assert.strictEqual(clearSearchCacheCalled, true, 'search cache should be cleared');
		assert.strictEqual(myGistsProvider.getRefreshCount(), 1, 'myGistsProvider should be refreshed');
		assert.strictEqual(starredGistsProvider.getRefreshCount(), 1, 'starredGistsProvider should be refreshed');
		assert.ok(showInfoStub.calledWith('Gists refreshed!'));
	});
});
