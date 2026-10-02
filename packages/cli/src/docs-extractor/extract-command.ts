import fs from 'node:fs';
import path from 'node:path';
import {
  type ApiDocument,
  extractTranslations,
  isWritableStore,
  type TranslationBundle,
} from '@opra/common';
import colors from 'ansi-colors';
import type { ILogger } from '../interfaces/logger.interface.js';
import { loadDocument } from './load-document.js';

/**
 * Loads an `ApiDocument` from a local module and writes (or refreshes) its
 * documentation bundle.
 *
 * **Through the document's own `translationStore` by default**, because that
 * is the one place anything reads these texts back from. A path named here
 * instead is a guess about how a document stores its translations, and a
 * wrong guess is silent: the file appears, the texts look extracted, and the
 * page keeps rendering whatever the source declared.
 *
 * @param moduleRef - Module path, optionally with the export to use after a
 *   `#` (see `loadDocument`).
 * @param outFile - Dump the bundle to this file instead of writing it
 *   through the store. For looking at what a document declares, or for a
 *   project that keeps its bundles somewhere this command is not meant to
 *   touch — not the normal path.
 */
export async function extractDocumentTranslations(
  moduleRef: string,
  outFile?: string,
  logger?: ILogger,
): Promise<void> {
  const document = await loadDocument(moduleRef);
  const { bundle, unstable, orphans } = outFile
    ? extractToFile(document, outFile, logger)
    : await extractToStore(document, logger);

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
        `${orphans.length} key(s) in the existing bundle are no longer used ` +
          '(kept — remove them yourself if they really are gone):',
      ),
    );
    for (const key of orphans) logger?.warn?.(colors.yellow('  - ' + key));
  }
  void bundle;
}

/** The normal path: read and write the document's own store, in its own
 *  language. Other languages are translations of this one — they are filled
 *  in by translating, or in the studio, not by extracting a second time. */
async function extractToStore(
  document: ApiDocument,
  logger?: ILogger,
): Promise<ReturnType<typeof extractTranslations>> {
  const store = document.translationStore;
  if (!isWritableStore(store)) {
    throw new Error(
      `"${document.info.title || 'This document'}" has no translation store ` +
        'that can be written to. Give it a `translationStore` whose `save` ' +
        'is implemented, such as `new TranslationFileStore(path.join(' +
        'import.meta.dirname, "./docs"))` — or pass an output file to dump ' +
        'the bundle instead.',
    );
  }
  const lang = document.defaultLanguage;
  /* Re-read rather than trusting what the document materialized at build
   * time: the bundle may have been edited since, by a studio session or by
   * hand, and an extraction that merges onto a stale copy quietly reverts
   * it. */
  const existing = await store.load(lang);
  const result = extractTranslations(document, existing);
  await store.save(lang, result.bundle);
  const where = (await store.locationOf?.(lang)) || `the ${lang} bundle`;
  logger?.log?.(
    colors.greenBright(
      `${existing ? 'Updated' : 'Created'} ${where} (${countTexts(result.bundle)} texts)`,
    ),
  );
  return result;
}

function extractToFile(
  document: ApiDocument,
  outFile: string,
  logger?: ILogger,
): ReturnType<typeof extractTranslations> {
  const existing = fs.existsSync(outFile)
    ? (JSON.parse(fs.readFileSync(outFile, 'utf-8')) as TranslationBundle)
    : undefined;
  const result = extractTranslations(document, existing);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify(result.bundle, null, 2) + '\n',
    'utf-8',
  );
  logger?.log?.(
    colors.greenBright(
      `${existing ? 'Updated' : 'Created'} ${outFile} (${countTexts(result.bundle)} texts)`,
    ),
  );
  return result;
}

function countTexts(bundle: TranslationBundle): number {
  let count = 0;
  for (const value of Object.values(bundle)) {
    if (typeof value === 'string') count++;
    else if (value) count += countTexts(value);
  }
  return count;
}
