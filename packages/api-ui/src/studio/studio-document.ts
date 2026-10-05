import {
  type ApiDocument,
  extractTranslations,
  type TranslationBundle,
  type WritableTranslationStore,
} from '@opra/common';

/** Empties every text in place, keeping the skeleton's shape and key order —
 *  which is what makes the emptied file still identical to what a later
 *  `docs:extract` merges onto. */
function blankTexts(node: TranslationBundle): void {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string') node[key] = '';
    else if (value) blankTexts(value);
  }
}

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
 * One document `docs:studio` can write the prose of — the root, or a
 * reference reached from it.
 *
 * Each one writes through **its own** translation store, which is the point:
 * a node's texts are only ever looked up in the bundle of the document that
 * declares it, so a reference's `types.Customer` saved into the root's bundle
 * is a key nobody will ever read. The studio used to have one directory and
 * therefore marked every imported node read-only; routing by owner is what
 * replaces that.
 *
 * Bundles are held as the *parsed* objects the document is already serving
 * and mutated in place rather than rebuilt: `docs:extract` merges onto
 * whatever is in the file and keeps its key order, so rebuilding would
 * reorder keys and turn the next extraction into a whole-file diff.
 */
export class StudioDocument {
  /** `ApiDocument#id` — what a block of prose carries as `_docOwner`. */
  readonly id: string;

  constructor(
    readonly document: ApiDocument,
    readonly store: WritableTranslationStore,
    /** The namespace this document is reached under, for the key prefix the
     *  page shows. Absent for the root. */
    readonly ns?: string,
  ) {
    this.id = document.id;
  }

  /**
   * The bundle for `lang`, creating it from this document's own skeleton
   * when there isn't one yet — the same file `docs:extract` would have
   * written, so a project that never ran it can still start writing.
   *
   * A new bundle starts empty unless it is the document's own language:
   * a fresh `de.json` full of English is not a translation, but it counts as
   * written everywhere that asks, so nothing would ever list it as
   * outstanding.
   */
  async bundle(lang: string): Promise<TranslationBundle> {
    const key = lang.toLowerCase();
    const existing = this.document.translations.get(key);
    if (existing) return existing;
    const bundle = extractTranslations(this.document).bundle;
    if (key !== this.document.defaultLanguage.toLowerCase()) blankTexts(bundle);
    /* Bundles are materialized once, while the document is built, so the
     * in-memory document would otherwise keep serving nothing for this
     * language however many times it is written. */
    this.document.translations.set(key, bundle);
    await this.store.save(lang, bundle);
    return bundle;
  }

  /** The bundle for `lang` as it stands, without creating one. Rendering a
   *  page must not leave files behind: a reference that has no `de.json` is
   *  simply untranslated into German until somebody writes a text into it. */
  peek(lang: string): TranslationBundle {
    return this.document.translations.get(lang.toLowerCase()) || {};
  }

  /**
   * Sets one text and writes the bundle back, creating the path as it goes —
   * the same segment walk `collectKeys` performs when it builds a skeleton,
   * and the reason the key travels as an ordered array rather than a dotted
   * string (a segment may itself contain a dot: a regexp source, a media
   * type).
   */
  async set(
    lang: string,
    key: readonly string[],
    field: string,
    value: string,
  ): Promise<void> {
    const bundle = await this.bundle(lang);
    let node = bundle;
    for (const segment of key) {
      const next = node[segment];
      node = (
        next && typeof next === 'object' ? next : (node[segment] = {})
      ) as TranslationBundle;
    }
    node[field] = value;
    await this.store.save(lang, bundle);
  }

  /** Where `lang` is written, when the store is one that has files. Shown in
   *  the page so an edit that leaves this document says where it landed. */
  async filename(lang: string): Promise<string | undefined> {
    return this.store.locationOf?.(lang);
  }

  /** Which texts this document actually declares, as `docs:extract` sees
   *  them. The page knows where every rendered text *would* be looked up,
   *  which is a wider set — the renderer reaches places the export walk
   *  doesn't, such as the fields of an anonymous type inlined into a request
   *  body. Listing those as work to do would send someone off to write text
   *  that the next `docs:extract` then reports as an orphan. */
  slots(): string[] {
    return leafPaths(extractTranslations(this.document).bundle);
  }
}
