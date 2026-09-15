import fs from 'node:fs';
import path from 'node:path';
import { extractTranslations, type TranslationBundle } from '@opra/common';
import colors from 'ansi-colors';
import type { ILogger } from '../interfaces/logger.interface.js';
import { loadDocument } from './load-document.js';

/**
 * Loads an `ApiDocument` from a local module and writes (or refreshes) a
 * documentation translation file for it.
 *
 * @param moduleRef - Module path, optionally with the export to use after a
 *   `#` (see `loadDocument`).
 * @param outFile - Where to write the bundle. An existing file's texts are
 *   kept; only missing keys are filled in from the source.
 */
export async function extractDocumentTranslations(
  moduleRef: string,
  outFile: string,
  logger?: ILogger,
): Promise<void> {
  const document = await loadDocument(moduleRef);
  const existing = readExisting(outFile);
  const { bundle, unstable, orphans } = extractTranslations(document, existing);

  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  logger?.log?.(
    colors.greenBright(
      `${existing ? 'Updated' : 'Created'} ${outFile} (${countTexts(bundle)} texts)`,
    ),
  );

  if (unstable.length) {
    logger?.warn?.(
      colors.yellow(
        `${unstable.length} key(s) have no stable identifier behind them; ` +
          'declare a `docKey` for each, or their translations will detach ' +
          'when the declaration moves:',
      ),
    );
    for (const key of unstable) logger?.warn?.(colors.yellow('  - ' + key));
  }
  if (orphans.length) {
    logger?.warn?.(
      colors.yellow(
        `${orphans.length} key(s) in the existing file are no longer used ` +
          '(kept — remove them yourself if they really are gone):',
      ),
    );
    for (const key of orphans) logger?.warn?.(colors.yellow('  - ' + key));
  }
}

function readExisting(outFile: string): TranslationBundle | undefined {
  if (!fs.existsSync(outFile)) return undefined;
  return JSON.parse(fs.readFileSync(outFile, 'utf-8')) as TranslationBundle;
}

function countTexts(bundle: TranslationBundle): number {
  let count = 0;
  for (const value of Object.values(bundle)) {
    if (typeof value === 'string') count++;
    else if (value) count += countTexts(value);
  }
  return count;
}
