import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/* ---------------------------------------------------------------------------
   Pure Functions
--------------------------------------------------------------------------- */

/**
 * Extracts React component instances from the provided file content.
 * A React component instance is detected by a tag that starts with an uppercase letter.
 * For each component, this function records an array of objects containing:
 *   - the line number (1-indexed) and
 *   - the trimmed line content where the instance is found.
 *
 * @param content - The source code content as a string.
 * @returns An object mapping component names to an array of instance info.
 */
export function extractReactComponentInstances(content: string): Record<string, { lineNumber: number; lineContent: string }[]> {
  const componentRegex = /<([A-Z][a-zA-Z0-9_]*)\b/g;
  const result: Record<string, { lineNumber: number; lineContent: string }[]> = {};

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    let match: RegExpExecArray | null;
    // Use regex.exec in a loop to find all matches in the line.
    while ((match = componentRegex.exec(line)) !== null) {
      const componentName = match[1];
      if (!result[componentName]) {
        result[componentName] = [];
      }
      result[componentName].push({ lineNumber: index + 1, lineContent: line.trim() });
    }
  });
  return result;
}

/**
 * Checks if a file path matches a given wildcard pattern.
 * Supports:
 *   - Single "*" that matches any sequence of characters except "/".
 *   - Double "**" that matches any sequence (including "/" characters).
 *
 * This function uses a helper that converts a glob pattern into a regular expression.
 *
 * @param filePath - The file path string.
 * @param pattern  - The wildcard pattern.
 * @returns true if the filePath matches the pattern; otherwise, false.
 */
export function matchWildcard(filePath: string, pattern: string): boolean {
  function globToRegex(glob: string): string {
    const doubleStarPlaceholder = '__DS__';
    let prefix = '^';
    // If the glob pattern starts with "**/", allow the initial directory to be optional.
    if (glob.startsWith('**/')) {
      prefix = '^(?:.*\\/)?';
      glob = glob.slice(3);
    }
    // Replace all occurrences of "**" with a placeholder.
    glob = glob.replace(/\*\*/g, doubleStarPlaceholder);
    // Escape regex special characters.
    glob = glob.replace(/([.+^${}()|[\]\\])/g, '\\$1');
    // Replace remaining "*" (single star) with a pattern that matches any characters except "/".
    glob = glob.replace(/\*/g, '[^/]*');
    // Replace the placeholder with ".*" to match any sequence (including "/").
    glob = glob.replace(new RegExp(doubleStarPlaceholder, 'g'), '.*');
    return prefix + glob + '$';
  }
  const regexString = globToRegex(pattern);
  const regex = new RegExp(regexString);
  return regex.test(filePath);
}

/**
 * Filters out file paths that match any of the provided ignore patterns.
 * This version checks both the full file path and the basename.
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
   Impure Functions (File System Access)
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
 * Main function:
 * 1. Recursively reads the root directory (and subdirectories) for files with .js, .ts, .jsx, .tsx extensions.
 * 2. Filters files using the provided ignore patterns.
 * 3. For each file, reads its content and extracts the React component instances.
 * 4. Prints the file name and, for each component found, the line numbers and line content where the component is instantiated.
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
  // Allow .js, .ts, .jsx, .tsx files.
  files = filterByExtension(files, ['.js', '.ts', '.jsx', '.tsx']);
  files = filterIgnoredFiles(files, ignorePatterns);
  for (const file of files) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const components = extractReactComponentInstances(content);
      // Only output files that contain at least one component instance.
      if (Object.keys(components).length > 0) {
        console.log(`File: ${file}`);
        console.log("React Component Instances:");
        for (const [component, instances] of Object.entries(components)) {
          console.log(`  Component: ${component}`);
          instances.forEach(instance => {
            console.log(`    Line ${instance.lineNumber}: ${instance.lineContent}`);
          });
        }
        console.log('--------------------');
      }
    } catch (err) {
      console.error(`Error reading file ${file}:`, err);
    }
  }
}

/* ---------------------------------------------------------------------------
   Unit Tests
--------------------------------------------------------------------------- */

/**
 * Runs unit tests for all pure functions and for component extraction.
 */
