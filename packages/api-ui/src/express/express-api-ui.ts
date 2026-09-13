import type { ApiDocument } from '@opra/common';
import type { RequestHandler, Response } from 'express';
import { ApiUiFactory } from '../api-ui.factory.js';
import type { ApiUiOptions } from '../types.js';

const SCHEMA_ROUTE = /^\/schema\/([^/]+)\.json$/;
const OPENAPI_ROUTE = /^\/openapi\/([^/]+)\.json$/;

function sendJson(res: Response, value: unknown): void {
  res.type('application/json').send(JSON.stringify(value, null, 2));
}

/**
 * Creates an Express request handler that serves the API reference page for
 * the given `ApiDocument`. The HTML is rendered once (on first request) and
 * cached for the lifetime of the process, since it only depends on the
 * `ApiDocument` and the options passed here.
 *
 * Two extra routes are served alongside the page itself, relative to
 * wherever this handler is mounted (the page's own navigation is entirely
 * `location.hash`-based — see `assets/app.js` — so real sub-paths never
 * collide with it): `/schema/<docKey>.json` (this document's own native
 * Opra schema, exactly `ApiDocument#export()`'s output) and
 * `/openapi/<docKey>.json` (the same document mapped through
 * `@opra/openapi`). `<docKey>` is `"root"` for the document passed in
 * here, or a reference's own namespace — the same keys the page's own
 * document switcher uses.
 */
export function expressApiUi(
  document: ApiDocument,
  options?: ApiUiOptions,
): RequestHandler {
  let html: string | undefined;
  let docsByKey: Map<string, ApiDocument> | undefined;

  function getDocsByKey(): Map<string, ApiDocument> {
    if (!docsByKey) {
      docsByKey = new Map([['root', document]]);
      for (const [ns, refDocument] of document.references.entries()) {
        if (ns === 'opra') continue; // the framework's own builtin reference
        docsByKey.set(ns, refDocument);
      }
    }
    return docsByKey;
  }

  return (req, res) => {
    let m = SCHEMA_ROUTE.exec(req.path);
    if (m) {
      const doc = getDocsByKey().get(m[1]);
      if (!doc) {
        res.status(404).json({ error: `Unknown document "${m[1]}"` });
        return;
      }
      sendJson(res, doc.export({ scope: options?.scope }));
      return;
    }

    m = OPENAPI_ROUTE.exec(req.path);
    if (m) {
      const doc = getDocsByKey().get(m[1]);
      if (!doc) {
        res.status(404).json({ error: `Unknown document "${m[1]}"` });
        return;
      }
      if (!doc.api || doc.api.transport !== 'http') {
        res.status(400).json({
          error: `Document "${m[1]}" has no HTTP api to convert to OpenAPI`,
        });
        return;
      }
      // Loaded lazily so consumers who never use this route (or the
      // OpenAPI export button it powers) aren't forced to install
      // `@opra/openapi` just to serve the reference page itself.
      import('@opra/openapi')
        .then(({ OpenApiDocumentFactory }) => {
          sendJson(
            res,
            OpenApiDocumentFactory.generate(doc, { scope: options?.scope }),
          );
        })
        .catch(() => {
          res.status(501).json({
            error:
              'OpenAPI export requires the "@opra/openapi" package to be installed',
          });
        });
      return;
    }

    html ??= ApiUiFactory.render(document, options);
    res.type('text/html').send(html);
  };
}
