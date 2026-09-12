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
  /** Scope filter — only elements matching this scope are included. */
  scope?: ApiDocument.ExportOptions['scope'];
  /** Logo shown at the top-left of the header. Defaults to OPRA's own
   *  logo; pass `null` to show none. */
  logo?: ApiUiLogo | null;
}
