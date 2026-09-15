import fs from 'node:fs';
import path from 'node:path';
import {
  type ApiDocument,
  extractTranslations,
  type TranslationBundle,
} from '@opra/common';

/**
 * The one documentation bundle `docs:studio` reads and writes.
 *
 * Deliberately holds the *parsed* object and mutates it in place rather than
 * rebuilding it on every save: `docs:extract` merges onto whatever is already
 * in the file and keeps its key order (see `mergeExisting`), so rebuilding
 * would reorder keys and make a later extraction rewrite the whole file even
 * though nothing about its content changed.
 */
export class BundleFile {
  readonly filename: string;
  private _bundle: TranslationBundle;

  private constructor(filename: string, bundle: TranslationBundle) {
    this.filename = filename;
    this._bundle = bundle;
  }

  get bundle(): TranslationBundle {
    return this._bundle;
  }

  /**
   * Opens `<dir>/<lang>.json`, creating it from the document's own skeleton
   * when it doesn't exist yet — the same file `docs:extract` would have
   * written, so a project that never ran it can still start writing.
   *
   * An existing file's name is reused verbatim rather than lower-cased: a
   * document's bundles are keyed lower-case in memory, but `zh-Hant.json` on
   * disk should stay `zh-Hant.json`.
   */
  static open(dir: string, lang: string, document: ApiDocument): BundleFile {
    const existing = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .find(
            f =>
              f.toLowerCase() === `${lang.toLowerCase()}.json` &&
              f.endsWith('.json'),
          )
      : undefined;
    const filename = path.join(dir, existing || `${lang}.json`);
    if (fs.existsSync(filename)) {
      return new BundleFile(
        filename,
        JSON.parse(fs.readFileSync(filename, 'utf-8')) as TranslationBundle,
      );
    }
    const file = new BundleFile(filename, extractTranslations(document).bundle);
    file.write();
    return file;
  }

  /**
   * Sets one text, creating the path as it goes — the same segment walk
   * `collectKeys` performs when it builds a skeleton, and the reason the key
   * travels as an ordered array rather than a dotted string (a segment may
   * itself contain a dot: a regexp source, a media type).
   */
  set(key: readonly string[], field: string, value: string): void {
    let node = this._bundle;
    for (const segment of key) {
      const next = node[segment];
      node = (
        next && typeof next === 'object' ? next : (node[segment] = {})
      ) as TranslationBundle;
    }
    node[field] = value;
  }

  get(key: readonly string[], field: string): string | undefined {
    let node: TranslationBundle | string | undefined = this._bundle;
    for (const segment of key) {
      if (!node || typeof node === 'string') return undefined;
      node = node[segment];
    }
    if (!node || typeof node === 'string') return undefined;
    const value = node[field];
    return typeof value === 'string' ? value : undefined;
  }

  /** Byte-for-byte the format `docs:extract` writes, so running it after a
   *  studio session is a no-op rather than a diff. */
  write(): void {
    fs.mkdirSync(path.dirname(path.resolve(this.filename)), {
      recursive: true,
    });
    fs.writeFileSync(
      this.filename,
      JSON.stringify(this._bundle, null, 2) + '\n',
      'utf-8',
    );
  }
}