export function runTests(): void {
  console.log("Running tests...");

  // --- Test extractReactComponentInstances ---
  {
    const content = `
      import React from 'react';
      function App() {
        return (
          <div>
            <Header />
            <MainContent someProp="value" />
            <Footer />
            <Header prop="another" />
          </div>
        );
      }
      export default App;
    `;
    const instances = extractReactComponentInstances(content);
    // <div> should not be captured because it starts with a lowercase letter.
    assert(!instances['div'], "extractReactComponentInstances: Should not capture 'div' tag");
    // Header should be captured twice.
    assert(instances['Header'] && instances['Header'].length === 2, "extractReactComponentInstances: 'Header' should be found twice");
    // MainContent and Footer should be captured once.
    assert(instances['MainContent'] && instances['MainContent'].length === 1, "extractReactComponentInstances: 'MainContent' should be found once");
    assert(instances['Footer'] && instances['Footer'].length === 1, "extractReactComponentInstances: 'Footer' should be found once");
  }

  // --- Test matchWildcard ---
  {
    // Single star: matches any characters except '/'
    assert.strictEqual(matchWildcard('src/index.tsx', 'src/*.tsx'), true, "matchWildcard: 'src/index.tsx' should match 'src/*.tsx'");
    // Should not match if a directory separator is present in the wildcard region.
    assert.strictEqual(matchWildcard('src/components/index.tsx', 'src/*.tsx'), false, "matchWildcard: 'src/components/index.tsx' should not match 'src/*.tsx'");
    // Double star: matches across directories.
    assert.strictEqual(matchWildcard('src/components/index.tsx', 'src/**/*.tsx'), true, "matchWildcard: 'src/components/index.tsx' should match 'src/**/*.tsx'");
    // Basic patterns.
    assert.strictEqual(matchWildcard('file.jsx', '*.jsx'), true, "matchWildcard: 'file.jsx' should match '*.jsx'");
    assert.strictEqual(matchWildcard('folder/file.jsx', '*.jsx'), false, "matchWildcard: 'folder/file.jsx' should not match '*.jsx'");
    // Additional tests for ignore patterns.
    assert.strictEqual(matchWildcard('jest.config.js', 'jest*'), true, "matchWildcard: 'jest.config.js' should match 'jest*'");
  }

  // --- Test filterIgnoredFiles (with basename checking) ---
  {
    const files = [
      'src/App.tsx',
      'src/App.test.tsx',
      'node_modules/lib.js',
      '../project/jest.config.js',
      '../project/src/__tests__/Sample.test.tsx'
    ];
    // Ignore patterns:
    //   - "**/node_modules/**": Ignore files in any node_modules folder.
    //   - "**/jest*": Ignore files whose basename starts with "jest".
    //   - "*test*": Ignore files whose basename contains "test".
    const ignorePatterns = ['**/node_modules/**', '**/jest*', '*test*'];
    const filtered = filterIgnoredFiles(files, ignorePatterns);
    // Expected remaining file: 'src/App.tsx'
    assert.strictEqual(filtered.length, 1, "filterIgnoredFiles: Should filter out ignored files");
    assert.ok(filtered.includes('src/App.tsx'), "filterIgnoredFiles: 'src/App.tsx' should remain");
  }

  // --- Test parseIgnorePatterns ---
  {
    const patterns = parseIgnorePatterns('node_modules/*, src/ignore.ts');
    assert.deepStrictEqual(patterns, ['node_modules/*', 'src/ignore.ts'], "parseIgnorePatterns: Should split and trim ignore patterns");
  }

  // --- Test filterByExtension ---
  {
    const allFiles = ['a.ts', 'b.js', 'c.jsx', 'd.tsx', 'e.txt'];
    const validFiles = filterByExtension(allFiles, ['.ts', '.js', '.jsx', '.tsx']);
    assert.deepStrictEqual(validFiles, ['a.ts', 'b.js', 'c.jsx', 'd.tsx'], "filterByExtension: Should filter to valid extensions only");
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
    main().catch(err => {
      console.error("An error occurred:", err);
      process.exit(1);
    });
  }
}
