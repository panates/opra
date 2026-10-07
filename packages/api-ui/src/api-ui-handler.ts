import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiDocument } from '@opra/common';
import { ApiUiFactory } from './api-ui.factory.js';
import { buildClientCodegenBundle } from './client-codegen-bundle.js';
import { DocsStudio } from './studio/docs-studio.js';
import type { ApiUiOptions } from './types.js';
import { resolveUiLanguage, UI_LANGUAGES } from './ui-i18n.js';

const SCOPE_ROUTE = /^\/([^/]+)(\/.*)?$/;
const SCHEMA_ROUTE = /^\/schema\/([^/]+)\.json$/;
const OPENAPI_ROUTE = /^\/openapi\/([^/]+)\.json$/;
const CODEGEN_ROUTE = /^\/codegen\/([^/]+\.js)$/;

/** The query parameter that asks for the studio instead of the page. */
const STUDIO_PARAM = 'edit';

/* Written against `node:http`'s own response rather than any framework's,
 * which is what every Node server has underneath - see `serveApiUi` below
 * for why that matters. */
function send(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
  headers?: Record<string, string>,
): void {
  res.writeHead(status, { 'content-type': contentType, ...headers });
  res.end(body);
}

function sendJson(res: ServerResponse, value: unknown, status = 200): void {
  send(res, status, 'application/json', JSON.stringify(value, null, 2));
}

function sendError(res: ServerResponse, status: number, error: string): void {
  sendJson(res, { error }, status);
}

