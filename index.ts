import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extracts all import statements from the provided file content.
 * Returns a mapping from local component names to the full import statement.
 *
 * Supports both default and named imports (including aliasing).
 *
 * Example:
 *   import App from "./App.tsx";      --> maps "App" to the entire import line.
 *   import { StrictMode } from "react"; --> maps "StrictMode" to that line.
 *   import { Foo as Bar } from "baz";   --> maps "Bar" to that line.
 *
 * @param content - The file content.
 * @returns An object mapping component names to their import statements.
 */
export function extractImportStatements(content: string): Record<string, string> {
  const importMap: Record<string, string> = {};

  // Default imports, optionally ending with a semicolon.
  const defaultImportRegex = /import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?/g;
  let match: RegExpExecArray | null;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    importMap[match[1]] = match[0];
  }

  // Named imports, optionally ending with a semicolon.
  const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const importedItems = match[1].split(',').map(item => item.trim());
    for (const item of importedItems) {
      let localName = item;
      if (item.includes(' as ')) {
        localName = item.split(' as ')[1].trim();
      }
      importMap[localName] = match[0];
    }
  }
  return importMap;
}

/**
 * Extracts React component instances from the provided file content.
 *
 * It scans through the file line by line looking for JSX tags with an uppercase first letter,
 * then attaches the corresponding import statement (if any) by looking up in the import map.
 *
 * This regex now uses a negative lookbehind (?<![A-Za-z0-9_$]) so that the "<" is not preceded
 * by an alphanumeric character, underscore, or "$". This avoids matching generic type parameters.
 *
 * @param content - The source code content as a string.
 * @returns An object mapping component names to an array of instance info,
 *          each including the line number, the trimmed line text, and the associated import.
 */
export function extractReactComponentInstances(content: string): Record<string, { lineNumber: number; lineContent: string; importStatement?: string }[]> {
  const result: Record<string, { lineNumber: number; lineContent: string; importStatement?: string }[]> = {};
  const importMap = extractImportStatements(content);
  const lines = content.split('\n');
  // Updated regex: ensure the "<" is not preceded by a letter, digit, underscore, or "$".
//   const componentRegex = /(?<![A-Za-z0-9_$])<([A-Z][a-zA-Z0-9_]*)\b/g;
  const componentRegex = /<([A-Z][a-zA-Z0-9_]*)\b/g;
  lines.forEach((line, index) => {
    let match: RegExpExecArray | null;
    while ((match = componentRegex.exec(line)) !== null) {
      const componentName = match[1];
      if (!result[componentName]) {
        result[componentName] = [];
      }
      result[componentName].push({
        lineNumber: index + 1,
        lineContent: line.trim(),
        importStatement: importMap[componentName]
      });
    }
  });
  return result;
}

/* ---------------------------------------------------------------------------
   File System Helper Functions
--------------------------------------------------------------------------- */

/**
 * Recursively collects all file paths in the specified directory.
 *
 * @param dir - The directory to search.
 * @returns A promise that resolves to an array of file path strings.
 */
