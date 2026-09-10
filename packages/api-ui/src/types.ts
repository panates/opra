import type { ApiDocument } from '@opra/common';

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
}
