import type { ApiDocument } from '@opra/common';

/**
 * The logo shown at the top-left of the header. Omitting `logo` entirely
 * (leaving it `undefined`) shows OPRA's own logo — pass `logo: null`
 * explicitly to show no logo at all instead.
 */
export interface ApiUiLogo {
  /** Image URL or data URI. */
  src: string;
  /** `alt` text for the image. Defaults to `label`, or "Logo". */
  alt?: string;
  /** Where clicking the logo navigates to. Defaults to the document's own
   *  root ("Document Info") page. */
  href?: string;
  /** Optional text shown next to the image (e.g. a product name). */
  label?: string;
}

/**
 * Options controlling how the API reference HTML page is rendered.
 */
export interface ApiUiOptions {
  /** `<title>` of the rendered page. Defaults to the ApiDocument's info.title. */
  pageTitle?: string;
  /** Color scheme. Defaults to "dark". */
  theme?: 'dark' | 'light';
  /** Raw CSS injected into a `<style>` tag, applied after the built-in styles. */
  customCss?: string;
  /** CSP nonce applied to the generated inline `<script>`/`<style>` tags. */
  nonce?: string;
  /** Scope filter — only elements matching this scope are included. When
   *  `scopes` (below) is also set, this is the scope actually rendered by
   *  *this* call — i.e. one page per scope, not all of them at once (see
   *  `expressApiUi`). */
  scope?: ApiDocument.ExportOptions['scope'];
  /** Language the page's own embedded documentation is rendered in — the
   *  same resolution rules as `ApiDocument#export({ lang })`. Set by
   *  `expressApiUi` from the request's `?lang=`; a page is rendered (and
   *  cached) per language, the same way it already is per scope. */
  lang?: ApiDocument.ExportOptions['lang'];
  /** Language the interface's *own* texts (section headings, buttons,
   *  tooltips) are rendered in, resolved against the dictionaries shipped in
   *  `assets/i18n` rather than against the document's translation bundles —
   *  `@opra/api-ui` localizes its chrome even for a document that carries no
   *  translations at all. `<html lang>`/`<html dir>` follow this. Defaults to
   *  `lang`; `expressApiUi` sets both from the request's `?lang=`. */
  uiLang?: string;
  /** Every language offered in the header's language selector — by default
   *  the document's own translation bundles *union* the languages the
   *  interface itself ships in. Set this explicitly to narrow the menu to a
   *  list you actually want to offer; the selector is hidden entirely when
   *  fewer than two remain, the same way the scope selector is. */
  languages?: string[];
  /** Which of `languages` the document itself is documented in, so the
   *  selector can group them apart from the interface-only ones. Filled in
   *  automatically by `expressApiUi`. */
  docLanguages?: string[];
  /** The full list of scope keys a reader can switch between (e.g.
   *  `['api', 'db']`) — the same OPRA document can expose different
   *  fields/types per scope (a field `readonly` in one, writable in
   *  another, say), so a single fixed rendering can't show all of that at
   *  once. When set (2 or more entries), the header gets a scope selector;
   *  switching it is a real navigation (a different scope is a genuinely
   *  different rendering, not just a client-side filter toggle), which is
   *  why this is a *served* option, not a `state.*` client preference like
   *  theme/Group By. Omit entirely (the default) for a single fixed scope
   *  and no selector at all. Left to each transport adapter (see
   *  `expressApiUi`) to decide how scope actually appears in the URL. */
  scopes?: string[];
  /** The URL path this page is served from, *excluding* any scope segment
   *  — used by the scope selector (see `scopes` above) to navigate to a
   *  sibling scope's URL. Computed automatically by `expressApiUi` from
   *  the real request; only worth passing explicitly when rendering
   *  outside of that (e.g. writing a static file to a known sub-path). */
  basePath?: string;
  /** Logo shown at the top-left of the header. Defaults to OPRA's own
   *  logo; pass `null` to show none. */
  logo?: ApiUiLogo | null;
}
