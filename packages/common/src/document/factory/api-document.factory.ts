import { updateErrorMessage } from '@jsopen/objects';
import type { PartialSome, StrictOmit, ThunkAsync } from 'ts-gems';
import { resolveThunk } from '../../helpers/index.js';
import type {
  TranslationBundle,
  TranslationStore,
} from '../../i18n/translation-store.js';
import { OpraSchema } from '../../schema/index.js';
import { ApiDocument } from '../api-document.js';
import { DocumentInitContext } from '../common/document-init-context.js';
import { OpraDocumentError } from '../common/opra-document-error.js';
import { BUILTIN, CLASS_NAME_PATTERN, kCtorMap } from '../constants.js';
import * as extendedTypes from '../data-type/extended-types/index.js';
import * as primitiveTypes from '../data-type/primitive-types/index.js';
import { DataTypeFactory } from './data-type.factory.js';
import { HttpApiFactory } from './http-api.factory.js';
import { MQApiFactory } from './mq-api.factory.js';
import { WSApiFactory } from './ws-api.factory.js';

const OPRA_SPEC_URL = 'https://oprajs.com/spec/v' + OpraSchema.SpecVersion;

export namespace ApiDocumentFactory {
  export interface InitArguments extends PartialSome<
    StrictOmit<OpraSchema.ApiDocument, 'id' | 'references' | 'types' | 'api'>,
    'spec'
  > {
    references?: Record<string, ReferenceThunk>;
    types?: DataTypeInitSources;
    /** Documentation texts per language, either inline or through a store
     *  that loads them (a directory of JSON files, a remote source). Every
     *  language the store lists is materialized here, while this document
     *  is being built, so that `export()` can stay synchronous. */
    translations?: Record<string, TranslationBundle>;
    translationStore?: TranslationStore;
    /** The language `export()` falls back to. Defaults to `'en'`. */
    defaultLanguage?: string;
    api?:
      | StrictOmit<HttpApiFactory.InitArguments, 'owner'>
      | StrictOmit<MQApiFactory.InitArguments, 'owner'>
      | StrictOmit<WSApiFactory.InitArguments, 'owner'>;
  }

  export type ReferenceSource =
    string | OpraSchema.ApiDocument | InitArguments | ApiDocument;
  export type ReferenceThunk = ThunkAsync<ReferenceSource>;

  export type DataTypeInitSources = DataTypeFactory.DataTypeSources;
}

/**
 * @class ApiDocumentFactory
 */
export class ApiDocumentFactory {
  private _allDocuments: Record<string, ApiDocument> = {};

  /**
   * Creates ApiDocument instance from given schema object
   */
  static async createDocument(
    schemaOrUrl:
      | string
      | PartialSome<OpraSchema.ApiDocument, 'spec'>
      | ApiDocumentFactory.InitArguments,
    options?:
      | Partial<Pick<DocumentInitContext, 'maxErrors' | 'showErrorDetails'>>
      | DocumentInitContext,
  ): Promise<ApiDocument> {
    const factory = new ApiDocumentFactory();
    const context: DocumentInitContext =
      options instanceof DocumentInitContext
        ? options
        : new DocumentInitContext(options);
    try {
      const document = new ApiDocument();
      await factory.initDocument(document, context, schemaOrUrl);
      if (context.error.details.length) throw context.error;
      return document;
    } catch (e: any) {
      try {
        if (!(e instanceof OpraDocumentError)) {
          context.addError(e);
        }
      } catch {
        //
      }
      if (!context.error.message) {
        const l = context.error.details.length;
        let message = `(${l}) error${l > 1 ? 's' : ''} found in document schema.`;
        if (context.showErrorDetails) {
          message += context.error.details
            .map(
              d => `\n\n  - ${d.message}` + (d.path ? `\n    @${d.path}` : ''),
            )
            .join('');
        }
        updateErrorMessage(context.error, message);
      }
      throw context.error;
    }
  }

