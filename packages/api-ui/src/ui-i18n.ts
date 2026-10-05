import { readAsset } from './read-asset.js';

/** One language's UI-chrome texts: a nested plain object mirroring the
 *  sections of `assets/i18n/en.json`. */
export interface UiMessages {
  [key: string]: string | UiMessages;
}

/**
 * Every language `@opra/api-ui` ships its own interface texts in, as
 * canonical BCP-47 tags. Deliberately a static list rather than a
 * `readdirSync` of `assets/i18n`: it is the language selector's menu as much
 * as it is the loader's index, so it has to be deterministic and ordered the
 * same way on every platform — and a missing file should fail a test rather
 * than silently shrink the menu.
 *
 * Note this is *not* the same thing as the languages a given API document is
 * documented in (`ApiDocument#translations`). A document written only in
 * English still renders its chrome in any of these.
 */
export const UI_LANGUAGES: readonly string[] = [
  'ar',
  'az',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fa',
  'fi',
  'fr',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sv',
  'th',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh',
  'zh-Hant',
];

/** The language every unresolvable request falls back to, and the source of
 *  truth every other bundle is merged over (see `loadUiMessages`). */
export const UI_DEFAULT_LANGUAGE = 'en';

/** Right-to-left scripts among `UI_LANGUAGES`, by base language. */
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

/**
 * Regional and legacy tags that have no bundle of their own but map cleanly
 * onto one that does. Only cases where stripping the region would give the
 * *wrong* answer need an entry — `de-AT` → `de` already falls out of the
 * base-language step in `resolveUiLanguage`.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  // Simplified vs. traditional Han is a script distinction, not a regional
  // one: `zh-TW` must not degrade to the simplified `zh` bundle.
  'zh-cn': 'zh',
  'zh-sg': 'zh',
  'zh-hans': 'zh',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
  // Legacy ISO codes still emitted by some clients.
  iw: 'he',
  in: 'id',
  // `no` (Norwegian, macrolanguage) is served by the Bokmål bundle.
  no: 'nb',
};

/** Canonical tags keyed by their lower-cased form, so a request written as
 *  `ZH-HANT` resolves to the `zh-Hant` bundle. */
const CANONICAL_BY_LOWER = new Map(
  UI_LANGUAGES.map(lang => [lang.toLowerCase(), lang]),
);

/**
 * Picks which UI bundle answers `lang`: exact match → alias → base language
 * (`de-AT` → `de`) → `en`.
 *
 * Unlike `ApiDocument#resolveLanguage`, this *always* returns a language —
 * the document's own resolution yields `undefined` whenever it carries no
 * translations at all, which is the common case, and the interface would
 * then never localize for anyone.
 */
export function resolveUiLanguage(lang?: string): string {
  if (lang) {
    const wanted = lang.toLowerCase();
    const exact = CANONICAL_BY_LOWER.get(wanted);
    if (exact) return exact;
    const alias = LANGUAGE_ALIASES[wanted];
    if (alias) return alias;
    const i = wanted.indexOf('-');
    if (i > 0) {
      const base = CANONICAL_BY_LOWER.get(wanted.substring(0, i));
      if (base) return base;
    }
  }
  return UI_DEFAULT_LANGUAGE;
}

/** Writing direction for a resolved UI language — what `<html dir>` gets. */
export function directionFor(lang: string): 'ltr' | 'rtl' {
  const base = lang.toLowerCase().split('-')[0];
  return RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

function isPlainObject(v: unknown): v is UiMessages {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** `over` wins key by key, recursing into nested sections. */
function deepMerge(base: UiMessages, over: UiMessages): UiMessages {
  const out: UiMessages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = isPlainObject(b) && isPlainObject(v) ? deepMerge(b, v) : v;
  }
  return out;
}

function readBundle(lang: string): UiMessages {
  return JSON.parse(readAsset(`i18n/${lang.toLowerCase()}.json`)) as UiMessages;
}

const cache = new Map<string, UiMessages>();

/**
 * The dictionary embedded into a page rendered in `lang`, merged over
 * English so that **every** key is present.
 *
 * That merge is what lets `assets/app.js` do a plain lookup with no fallback
 * logic of its own: a key a translator hasn't got to yet renders in English
 * rather than showing a reader the raw key. Bundles are read once and cached
 * — the rendered HTML is cached per language anyway, so this only ever costs
 * on a cold page.
 */
export function loadUiMessages(lang: string): UiMessages {
  const resolved = resolveUiLanguage(lang);
  let messages = cache.get(resolved);
  if (!messages) {
    const base = readBundle(UI_DEFAULT_LANGUAGE);
    messages =
      resolved === UI_DEFAULT_LANGUAGE
        ? base
        : deepMerge(base, readBundle(resolved));
    cache.set(resolved, messages);
  }
  return messages;
}
