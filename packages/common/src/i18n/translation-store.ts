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

  /**
   * Writes a language's bundle back, replacing whatever was there.
   *
   * **Optional on purpose, and that is the whole safety model for authoring.**
   * A documentation studio can only offer to edit a document whose store
   * implements this, so a deployment that loads its bundles from somewhere
   * it cannot write — a database it opened read-only, an object store, the
   * files baked into a container image — is not editable because there is no
   * way to express the write, rather than because a flag happens to be off.
   *
   * Implementations receive the bundle object the document is already
   * holding, mutated in place, and must preserve its key order: the files
   * `oprimp docs:extract` writes are merged onto key by key, so a store that
   * rebuilds the structure turns every later extraction into a whole-file
   * diff.
   */
  save?(lang: string, bundle: TranslationBundle): Promise<void>;

  /**
   * Where a language's texts live, phrased for a person to read — a path for
   * a store backed by files, a table and row for one backed by a database.
   * Shown by the tools that write through this store, so that "saved" says
   * *where*; `undefined` when a store has no location worth naming.
   */
  locationOf?(lang: string): Promise<string | undefined>;
}

/** A store that can be written back to. */
export type WritableTranslationStore = TranslationStore &
  Required<Pick<TranslationStore, 'save'>>;

/**
 * Whether a document's translations can be written back.
 *
 * The one question any writing tool has to ask before it does anything, and
 * the only correct way to answer "where do this document's texts go?" — the
 * answer is the store itself, never a path guessed beside it. A tool that
 * substitutes its own storage writes somewhere nothing will ever read from,
 * which is the failure this whole arrangement exists to prevent.
 */
export function isWritableStore(
  store: TranslationStore | undefined,
): store is WritableTranslationStore {
  return typeof store?.save === 'function';
}

/**
 * Reads and writes `<dir>/<lang>.json`. `node:fs` is imported dynamically,
 * inside the methods rather than at this file's own top level, so that
 * bundling `@opra/common` for a browser never has to resolve it — the same
 * seam `@opra/cli`'s own `write-to-disk.ts` uses for its disk access.
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
    const filename = await this.filenameFor(lang);
    try {
      return JSON.parse(
        fs.readFileSync(filename, 'utf-8'),
      ) as TranslationBundle;
    } catch {
      return undefined;
    }
  }

  /**
   * Which file a language reads from and writes to.
   *
   * An existing file's name is reused verbatim rather than rebuilt from the
   * tag: bundles are keyed lower-case in memory, but `zh-Hant.json` on disk
   * should stay `zh-Hant.json` — reconstructing it would quietly leave a
   * second bundle beside the first on a case-sensitive filesystem, and
   * silently overwrite the wrong one on a case-insensitive one.
   */
  async locationOf(lang: string): Promise<string> {
    return this.filenameFor(lang);
  }

  async filenameFor(lang: string): Promise<string> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    let entries: string[];
    try {
      entries = fs.readdirSync(this.dirname);
    } catch {
      /* Nothing written here yet — `save` creates the directory. */
      entries = [];
    }
    const existing = entries.find(
      f => f.toLowerCase() === `${lang.toLowerCase()}.json`,
    );
    return path.join(this.dirname, existing || `${lang}.json`);
  }

  /** Byte-for-byte the format `oprimp docs:extract` writes, so running an
   *  extraction after an editing session is a no-op rather than a diff. */
  async save(lang: string, bundle: TranslationBundle): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filename = await this.filenameFor(lang);
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  }
}
