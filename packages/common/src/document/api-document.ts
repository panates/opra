import { omitUndefined } from '@jsopen/objects';
import { md5 } from 'super-fast-md5';
import type { Mutable, Type } from 'ts-gems';
import { cloneObject, ResponsiveMap } from '../helpers/index.js';
import type {
  TranslationBundle,
  TranslationStore,
} from '../i18n/translation-store.js';
import { OpraSchema } from '../schema/index.js';
import { DataTypeMap } from './common/data-type-map.js';
import { DocumentElement } from './common/document-element.js';
import type { TranslationCollector } from './common/translate-doc.js';
import {
  BUILTIN,
  kDataTypeMap,
  kTypeNSMap,
  NAMESPACE_PATTERN,
} from './constants.js';
import { DataType } from './data-type/data-type.js';
import type { EnumType } from './data-type/enum-type.js';
import { HttpApi } from './http/http-api.js';
import { MQApi } from './mq/mq-api.js';
import { WSApi } from './ws/ws-api.js';

/**
 *
 * @class ApiDocument
 */
export class ApiDocument extends DocumentElement {
  protected [kTypeNSMap] = new WeakMap<DataType, string>();
  readonly id: string = '';
  url?: string;
  info: OpraSchema.DocumentInfo = {};
  references = new ResponsiveMap<ApiDocument>();
  types = new DataTypeMap();
  api?: HttpApi | MQApi | WSApi;
  /** Documentation texts per language, materialized while this document was
   *  built (see `ApiDocumentFactory`) so that `export()` can stay entirely
   *  synchronous. A referenced document carries its own — a node's texts are
   *  always looked up in the document that declares it, which is what keeps
   *  two documents from ever competing for the same key. */
  translations = new Map<string, TranslationBundle>();
  /** Where those bundles came from, kept rather than dropped after the build
   *  so that anything editing this document's prose writes back to the one
   *  place it is read from. Without it the only way to name that location is
   *  to repeat it beside the document, which is two facts that can disagree —
   *  and the one that disagrees silently is the write. `undefined` when the
   *  texts were handed over directly (`translations`) or there are none. */
  translationStore?: TranslationStore;
  /** The language `export()` falls back to when the requested one has no
   *  bundle of its own. */
  defaultLanguage = 'en';

  constructor() {
    super(null as any);
    this.node[kDataTypeMap] = this.types;
    this.node.findDataType = this._findDataType.bind(this);
  }

  /**
   * Returns NS of datatype. Returns undefined if not found
   * @param nameOrCtor
   */
  getDataTypeNs(
    nameOrCtor:
      | string
      | Type
      | Function
      | EnumType.EnumArray
      | EnumType.EnumObject
      | DataType,
  ): string | undefined {
    const dt =
      nameOrCtor instanceof DataType
        ? this._findDataType(nameOrCtor.name || '')
        : this._findDataType(nameOrCtor);
    if (dt) return this[kTypeNSMap].get(dt);
  }

  findDocument(id: string): ApiDocument | undefined {
    if (this.id === id) return this;
    for (const doc of this.references.values()) {
      if (doc.id === id) return doc;
      const d = doc.findDocument(id);
      if (d) return d;
    }
  }

  get httpApi(): HttpApi | undefined {
    if (this.api && this.api instanceof HttpApi) return this.api as HttpApi;
  }

  get mqApi(): MQApi | undefined {
    if (this.api && this.api instanceof MQApi) return this.api as MQApi;
  }

  get wsApi(): WSApi | undefined {
    if (this.api && this.api instanceof WSApi) return this.api as WSApi;
  }

  getHttpApi(): HttpApi {
    if (!(this.api && this.api instanceof HttpApi)) {
      throw new TypeError('The document do not contains HttpApi instance');
    }
    return this.api as HttpApi;
  }

  getMqApi(): MQApi {
    if (!(this.api && this.api instanceof MQApi)) {
      throw new TypeError('The document do not contains MQApi instance');
    }
    return this.api as MQApi;
  }

  getWsApi(): WSApi {
    if (!(this.api && this.api instanceof WSApi)) {
      throw new TypeError('The document do not contains WSApi instance');
    }
    return this.api as WSApi;
  }

  toJSON(): OpraSchema.ApiDocument {
    return this.export();
  }

  /**
   * Export as Opra schema definition object
   */
  export(options?: ApiDocument.ExportOptions): OpraSchema.ApiDocument {
    const out = omitUndefined<OpraSchema.ApiDocument>({
      spec: OpraSchema.SpecVersion,
      id: this.id,
      url: this.url,
      info: this.exportInfo(options),
    });
    if (this.references.size) {
      let i = 0;
      const references: Record<string, OpraSchema.DocumentReference> = {};
      for (const [ns, doc] of this.references.entries()) {
        if (doc[BUILTIN]) continue;
        references[ns] = {
          id: doc.id,
          url: doc.url,
          // A reference's texts come from its *own* bundle, never this
          // document's — same rule as every other node. And when keys are
          // being collected (see `extractTranslations`), the reference
          // contributes none of its own: its bundle is extracted from its
          // own document, and letting it write here would overwrite this
          // document's `info` with the reference's.
          info: doc.exportInfo(
            options?.collect ? { ...options, collect: undefined } : options,
          ),
        };
        i++;
      }
      if (i) out.references = references;
    }
    if (this.types.size) {
      out.types = {};
      for (const v of this.types.values()) {
        if (!v.inScope(options?.scope)) continue;
        out.types[v.name!] = v.toJSON(options);
      }
    }
    if (this.api) out.api = this.api.toJSON(options);
    return out;
  }

