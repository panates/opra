import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'expect';
import {
  directionFor,
  loadUiMessages,
  resolveUiLanguage,
  UI_DEFAULT_LANGUAGE,
  UI_LANGUAGES,
  type UiMessages,
} from '../src/ui-i18n.js';

const I18N_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../assets/i18n',
);

/** Every leaf of a bundle, as `a.b.c` -> the string it holds. */
function flatten(node: UiMessages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v) Object.assign(out, flatten(v, key));
  }
  return out;
}

/** `{name}` placeholders a message uses. */
function placeholders(value: string): Set<string> {
  return new Set(Array.from(value.matchAll(/\{(\w+)\}/g), m => m[1]));
}

/**
 * Splits `field.showMoreFields_one` into its base key and plural category.
 * A key with no recognized category suffix is its own base — `common.close`
 * is not a plural of anything, and neither is a message that merely happens
 * to end in `_other`-looking text.
 */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
function splitPlural(key: string): { base: string; category?: string } {
  const i = key.lastIndexOf('_');
  if (i < 0) return { base: key };
  const suffix = key.substring(i + 1);
  return PLURAL_CATEGORIES.includes(suffix)
    ? { base: key.substring(0, i), category: suffix }
    : { base: key };
}

function readBundle(lang: string): UiMessages {
  return JSON.parse(
    fs.readFileSync(path.join(I18N_DIR, `${lang.toLowerCase()}.json`), 'utf-8'),
  ) as UiMessages;
}

