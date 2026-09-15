import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { extractTranslations, type TranslationBundle } from '@opra/common';
import colors from 'ansi-colors';
import { loadDocument } from '../docs-extractor/load-document.js';
import type { ILogger } from '../interfaces/logger.interface.js';
import { BundleFile } from './bundle-file.js';

export interface DocsStudioOptions {
  /** Directory holding the per-language bundles (`<dir>/<lang>.json`). */
  docsDir: string;
  /** Which bundle to edit. Defaults to the document's own `defaultLanguage`. */
  lang?: string;
  port?: number;
  /** Scope to render, for a document that exposes more than one. */
  scope?: string;
  logger?: ILogger;
}

const SAVE_ROUTE = '/_studio/save';

/** Every text slot in a bundle, as `"key.segments.field"` — the shape the
 *  client compares against, joined only because it is used as a set member
 *  and never split back apart. */
function leafPaths(bundle: TranslationBundle): string[] {
  const out: string[] = [];
  (function walk(node: TranslationBundle, prefix: string[]): void {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string')
        out.push(JSON.stringify(prefix.concat(key)));
      else if (value) walk(value, prefix.concat(key));
    }
  })(bundle, []);
  return out;
}

/**
 * Serves the API reference UI in authoring mode and writes edits back to the
 * source-language bundle.
 *
 * Bound to loopback and started by hand: this is a writing tool, and the one
 * thing it must never become is a route somebody can leave mounted in
 * production. That is also why it doesn't reuse `expressApiUi` — besides
 * caching every rendered page for the lifetime of the process, that handler
 * is the one meant to be mounted in a real application.
 */
export async function startDocsStudio(
  moduleRef: string,
  options: DocsStudioOptions,
): Promise<http.Server> {
  const logger = options.logger;
  const document = await loadDocument(moduleRef);
  const lang = options.lang || document.defaultLanguage;
  const docsDir = path.resolve(process.cwd(), options.docsDir);
  const file = BundleFile.open(docsDir, lang, document);

  /* `@opra/api-ui` is reached dynamically: it already carries `@opra/cli` as
   * an optional peer (for the browser-side client generator), so a static
   * import here would close a package-level cycle. Same seam `api-ui` itself
   * uses, and the one `dpdm`'s circular check skips. */
  let ApiUiFactory: typeof import('@opra/api-ui').ApiUiFactory;
  try {
    ({ ApiUiFactory } = await import('@opra/api-ui'));
  } catch {
    throw new Error(
      'docs:studio requires the optional "@opra/api-ui" package. ' +
        'Install it and try again.',
    );
  }

  /* Which texts the document actually declares, as `docs:extract` sees them.
   * The page knows where every rendered text *would* be looked up, which is a
   * wider set — the renderer reaches places the export walk doesn't, such as
   * the fields of an anonymous type inlined into a request body. Listing
   * those as work to do would send someone off to write text that the next
   * `docs:extract` then reports as an orphan, so the studio's checklist is
   * scoped to what extraction agrees exists. */
  const declaredSlots = leafPaths(extractTranslations(document).bundle);

  /** Rendered per request, never cached: the point of the tool is seeing an
   *  edit immediately. */
  function renderPage(): string {
    const html = ApiUiFactory.render(document, {
      scope: options.scope,
      lang,
      uiLang: lang,
      authoring: { saveUrl: SAVE_ROUTE, lang },
    });
    return html.replace(
      '</body>',
      `  <script>window.__OPRA_STUDIO_SLOTS__ = ${JSON.stringify(
        declaredSlots,
      ).replace(/</g, '\\u003c')};</script>\n  </body>`,
    );
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === SAVE_ROUTE) {
      handleSave(req, res);
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      /* The page is regenerated from the document on every request precisely
       * so an edit shows up immediately; a browser holding on to a copy of it
       * would undo that. */
      'cache-control': 'no-store',
    });
    res.end(renderPage());
  });

  function handleSave(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c as Buffer));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        const key: string[] = body.key;
        const field: string = body.field;
        const value: string = body.value ?? '';
        if (!Array.isArray(key) || typeof field !== 'string') {
          throw new TypeError('Expected { key: string[], field, value }');
        }
        file.set(key, field, value);
        file.write();
        /* Bundles are materialized once, while the document is built, so the
         * in-memory document would otherwise keep serving the old text on the
         * next full page load. */
        document.translations.set(lang.toLowerCase(), file.bundle);
        logger?.log?.(colors.greenBright(`saved ${[...key, field].join('.')}`));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        logger?.error?.(colors.red(e.message));
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  const wantedPort = options.port ?? 7300;
  await new Promise<void>((resolve, reject) => {
    /* A tool you start and stop all day long hits an occupied port sooner or
     * later; without this, Node's own unhandled 'error' event ends the
     * process in a stack trace rather than a sentence. */
    server.once('error', (e: NodeJS.ErrnoException) =>
      reject(
        e.code === 'EADDRINUSE'
          ? new Error(
              `Port ${wantedPort} is already in use — another studio may ` +
                'still be running. Stop it, or pass --port.',
            )
          : e,
      ),
    );
    server.listen(wantedPort, '127.0.0.1', resolve);
  });
  const { port } = server.address() as { port: number };
  logger?.log?.(
    colors.greenBright(
      `Documentation studio for "${document.info.title || moduleRef}"`,
    ),
  );
  logger?.log?.(`  editing  ${file.filename} (${lang})`);
  logger?.log?.(`  open     http://127.0.0.1:${port}`);
  return server;
}
