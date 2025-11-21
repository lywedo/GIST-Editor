/**
 * Map GitHub language names to VS Code language IDs
 * @param githubLanguage The language name from GitHub's API
 * @returns VS Code language ID for syntax highlighting
 */
export function getLanguageId(githubLanguage: string): string {
	const languageMap: { [key: string]: string } = {
		'JavaScript': 'javascript',
		'TypeScript': 'typescript',
		'Python': 'python',
		'Java': 'java',
		'C++': 'cpp',
		'C': 'c',
		'C#': 'csharp',
		'HTML': 'html',
		'CSS': 'css',
		'JSON': 'json',
		'Markdown': 'markdown',
		'Shell': 'shellscript',
		'PowerShell': 'powershell',
		'SQL': 'sql',
		'XML': 'xml',
		'YAML': 'yaml',
		'PHP': 'php',
		'Ruby': 'ruby',
		'Go': 'go',
		'Rust': 'rust',
		'Swift': 'swift',
		'Kotlin': 'kotlin',
		'Dart': 'dart',
		'Text': 'plaintext',
		'R': 'r',
		'Scala': 'scala',
		'Perl': 'perl',
		'Lua': 'lua',
		'Haskell': 'haskell',
		'Clojure': 'clojure',
		'F#': 'fsharp',
		'Visual Basic': 'vb',
		'SCSS': 'scss',
		'Sass': 'sass',
		'Less': 'less',
		'Stylus': 'stylus',
		'Vue': 'vue',
		'React': 'jsx',
		'JSX': 'jsx',
		'TSX': 'tsx',
		'Dockerfile': 'dockerfile',
		'Makefile': 'makefile',
		'Bash': 'shellscript',
		'Zsh': 'shellscript',
		'Fish': 'fish',
		'Batch': 'bat',
		'Assembly': 'asm',
		'TOML': 'toml',
		'INI': 'ini',
		'Properties': 'properties',
		'LaTeX': 'latex',
		'Objective-C': 'objective-c',
		'Objective-C++': 'objective-cpp'
	};
	return languageMap[githubLanguage] || 'plaintext';
}

/**
 * Map file extensions to VS Code language IDs
 * @param filename The name of the file
 * @returns VS Code language ID for syntax highlighting
 */
export function getLanguageFromExtension(filename: string): string {
	const extension = filename.split('.').pop()?.toLowerCase() || '';

	const extensionMap: { [key: string]: string } = {
		// JavaScript family
		'js': 'javascript',
		'jsx': 'jsx',
		'ts': 'typescript',
		'tsx': 'tsx',
		'mjs': 'javascript',
		'cjs': 'javascript',

		// Python
		'py': 'python',
		'pyw': 'python',
		'pyx': 'python',
		'pyi': 'python',

		// Web technologies
		'html': 'html',
		'htm': 'html',
		'xhtml': 'html',
		'css': 'css',
		'scss': 'scss',
		'sass': 'sass',
		'less': 'less',
		'styl': 'stylus',

		// Data formats
		'json': 'json',
		'jsonc': 'jsonc',
		'json5': 'json5',
		'xml': 'xml',
		'yaml': 'yaml',
		'yml': 'yaml',
		'toml': 'toml',
		'ini': 'ini',
		'properties': 'properties',
		'cfg': 'ini',
		'conf': 'properties',

		// Documentation
		'md': 'markdown',
		'markdown': 'markdown',
		'mdown': 'markdown',
		'mkd': 'markdown',
		'tex': 'latex',
		'latex': 'latex',
		'rst': 'restructuredtext',
		'adoc': 'asciidoc',
		'org': 'org',

		// Programming languages
		'java': 'java',
		'kt': 'kotlin',
		'kts': 'kotlin',
		'scala': 'scala',
		'sc': 'scala',
		'groovy': 'groovy',
		'gradle': 'gradle',

		// C family
		'c': 'c',
		'h': 'c',
		'cpp': 'cpp',
		'cxx': 'cpp',
		'cc': 'cpp',
		'hpp': 'cpp',
		'hxx': 'cpp',
		'hh': 'cpp',
		'cs': 'csharp',
		'fs': 'fsharp',
		'fsx': 'fsharp',
		'fsi': 'fsharp',

		// Mobile
		'swift': 'swift',
		'dart': 'dart',
		'm': 'objective-c',
		'mm': 'objective-cpp',

		// Functional languages
		'hs': 'haskell',
		'lhs': 'literate-haskell',
		'elm': 'elm',
		'clj': 'clojure',
		'cljs': 'clojure',
		'cljc': 'clojure',
		'ml': 'ocaml',
		'mli': 'ocaml',
		'f90': 'fortran-modern',
		'f95': 'fortran-modern',

		// Scripting languages
		'rb': 'ruby',
		'rbx': 'ruby',
		'rjs': 'ruby',
		'gemspec': 'ruby',
		'rake': 'ruby',
		'php': 'php',
		'php3': 'php',
		'php4': 'php',
		'php5': 'php',
		'phtml': 'php',
		'pl': 'perl',
		'pm': 'perl',
		'pod': 'perl',
		't': 'perl',
		'lua': 'lua',
		'r': 'r',
		'R': 'r',
		'rmd': 'rmd',

		// Systems languages
		'go': 'go',
		'rs': 'rust',
		'zig': 'zig',
		'nim': 'nim',
		'cr': 'crystal',
		'd': 'd',

		// Shell scripts
		'sh': 'shellscript',
		'bash': 'shellscript',
		'zsh': 'shellscript',
		'fish': 'fish',
		'ps1': 'powershell',
		'psm1': 'powershell',
		'psd1': 'powershell',
		'bat': 'bat',
		'cmd': 'bat',

		// SQL
		'sql': 'sql',
		'mysql': 'sql',
		'pgsql': 'sql',
		'plsql': 'plsql',

		// Assembly
		'asm': 'asm',
		's': 'asm',
		'S': 'asm',
		'nasm': 'nasm',

		// Docker & Infrastructure
		'dockerfile': 'dockerfile',
		'containerfile': 'dockerfile',
		'makefile': 'makefile',
		'mk': 'makefile',
		'cmake': 'cmake',
		'tf': 'terraform',
		'hcl': 'hcl',

		// Frontend frameworks
		'vue': 'vue',
		'svelte': 'svelte',
		'astro': 'astro',

		// Other common formats
		'txt': 'plaintext',
		'text': 'plaintext',
		'log': 'log',
		'csv': 'csv',
		'tsv': 'tsv',
		'svg': 'xml',
		'graphql': 'graphql',
		'gql': 'graphql',
		'proto': 'protobuf',
		'thrift': 'thrift',

		// Image formats
		'png': 'image',
		'jpg': 'image',
		'jpeg': 'image',
		'gif': 'image',
		'webp': 'image',
		'bmp': 'image',
		'ico': 'image',
		'tiff': 'image',
		'tif': 'image'
	};

	return extensionMap[extension] || 'plaintext';
}
