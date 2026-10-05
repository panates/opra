import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type ApiDocument,
  isWritableStore,
  type TranslationBundle,
} from '@opra/common';
import { ApiUiFactory } from '../api-ui.factory.js';
import type { ApiUiOptions } from '../types.js';
import { UI_LANGUAGES } from '../ui-i18n.js';
import { StudioDocument } from './studio-document.js';

/** A language tag, as BCP 47 shapes one — and, just as importantly, as a
 *  filename: a file store turns this into `<tag>.json`, so anything that
 *  could climb out of its directory or name something else entirely is
 *  refused before it reaches a store at all. */
const LANGUAGE_TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*$/;

export interface DocsStudioOptions {
  /** Which bundle to edit. Defaults to the document's own `defaultLanguage`. */
  lang?: string;
  /** Scope to render, for a document that exposes more than one. */
  scope?: string;
  /** Reported after a text is written, for a caller that wants to say so.
   *  Structured rather than a formatted line, so the host decides how it
   *  reads — a CLI colourizes it, a server logs it, a test counts it. */
  onSaved?(event: {
    ns?: string;
    key: readonly string[];
    field: string;
    lang: string;
  }): void;
  /** Reported when a language that had no bundle gets one. */
  onLanguageCreated?(event: { lang: string; file?: string }): void;
  /** Anything a request threw, already turned into a response for the
   *  client by the time this is called. */
  onError?(error: Error): void;
}

/**
 * The documentation studio: the reference UI rendered as a *writing* surface,
 * with every edit written back through the owning document's own translation
 * store.
 *
 * Transport-neutral on purpose. Everything that makes the studio what it is —
 * which documents can be written to, what the page is, what a save means —
 * lives here; a host supplies the server. `@opra/cli` wraps it in a loopback
 * `node:http` server for `oprimp docs:studio`, and an adapter can mount the
 * same object behind a route. Neither of them re-implements a line of it,
 * which is what kept the CLI copy and the rendered page in step by hand
 * before.
 *
 * **This writes to wherever the documents read from.** A host is responsible
 * for deciding that a studio should exist at all; what this class guarantees
 * is narrower and absolute — it can only write through a `TranslationStore`
 * that implements `save`, and only to the document that declares the text.
 */
export class DocsStudio {
  static readonly SAVE_ROUTE = '/_studio/save';
  static readonly ADD_LANGUAGE_ROUTE = '/_studio/language';

  /** The document the page is rendered from, and the one whose languages the
   *  picker offers. */
  readonly root: StudioDocument;
  /** Every document whose prose can be written here: the root, and each
   *  reference that brought a store of its own. A reference's texts are only
   *  ever looked up in its own bundle, so this is what makes an imported type
   *  editable at all. */
  readonly documents: readonly StudioDocument[];
  /** The language the studio opens in, and the one a request falls back to. */
  readonly initialLang: string;

  private readonly _byId: Map<string, StudioDocument>;
  /** Computed once: a document's declared keys are a property of the
   *  document, and nothing the studio does changes them. */
  private readonly _slots: Record<string, string[]> = {};

  constructor(
    readonly document: ApiDocument,
    readonly options: DocsStudioOptions = {},
  ) {
    const store = document.translationStore;
    if (!isWritableStore(store)) {
      throw new Error(
        `"${document.info.title || 'This document'}" has no translation ` +
          'store that can be written to. Give it a `translationStore` whose ' +
          '`save` is implemented, such as `new TranslationFileStore(' +
          'path.join(import.meta.dirname, "./docs"))`.',
      );
    }
    this.root = new StudioDocument(document, store);
    const documents: StudioDocument[] = [this.root];
    // `ResponsiveMap.entries()` yields its case-normalized internal key, not
    // the namespace as registered — `.keys()` preserves the original casing
    // and lines up positionally with `.values()`.
    const namespaces = Array.from(document.references.keys());
    const referenced = Array.from(document.references.values());
    namespaces.forEach((ns, i) => {
      if (ns === 'opra') return; // the framework's own builtin reference
      const refStore = referenced[i].translationStore;
      if (isWritableStore(refStore))
        documents.push(new StudioDocument(referenced[i], refStore, ns));
    });
    this.documents = documents;
    this._byId = new Map(documents.map(d => [d.id, d]));
    for (const doc of documents) this._slots[doc.id] = doc.slots();
    this.initialLang = options.lang || document.defaultLanguage;
  }

