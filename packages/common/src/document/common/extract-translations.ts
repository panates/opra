import type { TranslationBundle } from '../../i18n/translation-store.js';
import type { ApiDocument } from '../api-document.js';
import type { TranslationCollector } from './translate-doc.js';

export interface ExtractTranslationsResult {
  /** The skeleton, shaped exactly like the schema tree and pre-filled with
   *  the texts written in the source — so a first extraction produces a
   *  ready-to-translate file rather than an empty one, and moving texts out
   *  of the source can be done gradually. */
  bundle: TranslationBundle;
  /** Keys whose last segment isn't a stable identifier (a RegExp-named
   *  parameter, an example's position, a server's environment-dependent
   *  url). Each of these should be given a `docKey`, or its translation
   *  will silently detach the next time the declaration moves. */
  unstable: string[];
  /** Keys present in `existing` that the document no longer asks for —
   *  renamed or removed declarations, or typos. Reported *and* kept in the
   *  written bundle: deleting someone's translation is their call. */
  orphans: string[];
}

/**
 * Walks `document` and returns every documentation key it would look up.
 *
 * Deliberately implemented by running the document's *own* `export()` in
 * collect mode rather than by re-walking the model here: the extractor and
 * the runtime lookup then share one traversal and one whitelist, so a
 * skeleton can never list a key the server doesn't ask for (or miss one it
 * does).
 *
 * Note that `docKey` only exists on a document built from its own source —
 * a document reconstructed from a served schema has none (it's never
 * exported), so extracting from a URL yields unstable keys wherever one
 * would have been needed.
 *
 * @param document - The document to extract from.
 * @param existing - A previously translated bundle, whose texts are kept
 *   as-is; only missing keys are filled in from the source.
 */
export function extractTranslations(
  document: ApiDocument,
  existing?: TranslationBundle,
): ExtractTranslationsResult {
  const collector: TranslationCollector = { bundle: {}, unstable: [] };
  document.export({ collect: collector } as any);
  const bundle = existing
    ? mergeExisting(collector.bundle, existing)
    : collector.bundle;
  return {
    bundle,
    unstable: collector.unstable,
    orphans: existing ? findOrphans(collector.bundle, existing, []) : [],
  };
}

/** Existing translations win; the freshly collected source texts only fill
 *  the gaps, so re-running extraction never overwrites someone's work. */
function mergeExisting(
  collected: TranslationBundle,
  existing: TranslationBundle,
): TranslationBundle {
  // Starts from what is already there, so a key the document stopped
  // asking for is reported as an orphan rather than silently deleted.
  const out: TranslationBundle = { ...existing };
  for (const [key, value] of Object.entries(collected)) {
    const prev = existing[key];
    if (value && typeof value === 'object') {
      out[key] =
        prev && typeof prev === 'object'
          ? mergeExisting(value, prev)
          : mergeExisting(value, {});
      continue;
    }
    out[key] = typeof prev === 'string' ? prev : value;
  }
  return out;
}

function findOrphans(
  collected: TranslationBundle,
  existing: TranslationBundle,
  path: string[],
): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(existing)) {
    const here = path.concat(key);
    const counterpart = collected[key];
    if (counterpart == null) {
      out.push(here.join('.'));
      continue;
    }
    if (value && typeof value === 'object') {
      out.push(
        ...findOrphans(
          typeof counterpart === 'object' ? counterpart : {},
          value,
          here,
        ),
      );
    }
  }
  return out;
}
