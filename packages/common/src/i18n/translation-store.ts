/**
 * One language's documentation texts, shaped exactly like the schema tree
 * itself — container names included, so a field literally named
 * `description` (`types.Customer.fields.description.description`) can never
 * collide with its own type's description (`types.Customer.description`).
 * Never parsed as a dotted string: lookups walk it segment by segment (see
 * `DocumentElement#docKeySegments`), which is what keeps a name containing
 * a dot, a slash or a regexp source harmless.
 */
export interface TranslationBundle {
  [key: string]: string | TranslationBundle | undefined;
}

/**
 * Where a document's documentation texts come from. Deliberately a
 * *loader*, not a per-key resolver: `ApiDocument#export()` is synchronous
 * all the way down, so every bundle is materialized in memory once (while
 * the document itself is being built, which is already async) and looked up
 * synchronously afterwards. That also keeps a remote implementation
 * (S3, a database, a translation service) from turning one serialization
 * into thousands of round trips.
 */
export abstract class TranslationStore {
  /**
   * Every language this store can provide, so a caller can preload them all
   * and offer a language list without guessing. Order is not significant —
   * consumers sort it themselves where determinism matters.
   */
  abstract listLanguages(): Promise<string[]>;

  /**
   * Returns the given language's bundle, or `undefined` when this store has
   * nothing for it (the caller then falls back — see
   * `ApiDocument#resolveLanguage`).
   */
  abstract load(lang: string): Promise<TranslationBundle | undefined>;
}

/**
 * Reads `<dir>/<lang>.json`. `node:fs` is imported dynamically, inside the
 * methods rather than at this file's own top level, so that bundling
 * `@opra/common` for a browser never has to resolve it — the same seam
 * `@opra/cli`'s own `write-to-disk.ts` uses for its disk access.
 */
export class TranslationFileStore extends TranslationStore {
  constructor(readonly dirname: string) {
    super();
  }

  async listLanguages(): Promise<string[]> {
    const fs = await import('node:fs');
    let entries: string[];
    try {
      entries = fs.readdirSync(this.dirname);
    } catch {
      return [];
    }
    return entries
      .filter(f => f.endsWith('.json'))
      .map(f => f.substring(0, f.length - 5));
  }

  async load(lang: string): Promise<TranslationBundle | undefined> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filename = path.join(this.dirname, lang + '.json');
    try {
      return JSON.parse(
        fs.readFileSync(filename, 'utf-8'),
      ) as TranslationBundle;
    } catch {
      return undefined;
    }
  }
}