describe('api-ui:ui-i18n', () => {
  const english = flatten(readBundle(UI_DEFAULT_LANGUAGE));
  /** English's own key set, with plural variants folded into one base key. */
  const englishBases = new Set(
    Object.keys(english).map(k => splitPlural(k).base),
  );

  it('Should ship a dictionary file for every declared language, and nothing else', () => {
    const onDisk = fs
      .readdirSync(I18N_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.substring(0, f.length - 5))
      .sort();
    const declared = UI_LANGUAGES.map(l => l.toLowerCase()).sort();
    // A file nobody lists is dead weight; a listed language with no file
    // throws at render time, which is far too late to find out.
    expect(onDisk).toStrictEqual(declared);
  });

  it('Should list languages in sorted order', () => {
    expect(Array.from(UI_LANGUAGES)).toStrictEqual(
      Array.from(UI_LANGUAGES).sort(),
    );
  });

  for (const lang of UI_LANGUAGES) {
    describe(`bundle: ${lang}`, () => {
      const bundle = flatten(readBundle(lang));
      const categories = new Intl.PluralRules(lang).resolvedOptions()
        .pluralCategories as string[];

      it('Should cover exactly the keys English declares', () => {
        const bases = new Set(
          Object.keys(bundle).map(k => splitPlural(k).base),
        );
        const missing = Array.from(englishBases).filter(k => !bases.has(k));
        const extra = Array.from(bases).filter(k => !englishBases.has(k));
        expect({ missing, extra }).toStrictEqual({ missing: [], extra: [] });
      });

      it('Should only use plural forms this language actually has', () => {
        const wrong = Object.keys(bundle)
          .map(splitPlural)
          .filter(
            p => p.category !== undefined && !categories.includes(p.category),
          )
          .map(p => `${p.base}_${p.category}`);
        expect(wrong).toStrictEqual([]);
      });

      it('Should give every plural message an "other" form to fall back to', () => {
        // `tp()` looks up `<key>_<category>` and drops to `<key>_other`; a
        // count whose category this bundle skipped would otherwise render
        // the raw key.
        const pluralBases = new Set(
          Object.keys(bundle)
            .map(splitPlural)
            .filter(p => p.category !== undefined)
            .map(p => p.base),
        );
        const missingOther = Array.from(pluralBases).filter(
          base => bundle[`${base}_other`] === undefined,
        );
        expect(missingOther).toStrictEqual([]);
      });

      it('Should not invent placeholders the code never substitutes', () => {
        // Dropping one is fine — Arabic's "عملية واحدة" needs no {count} —
        // but a *new* name (or a typo of an existing one) renders literally.
        const offenders: string[] = [];
        for (const [key, value] of Object.entries(bundle)) {
          const base = splitPlural(key).base;
          const allowed = new Set<string>();
          for (const candidate of [key, base, `${base}_other`]) {
            if (english[candidate]) {
              for (const name of placeholders(english[candidate])) {
                allowed.add(name);
              }
            }
          }
          // Plural messages always get `count`, whether or not English used it.
          if (splitPlural(key).category) allowed.add('count');
          for (const name of placeholders(value)) {
            if (!allowed.has(name)) offenders.push(`${key}: {${name}}`);
          }
        }
        expect(offenders).toStrictEqual([]);
      });

      it('Should leave no message empty', () => {
        const empty = Object.entries(bundle)
          .filter(([, v]) => !v.trim())
          .map(([k]) => k);
        expect(empty).toStrictEqual([]);
      });
    });
  }

  describe('resolveUiLanguage', () => {
    it('Should match a shipped language exactly, regardless of case', () => {
      expect(resolveUiLanguage('tr')).toStrictEqual('tr');
      expect(resolveUiLanguage('ZH-HANT')).toStrictEqual('zh-Hant');
    });

    it('Should map a region to its script rather than stripping it', () => {
      // `zh-TW` must not degrade to the simplified `zh` bundle.
      expect(resolveUiLanguage('zh-TW')).toStrictEqual('zh-Hant');
      expect(resolveUiLanguage('zh-CN')).toStrictEqual('zh');
    });

    it('Should fall back to the base language for an unlisted region', () => {
      expect(resolveUiLanguage('de-AT')).toStrictEqual('de');
      expect(resolveUiLanguage('pt-BR')).toStrictEqual('pt');
    });

    it('Should accept legacy codes', () => {
      expect(resolveUiLanguage('iw')).toStrictEqual('he');
      expect(resolveUiLanguage('no')).toStrictEqual('nb');
    });

    it('Should always resolve to some language', () => {
      expect(resolveUiLanguage('zz')).toStrictEqual(UI_DEFAULT_LANGUAGE);
      expect(resolveUiLanguage(undefined)).toStrictEqual(UI_DEFAULT_LANGUAGE);
      expect(resolveUiLanguage('')).toStrictEqual(UI_DEFAULT_LANGUAGE);
    });
  });

  describe('directionFor', () => {
    it('Should report rtl only for right-to-left scripts', () => {
      expect(['ar', 'fa', 'he', 'ur'].map(directionFor)).toStrictEqual([
        'rtl',
        'rtl',
        'rtl',
        'rtl',
      ]);
      expect(['en', 'tr', 'zh-Hant'].map(directionFor)).toStrictEqual([
        'ltr',
        'ltr',
        'ltr',
      ]);
    });
  });

  describe('loadUiMessages', () => {
    it('Should merge over English so no key can be missing', () => {
      // Every language is complete today; the merge is what keeps a future
      // half-translated bundle from showing a reader a raw key.
      const keys = Object.keys(english);
      for (const lang of UI_LANGUAGES) {
        const merged = flatten(loadUiMessages(lang));
        expect(Object.keys(merged)).toEqual(expect.arrayContaining(keys));
      }
    });

    it('Should translate rather than merely fall through', () => {
      const tr = flatten(loadUiMessages('tr'));
      expect(tr['sidebar.overview']).toStrictEqual('Genel bakış');
    });

    it('Should resolve its argument the same way resolveUiLanguage does', () => {
      expect(loadUiMessages('de-AT')).toStrictEqual(loadUiMessages('de'));
      expect(loadUiMessages('zz')).toStrictEqual(
        loadUiMessages(UI_DEFAULT_LANGUAGE),
      );
    });
  });
});
