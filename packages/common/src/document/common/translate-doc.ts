import type { TranslationBundle } from '../../i18n/translation-store.js';
import type { ApiDocument } from '../api-document.js';
import type { DocumentElement } from './document-element.js';

/**
 * The only properties a translation bundle is ever allowed to replace.
 * Everything else in the schema — `examples[].value`, enum values,
 * `default`, `pattern`, names, paths — is data, not prose, and is never
 * touched.
 */
export type TranslatableField = 'description' | 'title' | 'deprecated';

/**
 * Passed through `export()` to collect the translation keys a document
 * *would* look up, instead of (well, alongside) resolving them — see
 * `extractTranslations`. Deliberately driven by the same `export()` walk
 * and the same per-call whitelist the runtime lookup uses, so an extracted
 * skeleton can't drift from what is actually asked for at serve time.
 */
export interface TranslationCollector {
  /** The skeleton being built, pre-filled with whatever the source says. */
  bundle: TranslationBundle;
  /** Keys whose last segment had to be derived from something that isn't a
   *  stable identifier (a RegExp-named parameter, an example's position) —
   *  a `docKey` should be declared for each of these. */
  unstable: string[];
}

/**
 * Replaces `element`'s own prose in an already-built schema object with the
 * requested language's text, if there is any. A no-op unless
 * `options.lang` was given, which is what keeps a plain `export()`/
 * `toJSON()` returning exactly what the source declares.
 *
 * Each `toJSON()` calls this once with its own list of prose properties, so
 * the whitelist lives at the call site where it can be read next to the
 * object it applies to, rather than in a table somewhere else.
 */
export function applyTranslations<T extends Record<string, any>>(
  element: DocumentElement,
  out: T,
  options: ApiDocument.ExportOptions | undefined,
  fields: TranslatableField[],
  /** Extra segments below `element`'s own key, for prose that belongs to a
   *  plain object rather than a document element of its own (a server, a
   *  section, an example). */
  extraSegments?: string[],
  /** Set where those extra segments had to be made up rather than taken
   *  from a real identifier — the element-level equivalent is
   *  `DocumentElement#docKeyUnstable`. */
  extraUnstable?: boolean,
): T {
  if (options?.collect) {
    collectKeys(
      element,
      out,
      options.collect,
      fields,
      extraSegments,
      extraUnstable,
    );
  }
  if (!options?.lang) return out;
  const texts = findTexts(element, options.lang, extraSegments);
  if (!texts) return out;
  for (const field of fields) {
    const value = texts[field];
    if (typeof value !== 'string') continue;
    // `deprecated` is `boolean | string`: only its string form is prose, so
    // a translation may reword an existing reason but must never turn
    // `deprecated: true` into text, nor deprecate something that isn't.
    if (field === 'deprecated' && typeof out.deprecated !== 'string') continue;
    (out as Record<string, any>)[field] = value;
  }
  return out;
}

/** Records this element's prose under its own key, so the produced skeleton
 *  reads like the schema tree and starts out holding the texts already
 *  written in the source. */
function collectKeys(
  element: DocumentElement,
  out: Record<string, any>,
  collector: TranslationCollector,
  fields: TranslatableField[],
  extraSegments?: string[],
  extraUnstable?: boolean,
): void {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = out[field];
    if (typeof value === 'string') {
      values[field] = value;
      continue;
    }
    // `deprecated` is only translatable where it already carries a reason —
    // a bundle can reword one but never invent one (see `applyTranslations`),
    // so an empty placeholder for it would be dead weight. Every other
    // field gets one: the runtime looks it up whether or not the source
    // happens to define it, which is exactly the point once the texts have
    // moved out of the source entirely.
    if (field !== 'deprecated') values[field] = '';
  }
  if (!Object.keys(values).length) return;
  const segments = extraSegments
    ? element.docKeySegments.concat(extraSegments)
    : element.docKeySegments;
  let node = collector.bundle;
  for (const segment of segments) {
    const next = node[segment];
    node = (
      next && typeof next === 'object' ? next : (node[segment] = {})
    ) as TranslationBundle;
  }
  Object.assign(node, values);
  if (extraUnstable || element.docKeyUnstable) {
    const key = segments.join('.');
    if (!collector.unstable.includes(key)) collector.unstable.push(key);
  }
}

/**
 * This element's own entry in its *owning* document's bundle — a referenced
 * document's nodes always resolve against the reference's own translations,
 * never the importing document's.
 */
function findTexts(
  element: DocumentElement,
  lang: string,
  extraSegments?: string[],
): TranslationBundle | undefined {
  let document: ApiDocument | undefined;
  try {
    document = element.node.getDocument();
  } catch {
    // An element detached from any document (an embedded, anonymous data
    // type built outside a document tree) simply has nothing to look up.
    return undefined;
  }
  const bundle = document.getTranslations(lang);
  if (!bundle) return undefined;
  const segments = extraSegments
    ? element.docKeySegments.concat(extraSegments)
    : element.docKeySegments;
  let node: TranslationBundle | string | undefined = bundle;
  for (const segment of segments) {
    if (!node || typeof node === 'string') return undefined;
    node = node[segment];
  }
  return node && typeof node !== 'string' ? node : undefined;
}