  /**
   * Picks which of this document's own bundles serves `lang`: exact match →
   * base language (`tr-TR` → `tr`) → `defaultLanguage` → the first language
   * available (sorted, so the same request never resolves differently
   * between runs). `undefined` when this document has no translations.
   */
  resolveLanguage(lang?: string): string | undefined {
    if (!this.translations.size) return undefined;
    if (lang) {
      const wanted = lang.toLowerCase();
      if (this.translations.has(wanted)) return wanted;
      const i = wanted.indexOf('-');
      const base = i > 0 ? wanted.substring(0, i) : undefined;
      if (base && this.translations.has(base)) return base;
    }
    const fallback = this.defaultLanguage.toLowerCase();
    if (this.translations.has(fallback)) return fallback;
    return Array.from(this.translations.keys()).sort()[0];
  }

  getTranslations(lang?: string): TranslationBundle | undefined {
    const resolved = this.resolveLanguage(lang);
    return resolved ? this.translations.get(resolved) : undefined;
  }

  /**
   * `info`'s own texts, translated when a language was asked for. Kept
   * separate from `export()` because a reference document's `info` is
   * emitted from *its* bundle, not the importing document's.
   */
  exportInfo(options?: ApiDocument.ExportOptions): OpraSchema.DocumentInfo {
    const out = cloneObject(this.info, true);
    if (options?.collect) {
      const values: Record<string, string> = {};
      for (const k of ['title', 'description', 'termsOfService'] as const) {
        values[k] = typeof out[k] === 'string' ? (out[k] as string) : '';
      }
      const node = (options.collect.bundle.info ||= {}) as Record<string, any>;
      Object.assign(node, values);
      // A license's *text* is prose too (and long enough that leaving it in
      // the source is exactly the clutter this exists to remove). Its
      // `name`/`url` are identifiers and stay where they are.
      if (typeof out.license?.content === 'string' || out.license) {
        node.license = {
          ...(typeof node.license === 'object' ? node.license : {}),
          content: out.license?.content ?? '',
        };
      }
    }
    if (!options?.lang) return out;
    const bundle = this.getTranslations(options.lang);
    const texts = bundle?.info;
    if (!texts || typeof texts === 'string') return out;
    for (const k of ['title', 'description', 'termsOfService'] as const) {
      const v = texts[k];
      if (typeof v === 'string') out[k] = v;
    }
    const license = texts.license;
    if (out.license && license && typeof license === 'object') {
      const content = license.content;
      if (typeof content === 'string' && content) out.license.content = content;
    }
    return out;
  }

  invalidate(): void {
    /* Generate id. Deliberately translation-free: `export()` only resolves
     * texts when a `lang` is given, so the id stays a function of the
     * document's *structure* — editing a translation file must not change
     * the document's identity (and with it every cache key and reference
     * id that derives from it). */
    const x = this.export({});
    delete (x as any).id;
    (this as Mutable<ApiDocument>).id = md5(JSON.stringify(x));
    /* Clear [kTypeNSMap] */
    this[kTypeNSMap] = new WeakMap<DataType, string>();
  }

  protected _findDataType(
    nameOrCtor:
      string | Type | Function | EnumType.EnumArray | EnumType.EnumObject,
    scope?: string,
    visitedRefs?: WeakMap<ApiDocument, boolean>,
  ): DataType | undefined {
    let result = this.types.get(nameOrCtor);
    if (result && result.inScope(scope)) return result;
    if (!this.references.size) return;
    // Lookup for references
    if (typeof nameOrCtor === 'string') {
      // If given string has namespace pattern (ns:type_name)
      const m = NAMESPACE_PATTERN.exec(nameOrCtor);
      if (m) {
        const ns = m[1];
        if (ns) {
          const ref = this.references.get(ns);
          if (!ref) return;
          visitedRefs = visitedRefs || new WeakMap<ApiDocument, boolean>();
          visitedRefs.set(this, true);
          visitedRefs.set(ref, true);
          return ref._findDataType(m[2], scope, visitedRefs);
        }
        nameOrCtor = m[2];
      }
    }

    // if not found, search in references (from last to first)
    visitedRefs = visitedRefs || new WeakMap<ApiDocument, boolean>();
    visitedRefs.set(this, true);
    const references = Array.from(this.references.keys()).reverse();
    /* First step, lookup for own types */
    for (const refNs of references) {
      const ref = this.references.get(refNs);
      result = ref?.types.get(nameOrCtor);
      if (result) {
        this[kTypeNSMap].set(result, ref?.[BUILTIN] ? '' : refNs);
        return result;
      }
    }
    /* If not found lookup for child references */
    for (const refNs of references) {
      const ref = this.references.get(refNs);
      visitedRefs.set(ref!, true);
      result = ref!._findDataType(nameOrCtor, scope, visitedRefs);
      if (result) {
        this[kTypeNSMap].set(result, ref?.[BUILTIN] ? '' : refNs);
        return result;
      }
    }
  }
}

export namespace ApiDocument {
  export interface ExportOptions {
    scope?: string;
    /** Language to resolve documentation texts in (see
     *  `TranslationStore`). When omitted, nothing is looked up at all and
     *  the texts written in the source itself are exported as they are —
     *  this is what keeps the document's own id independent of any
     *  translation (see `invalidate()`). */
    lang?: string;
    /** Set by `extractTranslations()` to harvest the keys this export would
     *  look up, rather than to render a schema. */
    collect?: TranslationCollector;
  }
}