  /** Every language the root document has a bundle for — the set the picker
   *  offers, and the only tags a request is allowed to name. Adding to it is
   *  a deliberate act (see `addLanguage`), not something a mistyped `?lang=`
   *  can do by accident. A reference translated into fewer languages is not a
   *  smaller list; its missing bundle is written the first time somebody
   *  saves a text into it. */
  async languages(): Promise<string[]> {
    const found = await this.root.store.listLanguages();
    if (!found.some(l => l.toLowerCase() === this.initialLang.toLowerCase())) {
      found.push(this.initialLang);
    }
    return found.sort((a, b) => a.localeCompare(b));
  }

  /** The language a request is for. Falls back to the one the studio was
   *  opened with rather than trusting the query: quietly editing a bundle the
   *  caller didn't name is the one mistake this must not make, and the header
   *  badge only tells the truth if this does. */
  async langFor(url: string | undefined): Promise<string> {
    const asked = new URL(url || '/', 'http://localhost').searchParams.get(
      'lang',
    );
    if (!asked) return this.initialLang;
    const languages = await this.languages();
    return (
      languages.find(l => l.toLowerCase() === asked.toLowerCase()) ||
      this.initialLang
    );
  }

  /** Rendered per request, never cached: the point of the tool is seeing an
   *  edit immediately. Switching the language being edited is a fresh request
   *  for the same reason — the prose, the interface and the bundle all change
   *  together, and re-deriving them here is what keeps them from
   *  disagreeing. */
  async render(lang: string, overrides?: ApiUiOptions): Promise<string> {
    const languages = await this.languages();
    const documents = await Promise.all(
      this.documents.map(async doc => ({
        id: doc.id,
        ns: doc.ns,
        file: await doc.filename(lang),
      })),
    );
    const html = ApiUiFactory.render(this.document, {
      scope: this.options.scope,
      /* Whatever the host already knows about rendering this page - where it
       * is mounted, which scope the url named, which languages the selector
       * offers. A studio served from inside an application is the same page
       * as the one beside it, so it must not lose the things that make that
       * page work. */
      ...overrides,
      lang,
      /* The interface follows the language being edited, always: reading
       * Turkish prose while the frame says "Save" in English is a way to
       * lose track of which bundle an edit lands in. */
      uiLang: lang,
      authoring: {
        saveUrl: DocsStudio.SAVE_ROUTE,
        lang,
        file: documents[0].file,
        documents,
        languages,
        addLanguageUrl: DocsStudio.ADD_LANGUAGE_ROUTE,
        /* Suggestions, not a closed list — a document can be translated into
         * anything BCP 47 names, and the field still takes a typed tag. These
         * are the ones whose interface is translated too, so picking one gets
         * you a studio in that language rather than an English frame around
         * it. Named for the reader by `Intl.DisplayNames`, so nobody has to
         * know that Deutsch is `de`. */
        addLanguageOptions: UI_LANGUAGES.filter(
          tag => !languages.some(l => l.toLowerCase() === tag.toLowerCase()),
        ),
      },
    });
    /* The bundles as they are in their stores, which is not what the page
     * shows: a text a bundle doesn't carry is rendered from the source
     * instead, so judging "already written" by what is on screen would call
     * every untranslated entry done — and open its editor pre-filled with the
     * source language. The editor edits the bundle, so it reads the bundle.
     * Read without creating: rendering a page in a language a reference has
     * never been translated into must not leave a blank bundle behind. */
    const bundles: Record<string, TranslationBundle> = {};
    for (const doc of this.documents) bundles[doc.id] = doc.peek(lang);
    const script =
      '  <script>' +
      embed('__OPRA_STUDIO_SLOTS__', this._slots) +
      embed('__OPRA_STUDIO_BUNDLE__', bundles) +
      '</script>\n';
    /* Spliced at the *last* `</body>` and by index, not with `replace()`:
     * the page has the whole of `app.js` and `studio.js` inlined into it, and
     * the first `</body>` in it is one written inside a comment in that
     * source — replacing that one injects the script into the middle of a
     * function. (Indexing also sidesteps `replace()`'s `$` patterns, which a
     * bundle of arbitrary prose could otherwise trigger.) */
    const at = html.lastIndexOf('</body>');
    if (at < 0) return html + script;
    return html.slice(0, at) + script + html.slice(at);
  }

