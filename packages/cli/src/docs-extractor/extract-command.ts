import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  ApiDocument,
  extractTranslations,
  type TranslationBundle,
} from '@opra/common';
import colors from 'ansi-colors';
import type { ILogger } from '../interfaces/logger.interface.js';

/**
 * Loads an `ApiDocument` from a local module and writes (or refreshes) a
 * documentation translation file for it.
 *
 * Deliberately a *local module* rather than a service url: `docKey` is an
 * authoring-time property that never reaches the published schema, so a
 * document rebuilt from a served `$schema` would produce unstable keys
 * exactly where a `docKey` was declared to prevent them.
 *
 * @param moduleRef - Module path, optionally with the export to use after a
 *   `#` (`./dist/api-document.js#CustomerApiDocument`). The export may be
 *   an `ApiDocument`, a function returning one, or a namespace with a
 *   `create()`.
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

async function loadDocument(moduleRef: string): Promise<ApiDocument> {
  const hashIndex = moduleRef.lastIndexOf('#');
  const modulePath =
    hashIndex > 0 ? moduleRef.substring(0, hashIndex) : moduleRef;
  const exportName =
    hashIndex > 0 ? moduleRef.substring(hashIndex + 1) : undefined;
  const url = pathToFileURL(path.resolve(process.cwd(), modulePath)).href;
  const module = await import(url);
  const candidates = exportName
    ? [module[exportName]]
    : [module.default, ...Object.values(module)];
  for (const candidate of candidates) {
    const document = await resolveDocument(candidate);
    if (document) return document;
  }
  throw new TypeError(
    `No ApiDocument found in "${moduleRef}". Export one (or a function/` +
      'namespace with `create()` returning one), or name the export after a `#`.',
  );
}

async function resolveDocument(value: any): Promise<ApiDocument | undefined> {
  if (value instanceof ApiDocument) return value;
  if (typeof value === 'function') {
    const out = await value();
    return out instanceof ApiDocument ? out : undefined;
  }
  if (value && typeof value.create === 'function') {
    const out = await value.create();
    return out instanceof ApiDocument ? out : undefined;
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