/**
 * Creates a request handler that serves the API reference page for the given
 * `ApiDocument`.
 *
 * Written against `node:http`'s own request and response, which is what every
 * Node server has underneath: `expressApiUi` and `fastifyApiUi` are both
 * three lines around this, and neither owns a copy of what the page is. A
 * caller passes the request with a **mount-relative** `url` and the mount
 * prefix as `basePath` - Express strips the prefix itself, Fastify does not,
 * and the two cannot be recovered from one another.
 *
 * The original description follows, and still describes what is served.
 *
 * Serves the API reference page for the given `ApiDocument`. Each scope's own HTML (see `options.scopes`
 * below — just one, unscoped page when it's left unset) is rendered once,
 * on that scope's first request, and cached for the lifetime of the
 * process, since it only depends on the `ApiDocument` and the options
 * passed here.
 *
 * Three extra routes are served alongside the page itself, relative to
 * wherever this handler is mounted (the page's own navigation is entirely
 * `location.hash`-based — see `assets/app.js` — so real sub-paths never
 * collide with it): `/schema/<docKey>.json` (this document's own native
 * Opra schema, exactly `ApiDocument#export()`'s output), `/openapi/
 * <docKey>.json` (the same document mapped through `@opra/openapi`), and
 * `/codegen/<file>.js` (the browser-side TypeScript-client generator
 * bundle powering the "Download TypeScript Client" button — see
 * `client-codegen-bundle.ts`; `<file>` isn't a fixed name, since that
 * bundle is code-split into several files that import each other by
 * name). `<docKey>` is `"root"` for the document passed in here, or a
 * reference's own namespace — the same keys the page's own document
 * switcher uses.
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
export function serveApiUi(
  document: ApiDocument,
  options?: ApiUiOptions,
): (req: IncomingMessage, res: ServerResponse, basePath?: string) => void {
  const scopes =
    options?.scopes && options.scopes.length > 1 ? options.scopes : undefined;
  const defaultScope = options?.scope || scopes?.[0];
  /** Keyed by scope *and* language: both change what the page embeds, so
   *  one cache entry per combination. */
  const htmlByScope = new Map<string, string>();
  let docsByKey: Map<string, ApiDocument> | undefined;

  /* Built here rather than on the first request that asks for it: a studio
   * is only possible for a document whose translation store can be written
   * to, and an application that asked for one and cannot have one should be
   * told while it is starting up - not by the first person who clicks the
   * button. */
  const studio = options?.studio
    ? new DocsStudio(document, { scope: defaultScope })
    : undefined;

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

  let languageLists_: Pick<ApiUiOptions, 'languages' | 'docLanguages'>;
  /**
   * The selector's menu: every language the document is translated into,
   * plus every language the interface itself ships in, deduplicated
   * case-insensitively (a bundle keyed `zh-hant` and the canonical `zh-Hant`
   * are one entry, spelled the canonical way). `allowed` — an explicit
   * `options.languages` — narrows the result without being able to widen it
   * to a language nothing can actually be rendered in.
   */
  function languageLists(
    allowed?: string[],
  ): Pick<ApiUiOptions, 'languages' | 'docLanguages'> {
    if (!languageLists_) {
      const canonical = new Map<string, string>();
      for (const lang of UI_LANGUAGES) canonical.set(lang.toLowerCase(), lang);
      const docLanguages: string[] = [];
      for (const lang of document.translations.keys()) {
        const known = canonical.get(lang.toLowerCase());
        if (!known) canonical.set(lang.toLowerCase(), lang);
        docLanguages.push(known || lang);
      }
      const permitted = allowed && new Set(allowed.map(l => l.toLowerCase()));
      const keep = (l: string) => !permitted || permitted.has(l.toLowerCase());
      languageLists_ = {
        languages: Array.from(canonical.values()).filter(keep).sort(),
        docLanguages: docLanguages.filter(keep).sort(),
      };
    }
    return languageLists_;
  }

  return (req, res, basePath = '') => {
    /* `req.url` is mount-relative, which is what Express hands a `.use()`d
     * handler and what every other caller has to arrange for itself (see
     * `fastifyApiUi`). The mount prefix comes separately, because the two
     * cannot be recovered from each other and the page needs both: one to
     * route, one to build its own links with. */
    const url = new URL(req.url || '/', 'http://localhost');
    /* Before anything else parses the path: the studio's own routes would
     * otherwise be read as a scope segment. Writing is the studio's entirely
     * - this handler only decides that one exists. */
    if (
      studio &&
      req.method === 'POST' &&
      (url.pathname === DocsStudio.SAVE_ROUTE ||
        url.pathname === DocsStudio.ADD_LANGUAGE_ROUTE)
    ) {
      studio.handle(req, res);
      return;
    }
    let reqPath = url.pathname;
    let scope = options?.scope;
    /* Documentation language comes from `?lang=` only — never from
     * `Accept-Language` — so that one URL always means one response and
     * caches in front of this handler can't mix languages up. Resolved
     * against the document's own bundles (see `ApiDocument#resolveLanguage`)
     * so an unknown value quietly falls back rather than 404ing. */
    const requestedLang = url.searchParams.get('lang') ?? undefined;
    /* Without the parameter the document's own default language answers;
     * a document with no translations at all resolves to nothing, leaving
     * the source texts untouched. */
    const lang = document.resolveLanguage(requestedLang);
    /* The interface's own texts resolve against the dictionaries shipped in
     * `assets/i18n` instead, and always land on *some* language — a document
     * with no translations resolves `lang` to `undefined`, which would
     * otherwise leave the chrome stuck in English for every reader. */
    const uiLang = resolveUiLanguage(requestedLang);

    if (scopes) {
      const scopeMatch = SCOPE_ROUTE.exec(reqPath);
      const scopeSegment = scopeMatch?.[1];
      if (!scopeSegment) {
        res.writeHead(301, {
          location: `${basePath}/${encodeURIComponent(defaultScope!)}`,
        });
        res.end();
        return;
      }
      if (!scopes.includes(scopeSegment)) {
        sendError(res, 404, `Unknown scope "${scopeSegment}"`);
        return;
      }
      scope = scopeSegment;
      reqPath = scopeMatch[2] || '/';
    }

    let m = SCHEMA_ROUTE.exec(reqPath);
    if (m) {
      const doc = getDocsByKey().get(m[1]);
      if (!doc) {
        sendError(res, 404, `Unknown document "${m[1]}"`);
        return;
      }
      sendJson(
        res,
        doc.export({
          scope,
          // Resolved against *this* document — a reference brings its own
          // bundles, and falls back within them alone.
          lang: doc.resolveLanguage(requestedLang),
        }),
      );
      return;
    }

    m = OPENAPI_ROUTE.exec(reqPath);
    if (m) {
      const doc = getDocsByKey().get(m[1]);
      if (!doc) {
        sendError(res, 404, `Unknown document "${m[1]}"`);
        return;
      }
      if (!doc.api || doc.api.transport !== 'http') {
        sendError(
          res,
          400,
          `Document "${m[1]}" has no HTTP api to convert to OpenAPI`,
        );
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
          sendError(
            res,
            501,
            'OpenAPI export requires the "@opra/openapi" package to be installed',
          );
        });
      return;
    }

    m = CODEGEN_ROUTE.exec(reqPath);
    if (m) {
      const filename = m[1];
      // Lazily built (and, once built, cached forever — see
      // `buildClientCodegenBundle`) so a consumer who never clicks
      // "Download TypeScript Client" never pays for `esbuild`/`@opra/cli`
      // to even load, let alone run.
      buildClientCodegenBundle()
        .then(files => {
          const file = files.get(filename);
          if (!file) {
            sendError(res, 404, `Unknown file "${filename}"`);
            return;
          }
          // Only esbuild's own content-hashed shared chunks (`chunk-
          // <hash>.js`) are safe to cache indefinitely — a byte for byte
          // change there always comes with a new filename. The entry
          // file itself (`browser-entry.js`, always that exact name) has
          // no such guarantee: its *content* changes across restarts/
          // upgrades while its name stays fixed, so marking it
          // `immutable` would leave browsers serving a stale copy
          // (referencing chunk filenames the server may no longer even
          // have) forever after the next deploy.
          const isContentHashedChunk = /^chunk-[^/]+\.js$/.test(filename);
          send(res, 200, file.contentType, Buffer.from(file.contents), {
            'cache-control': isContentHashedChunk
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
          });
        })
        .catch(() => {
          sendError(
            res,
            501,
            'The TypeScript client generator requires the optional "esbuild" and "@opra/cli" packages to be installed',
          );
        });
      return;
    }

    /* `uiLang` earns its own place in the key: it resolves independently of
     * the document's own bundles, so for an untranslated document `lang` is
     * always '' and the first reader's interface language would otherwise be
     * handed to everyone after them. */
    /* Rendered fresh every time and never cached, which is the point of the
     * tool: an edit has to show up on the next request. The reader's page a
     * few lines below is the opposite - it depends on nothing but the
     * document and these options, so it is rendered once. */
    if (studio && url.searchParams.has(STUDIO_PARAM)) {
      studio
        .langFor(req.url)
        .then(editing =>
          studio.render(editing, {
            ...options,
            scope,
            studioParam: STUDIO_PARAM,
            ...languageLists(options?.languages),
            basePath,
          }),
        )
        .then(html =>
          send(res, 200, 'text/html; charset=utf-8', html, {
            'cache-control': 'no-store',
          }),
        )
        .catch((e: Error) => {
          send(res, 500, 'text/plain; charset=utf-8', e.message);
        });
      return;
    }

    const htmlCacheKey = `${scope || ''}|${lang || ''}|${uiLang}`;
    let html = htmlByScope.get(htmlCacheKey);
    if (!html) {
      // `basePath` is this handler's own mount prefix (e.g. `/ui`) — it
      // never includes the scope segment above, since that's consumed by
      // this function's own regex matching rather than by a nested route.
      // The scope selector in `assets/app.js` uses this to build a sibling
      // scope's URL without hardcoding its own mount path.
      html = ApiUiFactory.render(document, {
        ...options,
        scope,
        lang,
        uiLang,
        // The document's own translated languages, and the ones the
        // interface itself ships in, are different sets — a reader whose
        // language only exists in the second still gets a localized page, so
        // the selector offers the union. Sorted so its order is the same on
        // every process and platform, rather than following bundle-load
        // order. An explicit `options.languages` narrows the menu.
        ...languageLists(options?.languages),
        /* Only when a studio actually exists: this is what puts the edit
         * button in the header, and a button that leads nowhere is worse
         * than no button. */
        studioParam: studio ? STUDIO_PARAM : undefined,
        basePath,
      });
      htmlByScope.set(htmlCacheKey, html);
    }
    /* `no-cache` means "reuse only after asking", not "do not store". The
     * page carried no cache headers at all, which leaves a browser free to
     * apply its own heuristics - and because the whole application is
     * inlined into this one document, a stale page is stale *code*: the
     * server restarts with new documentation, the reader reloads, and
     * nothing changes. The body is rendered once per process and held in
     * `htmlByScope`, so answering a revalidation costs nothing to build. */
    send(res, 200, 'text/html; charset=utf-8', html, {
      'cache-control': 'no-cache',
    });
  };
}
