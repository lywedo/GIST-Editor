import * as assert from 'assert';
import {
	parseGistDescription,
	createGistDescription,
	getFolderPathString,
	areFolderPathsEqual,
	isPathChild,
	getDisplayPath,
	ParsedGistDescription
} from '../gistDescriptionParser';

suite('Gist Description Parser Test Suite', () => {
	suite('parseGistDescription', () => {
		test('should parse description with folder path and display name', () => {
			const result = parseGistDescription('React/Components - Button Component');

			assert.deepStrictEqual(result.folderPath, ['React', 'Components']);
			assert.strictEqual(result.displayName, 'Button Component');
			assert.strictEqual(result.originalDescription, 'React/Components - Button Component');
		});

		test('should parse single-level folder', () => {
			const result = parseGistDescription('Utils - String utilities');

			assert.deepStrictEqual(result.folderPath, ['Utils']);
			assert.strictEqual(result.displayName, 'String utilities');
		});

		test('should parse deep folder hierarchy', () => {
			const result = parseGistDescription('Frontend/React/Hooks/Custom - useLocalStorage hook');

			assert.deepStrictEqual(result.folderPath, ['Frontend', 'React', 'Hooks', 'Custom']);
			assert.strictEqual(result.displayName, 'useLocalStorage hook');
		});

		test('should handle description without folder path', () => {
			const result = parseGistDescription('Just a simple gist');

			assert.deepStrictEqual(result.folderPath, []);
			assert.strictEqual(result.displayName, 'Just a simple gist');
		});

		test('should handle empty description', () => {
			const result = parseGistDescription('');

			assert.deepStrictEqual(result.folderPath, []);
			assert.strictEqual(result.displayName, '');
			assert.strictEqual(result.originalDescription, '');
		});

		test('should handle null and undefined descriptions', () => {
			const resultNull = parseGistDescription(null as any);
			const resultUndefined = parseGistDescription(undefined as any);

			assert.deepStrictEqual(resultNull.folderPath, []);
			assert.strictEqual(resultNull.displayName, '');

			assert.deepStrictEqual(resultUndefined.folderPath, []);
			assert.strictEqual(resultUndefined.displayName, '');
		});

		test('should trim whitespace from folder parts', () => {
			const result = parseGistDescription('  React  /  Components  - Button Component  ');

			assert.deepStrictEqual(result.folderPath, ['React', 'Components']);
			assert.strictEqual(result.displayName, 'Button Component');
		});

		test('should normalize multiple spaces in folder names', () => {
			const result = parseGistDescription('My   Folder/Sub    Folder - Test');

			assert.deepStrictEqual(result.folderPath, ['My Folder', 'Sub Folder']);
			assert.strictEqual(result.displayName, 'Test');
		});

		test('should handle folders with hyphens', () => {
			const result = parseGistDescription('Frontend-React/UI-Components - Button');

			assert.deepStrictEqual(result.folderPath, ['Frontend-React', 'UI-Components']);
			assert.strictEqual(result.displayName, 'Button');
		});

		test('should handle folders with spaces', () => {
			const result = parseGistDescription('My Projects/Web Development - Portfolio Site');

			assert.deepStrictEqual(result.folderPath, ['My Projects', 'Web Development']);
			assert.strictEqual(result.displayName, 'Portfolio Site');
		});

		test('should filter out empty folder parts', () => {
			const result = parseGistDescription('React//Components/// - Button');

			assert.deepStrictEqual(result.folderPath, ['React', 'Components']);
			assert.strictEqual(result.displayName, 'Button');
		});

		test('should handle description with multiple hyphens', () => {
			const result = parseGistDescription('React/Components - Button - Primary - Large');

			assert.deepStrictEqual(result.folderPath, ['React', 'Components']);
			assert.strictEqual(result.displayName, 'Button - Primary - Large');
		});

		test('should handle description with only hyphen separator', () => {
			const result = parseGistDescription('Just a - separator');

			assert.deepStrictEqual(result.folderPath, ['Just a']);
			assert.strictEqual(result.displayName, 'separator');
		});

		test('should preserve original description', () => {
			const original = 'React/Components - Button Component';
			const result = parseGistDescription(original);

			assert.strictEqual(result.originalDescription, original);
		});

		test('should handle description with numbers', () => {
			const result = parseGistDescription('Version1.0/Release2024 - Changelog');

			assert.deepStrictEqual(result.folderPath, ['Version1.0', 'Release2024']);
			assert.strictEqual(result.displayName, 'Changelog');
		});

		test('should handle description with underscores', () => {
			const result = parseGistDescription('My_Folder/Sub_Folder - Test_File');

			assert.deepStrictEqual(result.folderPath, ['My_Folder', 'Sub_Folder']);
			assert.strictEqual(result.displayName, 'Test_File');
		});
	});

	suite('createGistDescription', () => {
		test('should create description with folder path', () => {
			const result = createGistDescription(['React', 'Components'], 'Button Component');

			assert.strictEqual(result, 'React/Components - Button Component');
		});

		test('should create description with single folder', () => {
			const result = createGistDescription(['Utils'], 'String utilities');

			assert.strictEqual(result, 'Utils - String utilities');
		});

		test('should create description without folder path', () => {
			const result = createGistDescription([], 'Just a gist');

			assert.strictEqual(result, 'Just a gist');
		});

		test('should create description with deep folder hierarchy', () => {
			const result = createGistDescription(
				['Frontend', 'React', 'Hooks', 'Custom'],
				'useLocalStorage'
			);

			assert.strictEqual(result, 'Frontend/React/Hooks/Custom - useLocalStorage');
		});

		test('should handle empty display name', () => {
			const result = createGistDescription(['React', 'Components'], '');

			assert.strictEqual(result, 'React/Components - ');
		});

		test('should handle empty folder array and display name', () => {
			const result = createGistDescription([], '');

			assert.strictEqual(result, '');
		});

		test('should preserve folder names with spaces', () => {
			const result = createGistDescription(['My Projects', 'Web Development'], 'Portfolio');

			assert.strictEqual(result, 'My Projects/Web Development - Portfolio');
		});

		test('should preserve folder names with hyphens', () => {
			const result = createGistDescription(['Frontend-React', 'UI-Components'], 'Button');

			assert.strictEqual(result, 'Frontend-React/UI-Components - Button');
		});
	});

	suite('getFolderPathString', () => {
		test('should convert folder path array to string', () => {
			const result = getFolderPathString(['React', 'Components', 'Button']);

			assert.strictEqual(result, 'React/Components/Button');
		});

		test('should handle single folder', () => {
			const result = getFolderPathString(['Utils']);

			assert.strictEqual(result, 'Utils');
		});

		test('should handle empty array', () => {
			const result = getFolderPathString([]);

			assert.strictEqual(result, '');
		});

		test('should preserve folder names with spaces', () => {
			const result = getFolderPathString(['My Projects', 'Web Development']);

			assert.strictEqual(result, 'My Projects/Web Development');
		});

		test('should join deep hierarchies', () => {
			const result = getFolderPathString(['Level1', 'Level2', 'Level3', 'Level4']);

			assert.strictEqual(result, 'Level1/Level2/Level3/Level4');
		});
	});

	suite('areFolderPathsEqual', () => {
		test('should return true for equal paths', () => {
			const path1 = ['React', 'Components'];
			const path2 = ['React', 'Components'];

			assert.strictEqual(areFolderPathsEqual(path1, path2), true);
		});

		test('should return false for different paths', () => {
			const path1 = ['React', 'Components'];
			const path2 = ['Vue', 'Components'];

			assert.strictEqual(areFolderPathsEqual(path1, path2), false);
		});

		test('should return false for paths with different lengths', () => {
			const path1 = ['React', 'Components'];
			const path2 = ['React', 'Components', 'Button'];

			assert.strictEqual(areFolderPathsEqual(path1, path2), false);
		});

		test('should return true for empty paths', () => {
			const path1: string[] = [];
			const path2: string[] = [];

			assert.strictEqual(areFolderPathsEqual(path1, path2), true);
		});

		test('should return false when one path is empty', () => {
			const path1 = ['React'];
			const path2: string[] = [];

			assert.strictEqual(areFolderPathsEqual(path1, path2), false);
		});

		test('should be case-sensitive', () => {
			const path1 = ['react', 'components'];
			const path2 = ['React', 'Components'];

			assert.strictEqual(areFolderPathsEqual(path1, path2), false);
		});

		test('should check all elements', () => {
			const path1 = ['React', 'Components', 'Button'];
			const path2 = ['React', 'Components', 'Input'];

			assert.strictEqual(areFolderPathsEqual(path1, path2), false);
		});

		test('should handle identical single-element paths', () => {
			const path1 = ['Utils'];
			const path2 = ['Utils'];

			assert.strictEqual(areFolderPathsEqual(path1, path2), true);
		});
	});

	suite('isPathChild', () => {
		test('should return true for child path', () => {
			const childPath = ['React', 'Components', 'Button'];
			const parentPath = ['React', 'Components'];

			assert.strictEqual(isPathChild(childPath, parentPath), true);
		});

		test('should return false for parent path', () => {
			const childPath = ['React'];
			const parentPath = ['React', 'Components'];

			assert.strictEqual(isPathChild(childPath, parentPath), false);
		});

		test('should return false for equal paths', () => {
			const path1 = ['React', 'Components'];
			const path2 = ['React', 'Components'];

			assert.strictEqual(isPathChild(path1, path2), false);
		});

		test('should return false for sibling paths', () => {
			const path1 = ['React', 'Components'];
			const path2 = ['React', 'Hooks'];

			assert.strictEqual(isPathChild(path1, path2), false);
		});

		test('should return false for unrelated paths', () => {
			const path1 = ['Vue', 'Components', 'Button'];
			const path2 = ['React', 'Components'];

			assert.strictEqual(isPathChild(path1, path2), false);
		});

		test('should return true for deep child', () => {
			const childPath = ['Frontend', 'React', 'Hooks', 'Custom', 'useLocalStorage'];
			const parentPath = ['Frontend', 'React'];

			assert.strictEqual(isPathChild(childPath, parentPath), true);
		});

		test('should return false when child path is empty', () => {
			const childPath: string[] = [];
			const parentPath = ['React'];

			assert.strictEqual(isPathChild(childPath, parentPath), false);
		});

		test('should return false when parent path is empty but child is not', () => {
			const childPath = ['React'];
			const parentPath: string[] = [];

			assert.strictEqual(isPathChild(childPath, parentPath), true);
		});

		test('should return false when both paths are empty', () => {
			const childPath: string[] = [];
			const parentPath: string[] = [];

			assert.strictEqual(isPathChild(childPath, parentPath), false);
		});

		test('should check all parent elements', () => {
			const childPath = ['React', 'Hooks', 'Button'];
			const parentPath = ['React', 'Components'];

			assert.strictEqual(isPathChild(childPath, parentPath), false);
		});
	});

	suite('getDisplayPath', () => {
		test('should create display path with arrow separators', () => {
			const result = getDisplayPath(['React', 'Components', 'Button']);

			assert.strictEqual(result, 'React > Components > Button');
		});

		test('should create display path with name appended', () => {
			const result = getDisplayPath(['React', 'Components'], 'Button');

			assert.strictEqual(result, 'React > Components > Button');
		});

		test('should handle single folder', () => {
			const result = getDisplayPath(['Utils']);

			assert.strictEqual(result, 'Utils');
		});

		test('should handle single folder with name', () => {
			const result = getDisplayPath(['Utils'], 'StringHelper');

			assert.strictEqual(result, 'Utils > StringHelper');
		});

		test('should handle empty path', () => {
			const result = getDisplayPath([]);

			assert.strictEqual(result, '');
		});

		test('should handle empty path with name', () => {
			const result = getDisplayPath([], 'MyGist');

			assert.strictEqual(result, 'MyGist');
		});

		test('should preserve folder names with spaces', () => {
			const result = getDisplayPath(['My Projects', 'Web Development'], 'Portfolio Site');

			assert.strictEqual(result, 'My Projects > Web Development > Portfolio Site');
		});

		test('should handle deep hierarchies', () => {
			const result = getDisplayPath(['Level1', 'Level2', 'Level3', 'Level4']);

			assert.strictEqual(result, 'Level1 > Level2 > Level3 > Level4');
		});

		test('should not modify original folder path array', () => {
			const originalPath = ['React', 'Components'];
			const result = getDisplayPath(originalPath, 'Button');

			assert.deepStrictEqual(originalPath, ['React', 'Components']);
			assert.strictEqual(result, 'React > Components > Button');
		});
	});

	suite('Integration Tests', () => {
		test('should parse and recreate description correctly', () => {
			const original = 'React/Components/Button - Primary Button Component';
			const parsed = parseGistDescription(original);
			const recreated = createGistDescription(parsed.folderPath, parsed.displayName);

			assert.strictEqual(recreated, original);
		});

		test('should handle round-trip with no folder', () => {
			const original = 'Simple Gist';
			const parsed = parseGistDescription(original);
			const recreated = createGistDescription(parsed.folderPath, parsed.displayName);

			assert.strictEqual(recreated, original);
		});

		test('should work with complex folder hierarchy', () => {
			const original = 'Projects/2024/Frontend/React/Components - UserProfile';
			const parsed = parseGistDescription(original);
			const recreated = createGistDescription(parsed.folderPath, parsed.displayName);

			assert.strictEqual(recreated, original);
			assert.deepStrictEqual(parsed.folderPath, ['Projects', '2024', 'Frontend', 'React', 'Components']);
			assert.strictEqual(parsed.displayName, 'UserProfile');
		});

		test('should maintain folder path hierarchy checks', () => {
			const parent = parseGistDescription('React/Components - Container');
			const child = parseGistDescription('React/Components/Button - Primary');
			const sibling = parseGistDescription('React/Hooks - useEffect Example');

			assert.strictEqual(isPathChild(child.folderPath, parent.folderPath), true);
			assert.strictEqual(isPathChild(sibling.folderPath, parent.folderPath), false);
			assert.strictEqual(areFolderPathsEqual(parent.folderPath, child.folderPath), false);
		});
	});
});
