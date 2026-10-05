import fs from 'node:fs';
import path from 'node:path';
import colors from 'ansi-colors';

/**
 * Cleans the output directory.
 *
 * @param dirname - The directory to clean.
 * @param onVerbose - Called with a human-readable message for each
 *   directory/file actually removed. Plain callback rather than an
 *   `this: TsGenerator`-bound `emit()` (as this used to be) — this runs
 *   from `write-to-disk.ts`, a standalone function with no generator
 *   instance of its own to bind to.
 */
export function cleanDirectory(
  dirname: string,
  onVerbose?: (message: string) => void,
) {
  const rootDir = dirname;
  const _cleanDirectory = (targetDir: string) => {
    if (!fs.existsSync(targetDir)) return;
    const files = fs.readdirSync(targetDir);
    for (const f of files) {
      const absolutePath = path.join(targetDir, f);
      if (fs.statSync(absolutePath).isDirectory()) {
        _cleanDirectory(absolutePath);
        if (!fs.readdirSync(absolutePath).length) {
          onVerbose?.(
            colors.cyan(
              `Removing directory ${path.relative(absolutePath, rootDir)}`,
            ),
          );
          fs.rmdirSync(absolutePath);
        }
        continue;
      }
      if (path.extname(f) === '.ts') {
        const contents = fs.readFileSync(absolutePath, 'utf-8');
        if (contents.includes('#!oprimp_auto_generated!#')) {
          onVerbose?.(
            colors.cyan(
              `Removing file ${path.relative(absolutePath, rootDir)}`,
            ),
          );
          fs.unlinkSync(absolutePath);
        }
      }
    }
  };
  _cleanDirectory(dirname);
}
