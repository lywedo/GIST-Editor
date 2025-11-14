/**
 * Mock VS Code API for testing
 */

export class MockExtensionContext {
	subscriptions: any[] = [];
	workspaceState: any = {
		get: () => undefined,
		update: () => Promise.resolve()
	};
	globalState: any = {
		get: () => undefined,
		update: () => Promise.resolve()
	};
}

export class MockOutputChannel {
	messages: string[] = [];

	append(value: string) {
		this.messages.push(value);
	}

	appendLine(value: string) {
		this.messages.push(value + '\n');
	}

	clear() {
		this.messages = [];
	}

	show() {}
	hide() {}
	dispose() {}
}

export class MockQuickPick {
	items: any[] = [];
	selectedItems: any[] = [];
	placeholder: string = '';
	matchOnDescription: boolean = false;
	matchOnDetail: boolean = false;
	ignoreFocusOut: boolean = false;
	busy: boolean = false;
	onDidChangeSelection: any = () => ({ dispose: () => {} });
	onDidChangeValue: any = () => ({ dispose: () => {} });
	onDidAccept: any = () => ({ dispose: () => {} });
	onDidHide: any = () => ({ dispose: () => {} });
	show() {}
	hide() {}
	dispose() {}
}

export class MockTreeView {
	selection: any[] = [];
	visible: boolean = true;

	reveal(element: any, options?: any) {
		return Promise.resolve();
	}

	onDidChangeSelection: any = (handler: any) => ({ dispose: () => {} });
	onDidChangeVisibility: any = (handler: any) => ({ dispose: () => {} });
	dispose() {}
}

export const mockVscode = {
	window: {
		showInformationMessage: (...args: any[]) => Promise.resolve(undefined),
		showErrorMessage: (...args: any[]) => Promise.resolve(undefined),
		showWarningMessage: (...args: any[]) => Promise.resolve(undefined),
		showQuickPick: (...args: any[]) => Promise.resolve(undefined),
		showInputBox: (...args: any[]) => Promise.resolve(undefined),
		createOutputChannel: (name: string) => new MockOutputChannel(),
		createTreeView: (id: string, options: any) => new MockTreeView(),
		createQuickPick: () => new MockQuickPick(),
		activeTextEditor: undefined,
		showTextDocument: (...args: any[]) => Promise.resolve(undefined),
		withProgress: (options: any, task: (progress: any) => Promise<any>) => {
			return task({ report: () => {} });
		}
	},
	commands: {
		registerCommand: (command: string, callback: Function) => {
			return { dispose: () => {} };
		},
		executeCommand: (command: string, ...args: any[]) => Promise.resolve()
	},
	workspace: {
		openTextDocument: (...args: any[]) => Promise.resolve(undefined),
		registerFileSystemProvider: (...args: any[]) => ({ dispose: () => {} }),
		getConfiguration: () => ({
			get: () => undefined,
			update: () => Promise.resolve()
		})
	},
	languages: {
		setTextDocumentLanguage: (...args: any[]) => Promise.resolve(undefined)
	},
	env: {
		openExternal: (...args: any[]) => Promise.resolve(true),
		clipboard: {
			writeText: (...args: any[]) => Promise.resolve()
		}
	},
	Uri: {
		parse: (uri: string) => ({ toString: () => uri })
	},
	ProgressLocation: {
		Notification: 15,
		Window: 10,
		SourceControl: 1
	},
	TreeItemCollapsibleState: {
		None: 0,
		Collapsed: 1,
		Expanded: 2
	},
	authentication: {
		getSession: (...args: any[]) => Promise.resolve(undefined)
	}
};
