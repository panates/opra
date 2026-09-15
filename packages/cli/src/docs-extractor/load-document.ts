import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ApiDocument } from '@opra/common';

/**
 * Loads an `ApiDocument` from a local module.
 *
 * Deliberately a *local module* rather than a service url: `docKey` is an
 * authoring-time property that never reaches the published schema, so a
 * document rebuilt from a served `$schema` would produce unstable keys
 * exactly where a `docKey` was declared to prevent them.
 *
 * Shared by `docs:extract` and `docs:studio` so the two can never disagree
 * about which document they are looking at — the same reason
 * `extractTranslations()` runs the runtime's own `export()` walk rather than
 * re-implementing it.
 *
 * @param moduleRef - Module path, optionally with the export to use after a
 *   `#` (`./dist/api-document.js#CustomerApiDocument`). The export may be
 *   an `ApiDocument`, a function returning one, or a namespace with a
 *   `create()`.
 */
export async function loadDocument(moduleRef: string): Promise<ApiDocument> {
  const hashIndex = moduleRef.lastIndexOf('#');
  const modulePath =
    hashIndex > 0 ? moduleRef.substring(0, hashIndex) : moduleRef;
  const exportName =
    hashIndex > 0 ? moduleRef.substring(hashIndex + 1) : undefined;
  const url = pathToFileURL(path.resolve(process.cwd(), modulePath)).href;
  let module: Record<string, any>;
  try {
    module = await import(url);
  } catch (e: any) {
    /* A bare `import()` of a `.ts` file only works when the *host* process
     * already has a TypeScript loader registered — there is nothing this
     * command can do about that after the fact, so say so plainly instead of
     * surfacing Node's own "Unknown file extension" message. */
    if (/\.[cm]?ts$/.test(modulePath)) {
      throw new TypeError(
        `Could not import "${modulePath}". Running a TypeScript module ` +
          'directly needs a loader in this process — try\n' +
          '  node --import @swc-node/register/esm-register ' +
          './node_modules/.bin/oprimp ...\n' +
          '(or point at the compiled .js instead).',
        { cause: e },
      );
    }
    throw e;
  }
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
