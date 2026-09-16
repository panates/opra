import fs from 'node:fs';
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
  const initialLang = options.lang || document.defaultLanguage;
  const docsDir = path.resolve(process.cwd(), options.docsDir);

  /* One open bundle per language, kept because it holds the parsed object
   * whose key order a save must not disturb — reopening the file on every
   * request would be correct but would also drop the reason for holding it. */
  const files = new Map<string, BundleFile>();
  function bundleFor(lang: string): BundleFile {
    const key = lang.toLowerCase();
    let file = files.get(key);
    if (!file) {
      file = BundleFile.open(docsDir, lang, document);
      files.set(key, file);
    }
    return file;
  }
  bundleFor(initialLang);

  /** Every language that has a bundle in `--docs`, which is exactly the set
   *  the studio can write to. A tag nobody has a file for isn't offered:
   *  creating one from the document would fill it with the source language's
   *  own prose (see `BundleFile.open`), which reads as "already translated"
   *  in every screen that follows. `--lang` is how a new one is started. */
  function availableLanguages(): string[] {
    const found = fs.existsSync(docsDir)
      ? fs
          .readdirSync(docsDir)
          .filter(f => f.endsWith('.json'))
          .map(f => path.basename(f, '.json'))
      : [];
    if (!found.some(l => l.toLowerCase() === initialLang.toLowerCase())) {
      found.push(initialLang);
    }
    return found.sort((a, b) => a.localeCompare(b));
  }

  /** The language a request is for. Falls back to the one the command was
   *  started with rather than trusting the query: quietly editing a file the
   *  caller didn't name is the one mistake this tool must not make, and the
   *  header badge only tells the truth if this does. */
  function langFor(url: string | undefined): string {
    const asked = new URL(url || '/', 'http://localhost').searchParams.get(
      'lang',
    );
    if (!asked) return initialLang;
    return (
      availableLanguages().find(l => l.toLowerCase() === asked.toLowerCase()) ||
      initialLang
    );
  }

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

  /** `</script>` inside an inline script would end it early, so the one
   *  character that can do that never survives serialization. */
  function embed(name: string, value: unknown): string {
    return `window.${name} = ${JSON.stringify(value).replace(/</g, '\\u003c')};`;
  }

  /** Rendered per request, never cached: the point of the tool is seeing an
   *  edit immediately. Switching the language being edited is a fresh request
   *  for the same reason — the prose, the interface and the bundle all change
   *  together, and re-deriving them here is what keeps them from disagreeing. */
  function renderPage(lang: string): string {
    const file = bundleFor(lang);
    const html = ApiUiFactory.render(document, {
      scope: options.scope,
      lang,
      uiLang: lang,
      authoring: {
        saveUrl: SAVE_ROUTE,
        lang,
        file: path.relative(process.cwd(), file.filename),
        languages: availableLanguages(),
      },
    });
    const script =
      '  <script>' +
      embed('__OPRA_STUDIO_SLOTS__', declaredSlots) +
      /* The bundle as it is on disk, which is not what the page shows: a
       * text this file doesn't carry is rendered from the source instead, so
       * judging "already written" by what is on screen would call every
       * untranslated entry done — and open its editor pre-filled with the
       * source language. The editor edits the file, so it reads the file. */
      embed('__OPRA_STUDIO_BUNDLE__', file.bundle) +
      '</script>\n';
    /* Spliced at the *last* `</body>` and by index, not with `replace()`:
     * the page has the whole of `app.js` and `studio.js` inlined into it, and
     * the first `</body>` in it is one written inside a comment in that
     * source — replacing that one injects the script into the middle of a
     * function. (Indexing also sidesteps `replace()`'s `$` patterns, which a
     * bundle of arbitrary prose could otherwise trigger.) */
    const at = html.lastIndexOf('</body>');
    if (at < 0) return html + script;
    return html.slice(0, at) + script + html.slice(at);
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
    res.end(renderPage(langFor(req.url)));
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
        /* The page says which language it was written in, rather than the
         * server remembering a "current" one: two tabs open on two languages
         * is a perfectly reasonable way to translate, and a server-side
         * current would send one tab's edit into the other's file. */
        const lang = availableLanguages().find(
          l => l.toLowerCase() === String(body.lang || '').toLowerCase(),
        );
        if (!lang) throw new TypeError(`No bundle for language "${body.lang}"`);
        const file = bundleFor(lang);
        file.set(key, field, value);
        file.write();
        /* Bundles are materialized once, while the document is built, so the
         * in-memory document would otherwise keep serving the old text on the
         * next full page load. */
        document.translations.set(lang.toLowerCase(), file.bundle);
        logger?.log?.(
          colors.greenBright(`saved ${[...key, field].join('.')} (${lang})`),
        );
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
  logger?.log?.(
    `  editing  ${bundleFor(initialLang).filename} (${initialLang})`,
  );
  const others = availableLanguages().filter(
    l => l.toLowerCase() !== initialLang.toLowerCase(),
  );
  if (others.length) logger?.log?.(`  also     ${others.join(', ')}`);
  logger?.log?.(`  open     http://127.0.0.1:${port}`);
  return server;
}
