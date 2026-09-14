import type { ApiDocument } from '@opra/common';
import type { RequestHandler, Response } from 'express';
import { ApiUiFactory } from '../api-ui.factory.js';
import type { ApiUiOptions } from '../types.js';

const SCOPE_ROUTE = /^\/([^/]+)(\/.*)?$/;
const SCHEMA_ROUTE = /^\/schema\/([^/]+)\.json$/;
const OPENAPI_ROUTE = /^\/openapi\/([^/]+)\.json$/;

function sendJson(res: Response, value: unknown): void {
  res.type('application/json').send(JSON.stringify(value, null, 2));
}

/**
 * Creates an Express request handler that serves the API reference page for
 * the given `ApiDocument`. Each scope's own HTML (see `options.scopes`
 * below — just one, unscoped page when it's left unset) is rendered once,
 * on that scope's first request, and cached for the lifetime of the
 * process, since it only depends on the `ApiDocument` and the options
 * passed here.
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
 *
 * When `options.scopes` lists more than one scope, every route above moves
 * one segment deeper, behind a leading `/<scope>` (e.g.
 * `/db/schema/root.json`) — a real, bookmarkable part of the URL, not
 * client-side state, since two scopes of the same OPRA document can expose
 * genuinely different fields/types (not just a filtered view of one fixed
 * rendering). A request to the bare mount root (no scope segment at all)
 * 301-redirects to `options.scope` (the adapter's/caller's own default) or,
 * failing that, `options.scopes[0]`; an unrecognized scope segment 404s.
 */
export function expressApiUi(
  document: ApiDocument,
  options?: ApiUiOptions,
): RequestHandler {
  const scopes =
    options?.scopes && options.scopes.length > 1 ? options.scopes : undefined;
  const defaultScope = options?.scope || scopes?.[0];
  const htmlByScope = new Map<string | undefined, string>();
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
    let reqPath = req.path;
    let scope = options?.scope;

    if (scopes) {
      const scopeMatch = SCOPE_ROUTE.exec(reqPath);
      const scopeSegment = scopeMatch?.[1];
      if (!scopeSegment) {
        res.redirect(
          301,
          `${req.baseUrl}/${encodeURIComponent(defaultScope!)}`,
        );
        return;
      }
      if (!scopes.includes(scopeSegment)) {
        res.status(404).json({ error: `Unknown scope "${scopeSegment}"` });
        return;
      }
      scope = scopeSegment;
      reqPath = scopeMatch[2] || '/';
    }

    let m = SCHEMA_ROUTE.exec(reqPath);
    if (m) {
      const doc = getDocsByKey().get(m[1]);
      if (!doc) {
        res.status(404).json({ error: `Unknown document "${m[1]}"` });
        return;
      }
      sendJson(res, doc.export({ scope }));
      return;
    }

    m = OPENAPI_ROUTE.exec(reqPath);
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
          sendJson(res, OpenApiDocumentFactory.generate(doc, { scope }));
        })
        .catch(() => {
          res.status(501).json({
            error:
              'OpenAPI export requires the "@opra/openapi" package to be installed',
          });
        });
      return;
    }

    let html = htmlByScope.get(scope);
    if (!html) {
      // `req.baseUrl` is this handler's own mount prefix as Express
      // resolved it (e.g. `/ui`) — it never includes the scope segment
      // above, since that's consumed by this function's own regex
      // matching, not a nested Express route. The scope selector in
      // `assets/app.js` uses this to build a sibling scope's URL without
      // hardcoding its own mount path.
      html = ApiUiFactory.render(document, {
        ...options,
        scope,
        basePath: req.baseUrl,
      });
      htmlByScope.set(scope, html);
    }
    res.type('text/html').send(html);
  };
}
