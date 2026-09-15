import { readAsset } from './read-asset.js';
import type { ApiUiOptions } from './types.js';
import { directionFor, loadUiMessages, resolveUiLanguage } from './ui-i18n.js';

const STYLES = readAsset('styles.css');
const VENDOR_MINISEARCH = readAsset('vendor/minisearch.js');
const APP_SCRIPT = readAsset('app.js');

/** The authoring layer, read only when a page actually asks for it — the
 *  editor and its CodeMirror are a few hundred KB nobody reading the docs
 *  should have to download. Lazily cached, since `docs:studio` renders the
 *  page fresh on every request. */
let studioAssets: { script: string; styles: string } | undefined;
function getStudioAssets(): { script: string; styles: string } {
  if (!studioAssets) {
    studioAssets = {
      script:
        readAsset('vendor/codemirror.js') +
        '\n' +
        readAsset('vendor/codemirror-markdown.js') +
        '\n' +
        readAsset('studio.js'),
      styles:
        readAsset('vendor/codemirror.css') + '\n' + readAsset('studio.css'),
    };
  }
  return studioAssets;
}
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
    lang,
    languages,
    docLanguages,
    basePath,
  } = options;
  /* The interface's own language is resolved separately from the document's:
   * `ApiDocument#resolveLanguage` yields `undefined` for a document carrying
   * no translations at all — the common case — and the chrome would then
   * never localize for anyone. `?lang=` still feeds both. */
  const uiLang = resolveUiLanguage(options.uiLang ?? lang);
  const dir = directionFor(uiLang);
  const title = escapeHtml(
    pageTitle || docs.root.info?.title || 'API Reference',
  );
  const nonceAttr = nonceAttribute(nonce);

  const studio = options.authoring ? getStudioAssets() : undefined;
  const styleTag = `<style${nonceAttr}>${STYLES}${studio ? `\n${studio.styles}` : ''}${customCss ? `\n${customCss}` : ''}</style>`;

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
    // The language this page was actually rendered in, so the client can
    // keep asking for the same one (see `exportUrl` in `assets/app.js`) —
    // the schema modal and the generated TypeScript client would otherwise
    // come back in the default language while the page reads in another.
    lang,
    languages: languages && languages.length > 1 ? languages : undefined,
    // Which of `languages` the *document* itself is written in, so the
    // selector can group them apart from the ones that only localize the
    // interface (see `languageSelector` in `assets/app.js`).
    docLanguages,
    dir,
    basePath,
    authoring: options.authoring,
  };

  return `<!doctype html>
<html data-theme="${theme}" lang="${escapeHtmlAttribute(uiLang)}" dir="${dir}">
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
    <script${nonceAttr}>window.__OPRA_I18N__ = ${serializeForScript(loadUiMessages(uiLang))};</script>
    <script${nonceAttr}>${VENDOR_MINISEARCH}</script>
    <script${nonceAttr}>${APP_SCRIPT}</script>${
      studio ? `\n    <script${nonceAttr}>${studio.script}</script>` : ''
    }
  </body>
</html>`;
}
