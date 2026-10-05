import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { FileWriter } from '../file-writer.js';
import type { IFileWriter } from '../interfaces/file-writer.interface.js';
import { cleanDirectory } from './generators/clean-directory.js';
import type { TsGenerator } from './ts-generator.js';

/**
 * Writes already-generated files (see `TsGenerator#generateFiles()`) to
 * disk under `outDir`, first removing whatever a previous run left
 * there. The only Node-API-dependent (real filesystem access) part of
 * code generation — kept in its own module, dynamically imported by
 * `TsGenerator#generate()` rather than imported at that file's own top
 * level, so a bundler building `generateFiles()` alone for a
 * non-Node target (e.g. a browser) never needs to resolve this file,
 * `node:fs`, or `FileWriter` at all.
 */
export async function writeFilesToDisk(
  files: TsGenerator.GeneratedFile[],
  options: {
    outDir?: string;
    cwd?: string;
    writer?: IFileWriter;
    onVerbose?: (message: string) => void;
  },
): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const outDir = options.outDir ? path.resolve(cwd, options.outDir) : cwd;
  const writer = options.writer || new FileWriter();
  cleanDirectory(outDir, options.onVerbose);
  for (const file of files) {
    const filename = path.join(outDir, file.filename);
    const targetDir = path.dirname(filename);
    fs.mkdirSync(targetDir, { recursive: true });
    await writer.writeFile(filename, file.content);
  }
}
