import { TsGenerator } from '@opra/cli';
import { ApiDocumentFactory } from '@opra/common';
import { strToU8, zipSync } from 'fflate';

/**
 * Generates a TypeScript client from a document's own native Opra schema
 * (exactly what `GET /schema/<docKey>.json` — see `expressApiUi` —
 * returns) and packs the result into a zip file, entirely in this
 * function's own caller's JS runtime. This is the whole point of
 * bundling `@opra/cli`'s `TsGenerator` this way: no server ever runs
 * code generation on anyone's behalf, it only ever serves the (already
 * public) schema JSON and this one script.
 *
 * @param schema - The native Opra schema, as `ApiDocument#export()`/the
 *   `/schema/<docKey>.json` route returns it (a plain JSON object, not a
 *   live `ApiDocument`) — `ApiDocumentFactory.createDocument()` below is
 *   what turns it back into one, the same live object graph `TsGenerator`
 *   itself expects. Its own `references` field (if any) is only a
 *   lightweight `{id, url, info}` pointer per namespace, *not* enough to
 *   resolve a cross-document type reference (e.g. `cm:Customer`) on its
 *   own — that's what `referenceSchemas` (below) is for.
 * @param referenceSchemas - Each reference namespace's own *full* schema
 *   (the same `/schema/<ns>.json` route, called once per namespace) —
 *   overrides `schema.references`' own lightweight pointers with the
 *   real thing `ApiDocumentFactory` needs to actually resolve types
 *   declared in a reference document.
 * @param options - Forwarded to `TsGenerator` — `fileHeader`/`importExt`/
 *   `referenceNamespaces` only; there's no `outDir`/`serviceUrl` here,
 *   since nothing is ever written to a real filesystem or fetched.
 * @returns A zip file's raw bytes, ready for a browser to save as-is.
 */
export async function generateTypeScriptClientZip(
  schema: object,
  referenceSchemas?: Record<string, object>,
  options?: {
    fileHeader?: string;
    importExt?: boolean;
    referenceNamespaces?: boolean;
  },
): Promise<Uint8Array> {
  const document = await ApiDocumentFactory.createDocument({
    ...(schema as any),
    references: referenceSchemas,
  });
  const generator = new TsGenerator({
    // Required by `TsGenerator.Options`, but never read — `generateFiles()`
    // performs no filesystem access at all.
    outDir: '.',
    ...options,
  });
  const files = await generator.generateFiles(document);
  const zipInput: Record<string, Uint8Array> = {};
  for (const file of files) {
    // `TsFile#filename` is always `/`-prefixed (see `TsGenerator#addFile`)
    // — strip that so the zip's own paths read naturally once extracted.
    const zipPath = file.filename.replace(/^\/+/, '');
    zipInput[zipPath] = strToU8(file.content);
  }
  return zipSync(zipInput, { level: 6 });
}
