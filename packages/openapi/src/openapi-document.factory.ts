import { omitUndefined } from '@jsopen/objects';
import type { ApiDocument, HttpApi } from '@opra/common';
import { OpenApiGenerateContext } from './context.js';
import { mapDataTypeRef } from './mappers/data-type.mapper.js';
import { mapHttpControllers } from './mappers/http-controller.mapper.js';
import type { OpenApi } from './types/openapi.types.js';

export namespace OpenApiDocumentFactory {
  export interface Options {
    /** Target OpenAPI version. Defaults to `'3.0'`. */
    version?: '3.0' | '3.1';
    /** Only include types/fields/parameters visible in this scope. */
    scope?: string;
  }

  export interface GenerateResult {
    document: OpenApi.Document;
    /** OPRA constructs with no exact OpenAPI equivalent that were mapped
     * on a best-effort basis (or skipped) — e.g. `QUERY`/`SEARCH` methods,
     * pattern-matched parameter names, non-comma array separators. */
    warnings: string[];
  }
}

export namespace OpenApiDocumentFactory {
  /**
   * Generates an OpenAPI 3.0 or 3.1 document from an Opra `ApiDocument`.
   * The `ApiDocument`'s `api.transport` must be `'http'` — OPRA's MQ/WS
   * transports have no OpenAPI equivalent.
   */
  export function generate(
    document: ApiDocument,
    options?: OpenApiDocumentFactory.Options,
  ): OpenApi.Document {
    return generateWithWarnings(document, options).document;
  }

  /** Same as {@link generate}, but also returns the list of best-effort/
   * skipped-construct warnings collected while generating. */
  export function generateWithWarnings(
    document: ApiDocument,
    options?: OpenApiDocumentFactory.Options,
  ): OpenApiDocumentFactory.GenerateResult {
    if (!document.api || document.api.transport !== 'http') {
      throw new TypeError(
        'OpenApiDocumentFactory.generate() requires an ApiDocument whose ' +
          `api.transport is "http" (got "${document.api?.transport}")`,
      );
    }
    const api = document.api as HttpApi;
    const ctx = new OpenApiGenerateContext(options);

    const paths: Record<string, OpenApi.PathItemObject> = {};
    mapHttpControllers(api.controllers.values(), ctx, paths);

    // Every named type registered on the document becomes a
    // `components.schemas` entry, even one no HTTP operation happens to
    // reference — not just types incidentally reached while walking paths.
    for (const dataType of document.types.values()) {
      if (!dataType.inScope(ctx.scope)) continue;
      mapDataTypeRef(dataType, ctx);
    }

    const info = document.info || {};
    const out: OpenApi.Document = {
      openapi: ctx.version === '3.1' ? '3.1.0' : '3.0.3',
      info: omitUndefined({
        title: info.title || api.name || 'API',
        version: info.version || '1.0.0',
        description: info.description,
        termsOfService: info.termsOfService,
        contact: info.contact?.[0]
          ? omitUndefined({ ...info.contact[0] })
          : undefined,
        license: info.license
          ? omitUndefined({ name: info.license.name, url: info.license.url })
          : undefined,
      }),
      paths,
    };
    if (api.url) out.servers = [{ url: api.url }];
    if (Object.keys(ctx.schemas).length)
      out.components = { schemas: ctx.schemas };

    return { document: out, warnings: ctx.warnings };
  }
}