  /** Writes one text, through the store of the document that declares it. */
  async save(body: any): Promise<void> {
    const key: string[] = body?.key;
    const field: string = body?.field;
    const value: string = body?.value ?? '';
    if (!Array.isArray(key) || typeof field !== 'string') {
      throw new TypeError('Expected { key: string[], field, value }');
    }
    /* The page says which language it was written in, rather than the studio
     * holding a "current" one: two tabs open on two languages is a perfectly
     * reasonable way to translate, and a current would send one tab's edit
     * into the other's bundle. */
    const languages = await this.languages();
    const lang = languages.find(
      l => l.toLowerCase() === String(body?.lang || '').toLowerCase(),
    );
    if (!lang) throw new TypeError(`No bundle for language "${body?.lang}"`);
    /* And which document it belongs to, for the same reason the key travels
     * whole: the page renders nodes from several documents at once, and a
     * text is only ever read back from the bundle of the one that declares
     * it. The client never offers to edit a document that isn't in this map,
     * so arriving here with an unknown one means a stale page. */
    const target = this._byId.get(String(body?.owner || ''));
    if (!target) {
      throw new TypeError(
        'That text belongs to a document this studio cannot write to. ' +
          'Reload the page.',
      );
    }
    await target.set(lang, key, field, value);
    this.options.onSaved?.({ ns: target.ns, key, field, lang });
  }

  /** Starts a language the project doesn't have yet, by writing its empty
   *  bundle. Its own entry point rather than a side effect of `?lang=`, so
   *  that creating a bundle is always something someone asked for — a
   *  mistyped tag in the address bar must not leave `tt.json` behind.
   *
   *  Only the root document gets one here. A reference is translated into the
   *  languages it is translated into, and its bundle appears the first time
   *  somebody actually writes one of its texts. */
  async addLanguage(body: any): Promise<{ lang: string }> {
    const lang = String(body?.lang || '').trim();
    if (!LANGUAGE_TAG.test(lang)) {
      throw new TypeError(
        `"${lang}" is not a language tag — expected something like "de" or "pt-BR".`,
      );
    }
    const languages = await this.languages();
    const existing = languages.find(
      l => l.toLowerCase() === lang.toLowerCase(),
    );
    if (existing) return { lang: existing };
    await this.root.bundle(lang);
    this.options.onLanguageCreated?.({
      lang,
      file: await this.root.filename(lang),
    });
    return { lang };
  }

  /**
   * Serves one request: the two write routes, and the page for everything
   * else.
   *
   * Written against `node:http`'s own request and response rather than any
   * framework's, which is what every Node server has underneath — an express
   * handler is `(req, res) => studio.handle(req, res)` and nothing more.
   */
  handle(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === 'POST' && req.url === DocsStudio.SAVE_ROUTE) {
      this._readBody(req, res, body => this.save(body));
      return;
    }
    if (req.method === 'POST' && req.url === DocsStudio.ADD_LANGUAGE_ROUTE) {
      this._readBody(req, res, body => this.addLanguage(body));
      return;
    }
    this.langFor(req.url)
      .then(lang => this.render(lang))
      .then(html => {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          /* The page is regenerated from the document on every request
           * precisely so an edit shows up immediately; a browser holding on
           * to a copy of it would undo that. */
          'cache-control': 'no-store',
        });
        res.end(html);
      })
      .catch((e: Error) => {
        this.options.onError?.(e);
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(e.message);
      });
  }

  /** Collects a JSON body and turns whatever `handle` throws into the one
   *  shape the client knows how to show.
   *
   *  **A body somebody already parsed is used as it stands.** Inside an
   *  application the request has usually passed a body parser long before it
   *  reaches here — NestJS installs one by default, and `express.json()` is
   *  the first line of most Express apps — and a parser leaves the stream
   *  consumed: waiting for `'data'` on it produces no chunks and no `'end'`,
   *  so the request simply never gets an answer. Reading it from `req.body`
   *  first is what makes this work mounted as well as it works standalone. */
  private _readBody(
    req: IncomingMessage,
    res: ServerResponse,
    handle: (body: any) => Promise<unknown>,
  ): void {
    const parsed = (req as { body?: unknown }).body;
    if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed)) {
      this._answer(res, handle(parsed));
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c as Buffer));
    req.on('end', () =>
      this._answer(
        res,
        Promise.resolve().then(() =>
          handle(JSON.parse(Buffer.concat(chunks).toString())),
        ),
      ),
    );
  }

  /** The one response shape the client knows how to read, for either path. */
  private _answer(res: ServerResponse, result: Promise<unknown>): void {
    result
      .then(value => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...(value as object) }));
      })
      .catch((e: Error) => {
        this.options.onError?.(e);
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
  }
}

/** `</script>` inside an inline script would end it early, so the one
 *  character that can do that never survives serialization. */
function embed(name: string, value: unknown): string {
  return `window.${name} = ${JSON.stringify(value).replace(/</g, '\\u003c')};`;
}
