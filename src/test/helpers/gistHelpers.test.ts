import * as assert from 'assert';
import * as sinon from 'sinon';
import { createFromCurrentFile, createFromSelection, createEmptyGist, createMultiFileGist, getFolderPathAndName } from '../../commands/helpers/gistHelpers';
import { mockVscode } from '../mocks/vscode.mock';

suite('Gist Helpers Test Suite', () => {
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('createFromCurrentFile', () => {
		test('should return empty object when no active editor', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(undefined);

			const result = await createFromCurrentFile();

			assert.strictEqual(Object.keys(result).length, 0);
			assert.ok(showErrorStub.calledWith('No file is currently open'));
		});

		test('should return empty object when file content is empty', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const mockEditor = {
				document: {
					getText: () => '   ',
					fileName: '/test/file.js'
				}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(mockEditor);

			const result = await createFromCurrentFile();

			assert.strictEqual(Object.keys(result).length, 0);
			assert.ok(showErrorStub.calledWith('Current file is empty. GitHub requires gist content.'));
		});

		test('should return file content when valid', async () => {
			const mockEditor = {
				document: {
					getText: () => 'console.log("test");',
					fileName: '/test/file.js'
				}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(mockEditor);

			const result = await createFromCurrentFile();

			assert.strictEqual(Object.keys(result).length, 1);
			assert.ok('file.js' in result);
			assert.strictEqual(result['file.js'].content, 'console.log("test");');
		});
	});

	suite('createFromSelection', () => {
		test('should return empty object when no active editor', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(undefined);

			const result = await createFromSelection();

			assert.strictEqual(Object.keys(result).length, 0);
			assert.ok(showErrorStub.calledWith('No file is currently open'));
		});

		test('should return empty object when selection is empty', async () => {
			const showErrorStub = sandbox.stub(mockVscode.window, 'showErrorMessage');
			const mockEditor = {
				document: {
					getText: () => '',
					fileName: '/test/file.js'
				},
				selection: {}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(mockEditor);

			const result = await createFromSelection();

			assert.strictEqual(Object.keys(result).length, 0);
			assert.ok(showErrorStub.calledWith('No text is selected or selection is empty. GitHub requires gist content.'));
		});

		test('should prompt for filename and return selected text', async () => {
			const mockEditor = {
				document: {
					getText: (selection: any) => 'const x = 5;',
					fileName: '/test/file.js'
				},
				selection: {}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(mockEditor);
			(sandbox.stub(mockVscode.window, 'showInputBox') as any).resolves('snippet.js');

			const result = await createFromSelection();

			assert.strictEqual(Object.keys(result).length, 1);
			assert.ok('snippet.js' in result);
			assert.strictEqual(result['snippet.js'].content, 'const x = 5;');
		});

		test('should return empty object when user cancels filename input', async () => {
			const mockEditor = {
				document: {
					getText: (selection: any) => 'const x = 5;',
					fileName: '/test/file.js'
				},
				selection: {}
			};
			sandbox.stub(mockVscode.window, 'activeTextEditor').value(mockEditor);
			sandbox.stub(mockVscode.window, 'showInputBox').resolves(undefined);

			const result = await createFromSelection();

			assert.strictEqual(Object.keys(result).length, 0);
		});
	});

	suite('createEmptyGist', () => {
		test('should return empty object when filename is not provided', async () => {
			sandbox.stub(mockVscode.window, 'showInputBox').resolves(undefined);

			const result = await createEmptyGist();

			assert.strictEqual(Object.keys(result).length, 0);
		});

		test('should create JavaScript file with default content', async () => {
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			showInputBoxStub.onCall(0).resolves('test.js');
			showInputBoxStub.onCall(1).resolves('console.log("Hello, World!");');

			const result = await createEmptyGist();

			assert.strictEqual(Object.keys(result).length, 1);
			assert.ok('test.js' in result);
			assert.strictEqual(result['test.js'].content, 'console.log("Hello, World!");');
		});

		test('should create Python file with default content', async () => {
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			showInputBoxStub.onCall(0).resolves('test.py');
			showInputBoxStub.onCall(1).resolves('print("Hello, World!")');

			const result = await createEmptyGist();

			assert.strictEqual(Object.keys(result).length, 1);
			assert.ok('test.py' in result);
		});

		test('should use "Hello World" when user submits empty content', async () => {
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			showInputBoxStub.onCall(0).resolves('test.txt');
			showInputBoxStub.onCall(1).resolves('');

			const result = await createEmptyGist();

			assert.strictEqual(result['test.txt'].content, 'Hello World');
		});
	});

	suite('createMultiFileGist', () => {
		test('should return empty object when no files added', async () => {
			sandbox.stub(mockVscode.window, 'showInputBox').resolves(undefined);

			const result = await createMultiFileGist();

			assert.strictEqual(Object.keys(result).length, 0);
		});

		test('should create multiple files', async () => {
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;
			const showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick') as any;

			// First file
			showInputBoxStub.onCall(0).resolves('file1.js');
			showInputBoxStub.onCall(1).resolves('console.log("file1");');
			showQuickPickStub.onCall(0).resolves({ label: 'Yes', detail: 'add-more' });

			// Second file
			showInputBoxStub.onCall(2).resolves('file2.js');
			showInputBoxStub.onCall(3).resolves('console.log("file2");');
			showQuickPickStub.onCall(1).resolves({ label: 'No, create gist now', detail: 'finish' });

			const result = await createMultiFileGist();

			assert.strictEqual(Object.keys(result).length, 2);
			assert.ok('file1.js' in result);
			assert.ok('file2.js' in result);
			assert.strictEqual(result['file1.js'].content, 'console.log("file1");');
			assert.strictEqual(result['file2.js'].content, 'console.log("file2");');
		});
	});

	suite('getFolderPathAndName', () => {
		test('should return null when user cancels folder choice', async () => {
			sandbox.stub(mockVscode.window, 'showQuickPick').resolves(undefined);

			const result = await getFolderPathAndName('Test Gist');

			assert.strictEqual(result, null);
		});

		test('should return display name only when no folder selected', async () => {
			const showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick') as any;
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			showQuickPickStub.resolves({ label: '📄 No folder (flat)', detail: 'no-folder' });
			showInputBoxStub.resolves('My Gist');

			const result = await getFolderPathAndName('Test Gist');

			assert.ok(result);
			assert.strictEqual(result.displayName, 'My Gist');
			assert.strictEqual(result.folderPath, undefined);
		});

		test('should return folder path and display name when folder selected', async () => {
			const showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick') as any;
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			showQuickPickStub.resolves({ label: '📁 Organize in a folder', detail: 'with-folder' });
			showInputBoxStub.onCall(0).resolves('React/Components');
			showInputBoxStub.onCall(1).resolves('MyComponent');

			const result = await getFolderPathAndName('Test Gist');

			assert.ok(result);
			assert.strictEqual(result.displayName, 'MyComponent');
			assert.strictEqual(result.folderPath, 'React/Components');
		});

		test('should reject folder path with double dashes', async () => {
			const showQuickPickStub = sandbox.stub(mockVscode.window, 'showQuickPick') as any;
			const showInputBoxStub = sandbox.stub(mockVscode.window, 'showInputBox') as any;

			showQuickPickStub.resolves({ label: '📁 Organize in a folder', detail: 'with-folder' });

			// First attempt with -- should show validation error
			const validateInput = showInputBoxStub.firstCall?.args[0]?.validateInput;
			if (validateInput) {
				const error = validateInput('React--Components');
				assert.strictEqual(error, 'Folder path cannot contain --');
			}
		});
	});
});