  /**
   * Downloads schema from the given URL and creates the document instance   * @param url
   */
  protected async initDocument(
    document: ApiDocument,
    context: DocumentInitContext,
    schemaOrUrl: ApiDocumentFactory.InitArguments | string,
  ): Promise<void> {
    let init: ApiDocumentFactory.InitArguments;
    if (typeof schemaOrUrl === 'string') {
      const resp = await fetch(schemaOrUrl, { method: 'GET' });
      init = await resp.json();
      if (!init)
        return context.addError(
          `Invalid response returned from url: ${schemaOrUrl}`,
        );
      init.url = schemaOrUrl;
    } else init = schemaOrUrl;

    // Add builtin data types if this document is the root
    let builtinDocument: ApiDocument | undefined;
    if (!document[BUILTIN]) {
      const t = document.node.findDataType('string');
      builtinDocument = t?.node.getDocument();
      if (!builtinDocument) {
        builtinDocument = await this.createBuiltinDocument(context);
        document.references.set('opra', builtinDocument);
      }
    }

    init.spec = init.spec || OpraSchema.SpecVersion;
    document.url = init.url;
    if (init.info) document.info = { ...init.info };
    await this.loadTranslations(document, init);

    /* Add references  */
    if (init.references) {
      await context.enterAsync('.references', async () => {
        let ns: string;
        let r: any;
        for ([ns, r] of Object.entries(init.references!)) {
          r = await resolveThunk(r);
          await context.enterAsync(`[${ns}]`, async () => {
            if (!CLASS_NAME_PATTERN.test(ns))
              throw new TypeError(`Invalid namespace (${ns})`);
            if (r instanceof ApiDocument) {
              document.references.set(ns, r);
              return;
            }
            const refDoc = new ApiDocument();
            if (builtinDocument) refDoc.references.set('opra', builtinDocument);
            await this.initDocument(refDoc, context, r);
            document.references.set(ns, this._allDocuments[refDoc.id]);
          });
        }
      });
    }

    if (init.types) {
      await context.enterAsync('.types', async () => {
        await DataTypeFactory.addDataTypes(context, document, init.types!);
      });
    }

    if (init.api) {
      await context.enterAsync(`.api`, async () => {
        if (init.api && init.api.transport === 'http') {
          const api = await HttpApiFactory.createApi(context, {
            ...init.api,
            owner: document,
          });
          if (api) document.api = api;
        } else if (init.api && init.api.transport === 'mq') {
          const api = await MQApiFactory.createApi(context, {
            ...init.api,
            owner: document,
          });
          if (api) document.api = api;
        } else if (init.api && init.api.transport === 'ws') {
          const api = await WSApiFactory.createApi(context, {
            ...init.api,
            owner: document,
          });
          if (api) document.api = api;
        } else
          context.addError(
            `Unknown service transport (${init.api!.transport})`,
          );
      });
    }
    document.invalidate();
    /* Add document to global registry */
    if (!this._allDocuments[document.id])
      this._allDocuments[document.id] = document;
  }

  /**
   * Materializes every language this document can be exported in. Bundle
   * keys are lower-cased so that a request for `EN` or `tr-TR` resolves the
   * same way regardless of how the language was written.
   */
  protected async loadTranslations(
    document: ApiDocument,
    init: ApiDocumentFactory.InitArguments,
  ): Promise<void> {
    if (init.defaultLanguage) document.defaultLanguage = init.defaultLanguage;
    if (init.translations) {
      for (const [lang, bundle] of Object.entries(init.translations)) {
        document.translations.set(lang.toLowerCase(), bundle);
      }
    }
    const store = init.translationStore;
    if (!store) return;
    /* Kept on the document, not just consumed here: a bundle is read from
     * this store and must be written back to it, and the only component that
     * can state that without guessing is the document itself. */
    document.translationStore = store;
    for (const lang of await store.listLanguages()) {
      const bundle = await store.load(lang);
      if (bundle) document.translations.set(lang.toLowerCase(), bundle);
    }
  }

  /**
   *
   * @param context
   * @protected
   */
  protected async createBuiltinDocument(
    context: DocumentInitContext,
  ): Promise<ApiDocument> {
    const init: ApiDocumentFactory.InitArguments = {
      spec: OpraSchema.SpecVersion,
      url: OPRA_SPEC_URL,
      info: {
        version: OpraSchema.SpecVersion,
        title: 'Opra built-in types',
        license: {
          url: 'https://github.com/panates/opra/blob/main/LICENSE',
          name: 'MIT',
        },
      },
      types: [
        ...Object.values(primitiveTypes),
        ...Object.values(extendedTypes),
      ],
    };
    const document = new ApiDocument();
    document[BUILTIN] = true;
    const BigIntConstructor = Object.getPrototypeOf(BigInt(0)).constructor;
    // `Buffer` is a Node global, absent in a browser (e.g. `@opra/api-ui`'s
    // client-side codegen bundle, which calls `createDocument()` on an
    // already-exported schema) — this mapping is only ever needed to infer
    // a decorated class field's type from its `Buffer`-typed design type,
    // which a browser, never decorating classes itself, has no use for.
    const BufferConstructor =
      typeof Buffer !== 'undefined'
        ? Object.getPrototypeOf(Buffer.from([]))
        : undefined;
    const _ctorTypeMap = document.types[kCtorMap];
    _ctorTypeMap.set(Object, 'object');
    _ctorTypeMap.set(String, 'string');
    _ctorTypeMap.set(Number, 'number');
    _ctorTypeMap.set(Boolean, 'boolean');
    _ctorTypeMap.set(Object, 'any');
    _ctorTypeMap.set(Date, 'datetime');
    _ctorTypeMap.set(BigIntConstructor, 'bigint');
    _ctorTypeMap.set(ArrayBuffer, 'base64');
    if (BufferConstructor) _ctorTypeMap.set(BufferConstructor, 'base64');
    await this.initDocument(document, context, init);
    return document;
  }
}