export async function getAllFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  const list = await fs.promises.readdir(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = await fs.promises.stat(fullPath);
    if (stat && stat.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      results = results.concat(subFiles);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Checks if a file path matches a given wildcard pattern.
 *
 * @param filePath - The file path string.
 * @param pattern  - The wildcard pattern.
 * @returns true if the filePath matches the pattern; otherwise, false.
 */
export function matchWildcard(filePath: string, pattern: string): boolean {
  function globToRegex(glob: string): string {
    const doubleStarPlaceholder = '__DS__';
    let prefix = '^';
    if (glob.startsWith('**/')) {
      prefix = '^(?:.*\\/)?';
      glob = glob.slice(3);
    }
    glob = glob.replace(/\*\*/g, doubleStarPlaceholder);
    glob = glob.replace(/([.+^${}()|[\]\\])/g, '\\$1');
    glob = glob.replace(/\*/g, '[^/]*');
    glob = glob.replace(new RegExp(doubleStarPlaceholder, 'g'), '.*');
    return prefix + glob + '$';
  }
  const regexString = globToRegex(pattern);
  const regex = new RegExp(regexString);
  return regex.test(filePath);
}

/**
 * Filters out file paths that match any of the provided ignore patterns.
 *
 * @param filePaths      - Array of file path strings.
 * @param ignorePatterns - Array of wildcard ignore patterns.
 * @returns An array of file paths that do not match any ignore pattern.
 */
export function filterIgnoredFiles(filePaths: string[], ignorePatterns: string[]): string[] {
  return filePaths.filter(filePath => {
    const baseName = path.basename(filePath);
    return !ignorePatterns.some(pattern =>
      matchWildcard(filePath, pattern) || matchWildcard(baseName, pattern)
    );
  });
}

/**
 * Filters an array of file paths to include only those with one of the allowed extensions.
 *
 * @param filePaths  - Array of file path strings.
 * @param extensions - Array of allowed extensions (e.g., [".js", ".ts", ".jsx", ".tsx"]).
 * @returns An array of file paths that have one of the allowed extensions.
 */
export function filterByExtension(filePaths: string[], extensions: string[]): string[] {
  return filePaths.filter(filePath => extensions.includes(path.extname(filePath)));
}

/**
 * Parses a comma-separated string of ignore patterns.
 *
 * @param ignoreStr - Comma-separated string (e.g., "node_modules/*, src/ignore.ts").
 * @returns An array of trimmed, non-empty ignore patterns.
 */
export function parseIgnorePatterns(ignoreStr: string): string[] {
  if (!ignoreStr) return [];
  return ignoreStr.split(',').map(s => s.trim()).filter(Boolean);
}

/* ---------------------------------------------------------------------------
   Main Execution Function
--------------------------------------------------------------------------- */

/**
 * Main function:
 * 1. Reads the root directory and its subdirectories for files with allowed extensions.
 * 2. Filters files using the provided ignore patterns.
 * 3. Reads each file’s content, extracts React component instances,
 *    and prints out the file name along with each component's instance information.
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node index.js <rootDir> [ignorePatterns]");
    process.exit(1);
  }
  const rootDir = args[0];
  const ignoreStr = args[1] || "";
  const ignorePatterns = parseIgnorePatterns(ignoreStr);
  let files = await getAllFiles(rootDir);
  files = filterByExtension(files, ['.js', '.ts', '.jsx', '.tsx']);
  files = filterIgnoredFiles(files, ignorePatterns);
  
  for (const file of files) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const components = extractReactComponentInstances(content);
      if (Object.keys(components).length > 0) {
        console.log(`File: ${file}`);
        console.log("React Component Instances:");
        for (const [component, instances] of Object.entries(components)) {
          console.log(`  Component: ${component}`);
          instances.forEach(instance => {
            console.log(`    Line ${instance.lineNumber}: ${instance.lineContent}`);
            if (instance.importStatement) {
              console.log(`      imported from ${instance.importStatement}`);
            }
          });
        }
        console.log('--------------------');
      }
    } catch (err: any) {
      console.error(`Error reading file ${file}:`, err);
    }
  }
  console.log("Scanned Files:", files);

}

/* ---------------------------------------------------------------------------
   Unit Tests
--------------------------------------------------------------------------- */

export function runTests(): void {
  console.log("Running tests...");

  // --- Test extractImportStatements ---
  {
    const content = `
import { StrictMode } from "react";
import App from "./App.tsx";
import { Foo as Bar } from "baz";
`;
    const importMap = extractImportStatements(content);
    assert.strictEqual(importMap["StrictMode"], 'import { StrictMode } from "react";', "Should capture named import 'StrictMode'");
    assert.strictEqual(importMap["App"], 'import App from "./App.tsx";', "Should capture default import 'App'");
    assert.strictEqual(importMap["Bar"], 'import { Foo as Bar } from "baz";', "Should capture alias import 'Bar'");
  }

  // --- Test extractReactComponentInstances ---
  {
    // Updated test content with no leading newline.
    const content = `import { StrictMode } from "react";
import App from "./App.tsx";
function Main() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}`;
    const instances = extractReactComponentInstances(content);
    // 'StrictMode' should be found on line 5 with its import statement
    assert(instances["StrictMode"], "Should capture 'StrictMode' instance");
    assert.strictEqual(instances["StrictMode"][0].lineNumber, 5, "'StrictMode' instance should be on line 5");
    assert.strictEqual(instances["StrictMode"][0].importStatement, 'import { StrictMode } from "react";', "Import for 'StrictMode' should match");
    // 'App' should be found on line 6 with its import statement
    assert(instances["App"], "Should capture 'App' instance");
    assert.strictEqual(instances["App"][0].lineNumber, 6, "'App' instance should be on line 6");
    assert.strictEqual(instances["App"][0].importStatement, 'import App from "./App.tsx";', "Import for 'App' should match");
  }

  // --- Test that generic type parameters are ignored ---
  {
    const content = `function example<T>() {
  return Promise.resolve<T>();
}
type MyType = Promise<Character>;
`;
    // The regex should NOT match the generic "Character" in "Promise<Character>"
    const instances = extractReactComponentInstances(content);
    assert.strictEqual(Object.keys(instances).length, 0, "Should not capture generic type parameters as component instances");
  }

  // --- Test matchWildcard ---
  {
    assert.strictEqual(matchWildcard('src/index.tsx', 'src/*.tsx'), true, "'src/index.tsx' should match 'src/*.tsx'");
    assert.strictEqual(matchWildcard('src/components/index.tsx', 'src/*.tsx'), false, "'src/components/index.tsx' should not match 'src/*.tsx'");
    assert.strictEqual(matchWildcard('src/components/index.tsx', 'src/**/*.tsx'), true, "'src/components/index.tsx' should match 'src/**/*.tsx'");
  }

  // --- Test filterIgnoredFiles ---
  {
    const files = [
      'src/App.tsx',
      'src/App.test.tsx',
      'node_modules/lib.js'
    ];
    const ignorePatterns = ['**/node_modules/**', '*test*'];
    const filtered = filterIgnoredFiles(files, ignorePatterns);
    assert.deepStrictEqual(filtered, ['src/App.tsx'], "Should filter out ignored files");
  }

  // --- Test ignoring dist directories ---
  {
    const files = [
      'src/App.tsx',
      'dist/assets/index.js',
      'src/components/Widget.tsx'
    ];
    const ignorePatterns = ['**/dist/**'];
    const filtered = filterIgnoredFiles(files, ignorePatterns);
    assert.deepStrictEqual(filtered, ['src/App.tsx', 'src/components/Widget.tsx'], "Should ignore files in dist directories");
  }

  // --- Test parseIgnorePatterns ---
  {
    const patterns = parseIgnorePatterns('node_modules/*, src/ignore.ts');
    assert.deepStrictEqual(patterns, ['node_modules/*', 'src/ignore.ts'], "Should split and trim ignore patterns");
  }

  // --- Test filterByExtension ---
  {
    const allFiles = ['a.ts', 'b.js', 'c.jsx', 'd.tsx', 'e.txt'];
    const validFiles = filterByExtension(allFiles, ['.ts', '.js', '.jsx', '.tsx']);
    assert.deepStrictEqual(validFiles, ['a.ts', 'b.js', 'c.jsx', 'd.tsx'], "Should filter to valid extensions only");
  }

  console.log("All tests passed!");
}

/* ---------------------------------------------------------------------------
   Execution Entry Point
--------------------------------------------------------------------------- */

if (require.main === module) {
  if (process.argv.includes('--test')) {
    runTests();
  } else {
    main().catch((err: any) => {
      console.error("An error occurred:", err);
      process.exit(1);
    });
  }
}
