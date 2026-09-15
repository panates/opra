import path from 'node:path';
import { ApiDocument, BUILTIN, HttpApi } from '@opra/common';
import colors from 'ansi-colors';
import { pascalCase } from 'putil-varhelpers';
import type { TsGenerator } from '../ts-generator.js';

/**
 * Generates the document and its references.
 *
 * @param document - The document to generate.
 * @param options - Generation options.
 * @returns An object containing the generated document and its generator.
 */
export async function generateDocument(
  this: TsGenerator,
  document?: string | ApiDocument,
  options?: {
    typesOnly?: boolean;
  },
): Promise<{
  document: ApiDocument;
  generator: TsGenerator;
}> {
  if (!document || typeof document === 'string') {
    if (document) {
      const out = this._documentsMap.get(document);
      if (out) return out;
    }
    if (!this.serviceUrl) {
      throw new TypeError(
        'Either "serviceUrl" or an already-built ApiDocument is required',
      );
    }
    this.emit(
      'log',
      colors.cyan('Fetching document schema from ') +
        colors.blueBright(this.serviceUrl),
    );
    // Dynamically imported — not at this file's own top level — so a
    // caller that always passes a `document` directly (the browser
    // codegen bundle in `@opra/api-ui`, notably) never needs `@opra/client`
    // resolvable at all, since this whole branch (and this import) is
    // then simply never reached.
    const { OpraHttpClient } = await import('@opra/client');
    const client = new OpraHttpClient(this.serviceUrl);
    document = await client.fetchDocument({ documentId: document });
  }
  this._document = document;
  let out = this._documentsMap.get(document.id);
  if (out) return out;
  out = {
    document,
    generator: this,
  };
  this._documentsMap.set(document.id, out);

  this.emit(
    'log',
    colors.white('[' + document.id + '] ') +
      colors.cyan('Processing document ') +
      colors.magenta(document.info.title || ''),
  );

  if (document.references.size) {
    let refIdGenerator = (options as any)?.refIdGenerator || 1;
    this.emit(
      'log',
      colors.white('[' + document.id + '] ') +
        colors.cyan(`Processing references`),
    );
    for (const ref of document.references.values()) {
      const generator = this.extend();
      generator._document = ref;
      const typesNamespace =
        ref.api?.name ||
        (ref.info.title
          ? pascalCase(ref.info.title)
          : `Reference${refIdGenerator++}`);
      generator._documentRoot = '/references/' + typesNamespace;
      generator._typesRoot = path.posix.join(generator._documentRoot, 'models');
      generator._typesNamespace =
        !this.options.referenceNamespaces || ref[BUILTIN] ? '' : typesNamespace;
      await generator.generateDocument(ref, {
        typesOnly: true,
        refIdGenerator,
      } as any);
    }
  }

  this._fileHeaderDocInfo = `/*
 * ${document.info.title}
 * Id: ${document.id}
 * Version: ${document.info.version}${this.serviceUrl ? `\n * ${this.serviceUrl}` : ''}
 */`;

  if (document.types.size) {
    this.emit(
      'log',
      colors.white('[' + document.id + ']'),
      colors.cyan(`Processing data types`),
    );
    for (const t of document.types.values()) {
      await this.generateDataType(t, 'root');
    }
  }

  if (options?.typesOnly) return out;

  if (document.api instanceof HttpApi) {
    await this.generateHttpApi(document.api);
  }
  return out;
}
