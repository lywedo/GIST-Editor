import * as assert from 'assert';
import { getLanguageId, getLanguageFromExtension } from '../../utils/languageDetection';

suite('Language Detection Test Suite', () => {
	suite('getLanguageId', () => {
		test('should map common GitHub languages to VS Code language IDs', () => {
			assert.strictEqual(getLanguageId('JavaScript'), 'javascript');
			assert.strictEqual(getLanguageId('TypeScript'), 'typescript');
			assert.strictEqual(getLanguageId('Python'), 'python');
			assert.strictEqual(getLanguageId('Java'), 'java');
			assert.strictEqual(getLanguageId('Go'), 'go');
			assert.strictEqual(getLanguageId('Rust'), 'rust');
		});

		test('should map C family languages correctly', () => {
			assert.strictEqual(getLanguageId('C'), 'c');
			assert.strictEqual(getLanguageId('C++'), 'cpp');
			assert.strictEqual(getLanguageId('C#'), 'csharp');
			assert.strictEqual(getLanguageId('Objective-C'), 'objective-c');
			assert.strictEqual(getLanguageId('Objective-C++'), 'objective-cpp');
		});

		test('should map web technologies correctly', () => {
			assert.strictEqual(getLanguageId('HTML'), 'html');
			assert.strictEqual(getLanguageId('CSS'), 'css');
			assert.strictEqual(getLanguageId('SCSS'), 'scss');
			assert.strictEqual(getLanguageId('Sass'), 'sass');
			assert.strictEqual(getLanguageId('Less'), 'less');
			assert.strictEqual(getLanguageId('Vue'), 'vue');
		});

		test('should map JSX and TSX correctly', () => {
			assert.strictEqual(getLanguageId('React'), 'jsx');
			assert.strictEqual(getLanguageId('JSX'), 'jsx');
			assert.strictEqual(getLanguageId('TSX'), 'tsx');
		});

		test('should map shell scripting languages', () => {
			assert.strictEqual(getLanguageId('Shell'), 'shellscript');
			assert.strictEqual(getLanguageId('Bash'), 'shellscript');
			assert.strictEqual(getLanguageId('Zsh'), 'shellscript');
			assert.strictEqual(getLanguageId('PowerShell'), 'powershell');
			assert.strictEqual(getLanguageId('Fish'), 'fish');
			assert.strictEqual(getLanguageId('Batch'), 'bat');
		});

		test('should map data formats correctly', () => {
			assert.strictEqual(getLanguageId('JSON'), 'json');
			assert.strictEqual(getLanguageId('YAML'), 'yaml');
			assert.strictEqual(getLanguageId('XML'), 'xml');
			assert.strictEqual(getLanguageId('TOML'), 'toml');
			assert.strictEqual(getLanguageId('INI'), 'ini');
		});

		test('should map functional languages', () => {
			assert.strictEqual(getLanguageId('Haskell'), 'haskell');
			assert.strictEqual(getLanguageId('Clojure'), 'clojure');
			assert.strictEqual(getLanguageId('F#'), 'fsharp');
			assert.strictEqual(getLanguageId('Scala'), 'scala');
		});

		test('should map mobile development languages', () => {
			assert.strictEqual(getLanguageId('Swift'), 'swift');
			assert.strictEqual(getLanguageId('Kotlin'), 'kotlin');
			assert.strictEqual(getLanguageId('Dart'), 'dart');
		});

		test('should map scripting languages', () => {
			assert.strictEqual(getLanguageId('Ruby'), 'ruby');
			assert.strictEqual(getLanguageId('PHP'), 'php');
			assert.strictEqual(getLanguageId('Perl'), 'perl');
			assert.strictEqual(getLanguageId('Lua'), 'lua');
			assert.strictEqual(getLanguageId('R'), 'r');
		});

		test('should map documentation languages', () => {
			assert.strictEqual(getLanguageId('Markdown'), 'markdown');
			assert.strictEqual(getLanguageId('LaTeX'), 'latex');
		});

		test('should map SQL and database languages', () => {
			assert.strictEqual(getLanguageId('SQL'), 'sql');
		});

		test('should map Text to plaintext', () => {
			assert.strictEqual(getLanguageId('Text'), 'plaintext');
		});

		test('should default to plaintext for unknown languages', () => {
			assert.strictEqual(getLanguageId('UnknownLanguage'), 'plaintext');
			assert.strictEqual(getLanguageId('RandomStuff'), 'plaintext');
			assert.strictEqual(getLanguageId(''), 'plaintext');
		});

		test('should map containerization and build tools', () => {
			assert.strictEqual(getLanguageId('Dockerfile'), 'dockerfile');
			assert.strictEqual(getLanguageId('Makefile'), 'makefile');
		});

		test('should map other languages', () => {
			assert.strictEqual(getLanguageId('Assembly'), 'asm');
			assert.strictEqual(getLanguageId('Visual Basic'), 'vb');
			assert.strictEqual(getLanguageId('Properties'), 'properties');
			assert.strictEqual(getLanguageId('Stylus'), 'stylus');
		});
	});

	suite('getLanguageFromExtension', () => {
		test('should detect JavaScript extensions', () => {
			assert.strictEqual(getLanguageFromExtension('script.js'), 'javascript');
			assert.strictEqual(getLanguageFromExtension('module.mjs'), 'javascript');
			assert.strictEqual(getLanguageFromExtension('common.cjs'), 'javascript');
			assert.strictEqual(getLanguageFromExtension('component.jsx'), 'jsx');
		});

		test('should detect TypeScript extensions', () => {
			assert.strictEqual(getLanguageFromExtension('app.ts'), 'typescript');
			assert.strictEqual(getLanguageFromExtension('component.tsx'), 'tsx');
		});

		test('should detect Python extensions', () => {
			assert.strictEqual(getLanguageFromExtension('script.py'), 'python');
			assert.strictEqual(getLanguageFromExtension('script.pyw'), 'python');
			assert.strictEqual(getLanguageFromExtension('cython.pyx'), 'python');
			assert.strictEqual(getLanguageFromExtension('stub.pyi'), 'python');
		});

		test('should detect web technology extensions', () => {
			assert.strictEqual(getLanguageFromExtension('index.html'), 'html');
			assert.strictEqual(getLanguageFromExtension('page.htm'), 'html');
			assert.strictEqual(getLanguageFromExtension('style.css'), 'css');
			assert.strictEqual(getLanguageFromExtension('style.scss'), 'scss');
			assert.strictEqual(getLanguageFromExtension('style.sass'), 'sass');
			assert.strictEqual(getLanguageFromExtension('style.less'), 'less');
			assert.strictEqual(getLanguageFromExtension('style.styl'), 'stylus');
		});

		test('should detect data format extensions', () => {
			assert.strictEqual(getLanguageFromExtension('config.json'), 'json');
			assert.strictEqual(getLanguageFromExtension('tsconfig.jsonc'), 'jsonc');
			assert.strictEqual(getLanguageFromExtension('config.yaml'), 'yaml');
			assert.strictEqual(getLanguageFromExtension('config.yml'), 'yaml');
			assert.strictEqual(getLanguageFromExtension('data.xml'), 'xml');
			assert.strictEqual(getLanguageFromExtension('config.toml'), 'toml');
			assert.strictEqual(getLanguageFromExtension('config.ini'), 'ini');
		});

		test('should detect shell script extensions', () => {
			assert.strictEqual(getLanguageFromExtension('script.sh'), 'shellscript');
			assert.strictEqual(getLanguageFromExtension('script.bash'), 'shellscript');
			assert.strictEqual(getLanguageFromExtension('script.zsh'), 'shellscript');
			assert.strictEqual(getLanguageFromExtension('script.ps1'), 'powershell');
			assert.strictEqual(getLanguageFromExtension('script.fish'), 'fish');
			assert.strictEqual(getLanguageFromExtension('script.bat'), 'bat');
			assert.strictEqual(getLanguageFromExtension('script.cmd'), 'bat');
		});

		test('should detect compiled language extensions', () => {
			assert.strictEqual(getLanguageFromExtension('Main.java'), 'java');
			assert.strictEqual(getLanguageFromExtension('main.c'), 'c');
			assert.strictEqual(getLanguageFromExtension('main.cpp'), 'cpp');
			assert.strictEqual(getLanguageFromExtension('main.cc'), 'cpp');
			assert.strictEqual(getLanguageFromExtension('main.cxx'), 'cpp');
			assert.strictEqual(getLanguageFromExtension('Program.cs'), 'csharp');
			assert.strictEqual(getLanguageFromExtension('main.go'), 'go');
			assert.strictEqual(getLanguageFromExtension('main.rs'), 'rust');
		});

		test('should detect mobile development extensions', () => {
			assert.strictEqual(getLanguageFromExtension('ViewController.swift'), 'swift');
			assert.strictEqual(getLanguageFromExtension('MainActivity.kt'), 'kotlin');
			assert.strictEqual(getLanguageFromExtension('main.dart'), 'dart');
		});

		test('should detect documentation extensions', () => {
			assert.strictEqual(getLanguageFromExtension('README.md'), 'markdown');
			assert.strictEqual(getLanguageFromExtension('document.markdown'), 'markdown');
			assert.strictEqual(getLanguageFromExtension('paper.tex'), 'latex');
		});

		test('should detect scripting language extensions', () => {
			assert.strictEqual(getLanguageFromExtension('script.rb'), 'ruby');
			assert.strictEqual(getLanguageFromExtension('script.php'), 'php');
			assert.strictEqual(getLanguageFromExtension('script.pl'), 'perl');
			assert.strictEqual(getLanguageFromExtension('script.lua'), 'lua');
			assert.strictEqual(getLanguageFromExtension('analysis.r'), 'r');
		});

		test('should detect Vue and Svelte', () => {
			assert.strictEqual(getLanguageFromExtension('Component.vue'), 'vue');
			assert.strictEqual(getLanguageFromExtension('Component.svelte'), 'svelte');
		});

		test('should detect containerization files', () => {
			assert.strictEqual(getLanguageFromExtension('Dockerfile'), 'dockerfile');
			assert.strictEqual(getLanguageFromExtension('Makefile'), 'makefile');
			assert.strictEqual(getLanguageFromExtension('.gitignore'), 'ignore');
			assert.strictEqual(getLanguageFromExtension('.dockerignore'), 'ignore');
		});

		test('should be case-insensitive for extensions', () => {
			assert.strictEqual(getLanguageFromExtension('Script.JS'), 'javascript');
			assert.strictEqual(getLanguageFromExtension('Script.PY'), 'python');
			assert.strictEqual(getLanguageFromExtension('README.MD'), 'markdown');
			assert.strictEqual(getLanguageFromExtension('Config.JSON'), 'json');
		});

		test('should handle filenames with multiple dots', () => {
			assert.strictEqual(getLanguageFromExtension('app.spec.ts'), 'typescript');
			assert.strictEqual(getLanguageFromExtension('config.prod.json'), 'json');
			assert.strictEqual(getLanguageFromExtension('component.test.jsx'), 'jsx');
		});

		test('should default to plaintext for unknown extensions', () => {
			assert.strictEqual(getLanguageFromExtension('file.unknown'), 'plaintext');
			assert.strictEqual(getLanguageFromExtension('noextension'), 'plaintext');
			assert.strictEqual(getLanguageFromExtension(''), 'plaintext');
		});

		test('should handle files without extensions', () => {
			assert.strictEqual(getLanguageFromExtension('Dockerfile'), 'dockerfile');
			assert.strictEqual(getLanguageFromExtension('Makefile'), 'makefile');
			assert.strictEqual(getLanguageFromExtension('Gemfile'), 'ruby');
			assert.strictEqual(getLanguageFromExtension('Rakefile'), 'ruby');
		});

		test('should detect additional data formats', () => {
			assert.strictEqual(getLanguageFromExtension('data.csv'), 'csv');
			assert.strictEqual(getLanguageFromExtension('config.properties'), 'properties');
			assert.strictEqual(getLanguageFromExtension('.env'), 'dotenv');
		});

		test('should detect GraphQL and configuration files', () => {
			assert.strictEqual(getLanguageFromExtension('schema.graphql'), 'graphql');
			assert.strictEqual(getLanguageFromExtension('query.gql'), 'graphql');
		});

		test('should detect Haskell and functional languages', () => {
			assert.strictEqual(getLanguageFromExtension('main.hs'), 'haskell');
			assert.strictEqual(getLanguageFromExtension('main.fs'), 'fsharp');
			assert.strictEqual(getLanguageFromExtension('main.clj'), 'clojure');
			assert.strictEqual(getLanguageFromExtension('main.scala'), 'scala');
		});

		test('should detect SQL variants', () => {
			assert.strictEqual(getLanguageFromExtension('query.sql'), 'sql');
		});

		test('should detect infrastructure as code', () => {
			assert.strictEqual(getLanguageFromExtension('main.tf'), 'terraform');
			assert.strictEqual(getLanguageFromExtension('vars.tfvars'), 'terraform');
			assert.strictEqual(getLanguageFromExtension('docker-compose.yml'), 'yaml');
		});
	});

	suite('Edge Cases', () => {
		test('getLanguageId should handle case sensitivity', () => {
			// The function is case-sensitive for GitHub language names
			assert.strictEqual(getLanguageId('javascript'), 'plaintext');
			assert.strictEqual(getLanguageId('JAVASCRIPT'), 'plaintext');
			assert.strictEqual(getLanguageId('JavaScript'), 'javascript');
		});

		test('getLanguageFromExtension should handle empty filenames', () => {
			assert.strictEqual(getLanguageFromExtension(''), 'plaintext');
			assert.strictEqual(getLanguageFromExtension('.'), 'plaintext');
		});

		test('getLanguageFromExtension should handle filenames with only dots', () => {
			assert.strictEqual(getLanguageFromExtension('...'), 'plaintext');
			assert.strictEqual(getLanguageFromExtension('.hidden'), 'plaintext');
		});

		test('should handle special filenames correctly', () => {
			assert.strictEqual(getLanguageFromExtension('.gitignore'), 'ignore');
			assert.strictEqual(getLanguageFromExtension('.npmignore'), 'ignore');
			assert.strictEqual(getLanguageFromExtension('.eslintrc'), 'json');
			assert.strictEqual(getLanguageFromExtension('.prettierrc'), 'json');
		});
	});
});
