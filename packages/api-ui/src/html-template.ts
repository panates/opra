import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiUiOptions } from './types.js';

/**
 * `assets/*` live at the package root, deliberately outside `src/`: a `.js`
 * file living inside `src/` would otherwise get deleted by this package's
 * own `clean:src` script (`ts-cleanup -s src --all` treats any `.js` file
 * without a matching `.ts` as stale build output — a static asset like
 * `app.js` looks exactly like one to it).
 *
 * That puts it one directory *up* from `src/html-template.ts` in dev/test,
 * but the `postbuild` script copies it *alongside* the compiled
 * `build/html-template.js` (so it ships with the published package, which
 * is `build/`'s contents) — check the sibling path first, since that's the
 * one that exists once built.
 */
function readAsset(name: string): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const sibling = path.join(dir, 'assets', name);
  const p = fs.existsSync(sibling)
    ? sibling
    : path.join(dir, '..', 'assets', name);
  return fs.readFileSync(p, 'utf8');
}

const STYLES = readAsset('styles.css');
const VENDOR_MINISEARCH = readAsset('vendor/minisearch.js');
const APP_SCRIPT = readAsset('app.js');
/** Base64 data URI so the default logo needs no extra request — the page
 *  stays a single self-contained file like the rest of this renderer. */
const DEFAULT_LOGO_SRC = `data:image/svg+xml;base64,${Buffer.from(readAsset('logo.svg')).toString('base64')}`;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(str: string): string {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function nonceAttribute(nonce?: string): string {
  return nonce ? ` nonce="${escapeHtmlAttribute(nonce)}"` : '';
}

/** Serializes a value for embedding inside a `<script>` tag, escaping
 *  `</script>` sequences so a string field in it can't prematurely close the tag. */
function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export interface ApiUiDocs {
  /** The flattened root document (see `ApiUiSchemaBuilder.build()`). */
  root: { info?: { title?: string } };
  /** Every non-builtin referenced document, already flattened the same way,
   *  keyed by namespace — the document switcher needs no network fetch. */
  refs: Record<string, object>;
}

/**
 * Renders a self-contained HTML document presenting an interactive reference
 * for the given (already flattened) Opra documents. All rendering logic runs
 * client-side, in plain JS shipped inline with the page — there is no
 * external UI dependency (CDN or npm) and no OpenAPI conversion involved.
 */
export function renderApiUiHtml(
  docs: ApiUiDocs,
  options: ApiUiOptions = {},
): string {
  const {
    pageTitle,
    theme = 'dark',
    customCss,
    nonce,
    scope,
    scopes,
    basePath,
  } = options;
  const title = escapeHtml(
    pageTitle || docs.root.info?.title || 'API Reference',
  );
  const nonceAttr = nonceAttribute(nonce);

  const styleTag = `<style${nonceAttr}>${STYLES}${customCss ? `\n${customCss}` : ''}</style>`;

  // `logo` is `undefined` (not given) vs. explicit `null` (given, meaning
  // "show none") are different outcomes — only the former falls back to
  // OPRA's own logo, so this can't collapse to a single `options.logo ||
  // default` check.
  const logo =
    options.logo === null
      ? null
      : (options.logo ?? { src: DEFAULT_LOGO_SRC, alt: 'OPRA', label: 'OPRA' });
  // `scopes`/`basePath` are only meaningful together (see `ApiUiOptions`) —
  // omitted here (rather than sent as `undefined`/empty) whenever there's
  // nothing to switch between, so `assets/app.js` can key its own "show a
  // scope selector at all?" check off a single truthy check on `ui.scopes`.
  const ui = {
    logo,
    scope,
    scopes: scopes && scopes.length > 1 ? scopes : undefined,
    basePath,
  };

  return `<!doctype html>
<html data-theme="${theme}">
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${styleTag}
  </head>
  <body>
    <div id="app"></div>
    <script${nonceAttr}>window.__OPRA_DOCS__ = ${serializeForScript(docs)};</script>
    <script${nonceAttr}>window.__OPRA_UI__ = ${serializeForScript(ui)};</script>
    <script${nonceAttr}>${VENDOR_MINISEARCH}</script>
    <script${nonceAttr}>${APP_SCRIPT}</script>
  </body>
</html>`;
}
