import type { StrictOmit, Type } from 'ts-gems';
import { ResponsiveMap } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { ApiBase } from '../common/api-base.js';
import { applyTranslations } from '../common/translate-doc.js';
import { HttpController } from './http-controller.js';
import type { HttpOperation } from './http-operation.js';

export namespace HttpApi {
  /** A server/section as *declared*: the schema shape plus an optional,
   *  never-exported `docKey`. Servers especially need one — their `url` is
   *  often environment-dependent, so it makes a poor documentation key. */
  export interface ServerInit extends OpraSchema.HttpServer {
    docKey?: string;
  }

  export interface SectionInit extends OpraSchema.HttpSection {
    docKey?: string;
  }

  export interface InitArguments
    extends
      ApiBase.InitArguments,
      StrictOmit<OpraSchema.HttpApi, 'controllers' | 'servers' | 'sections'> {
    transport: 'http';
    servers?: ServerInit[];
    sections?: SectionInit[];
  }
}

/**
 * @class HttpApi
 */
export class HttpApi extends ApiBase {
  // noinspection JSUnusedGlobalSymbols
  protected _controllerReverseMap: WeakMap<Type, HttpController | null> =
    new WeakMap();
  declare readonly owner: ApiDocument;
  readonly transport = 'http';
  controllers: ResponsiveMap<HttpController> = new ResponsiveMap();
  url?: string;
  servers?: HttpApi.ServerInit[];
  sections?: HttpApi.SectionInit[];

  constructor(init: HttpApi.InitArguments) {
    super(init);
    this.url = init.url;
    this.servers = init.servers?.map(s => ({ ...s }));
    this.sections = init.sections?.map(g => ({ ...g }));
  }

  findController(controller: Type): HttpController | undefined;
  findController(resourcePath: string): HttpController | undefined;
  findController(arg0: string | Type): HttpController | undefined {
    return HttpController.prototype.findController.call(this, arg0 as any);
  }

  findOperation(
    controller: Type,
    operationName: string,
  ): HttpOperation | undefined;
  findOperation(
    resourcePath: string,
    operationName: string,
  ): HttpOperation | undefined;
  findOperation(
    arg0: string | Type,
    operationName: string,
  ): HttpOperation | undefined {
    const controller = this.findController(arg0 as any);
    return controller?.operations.get(operationName);
  }

  protected get docKeySegment(): string {
    return 'api';
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.HttpApi {
    const schema = super.toJSON(options);
    const out: OpraSchema.HttpApi = {
      ...schema,
      transport: this.transport,
      url: this.url,
      servers: this.exportPlainList(
        this.servers,
        'servers',
        s => s.url,
        options,
      ),
      sections: this.exportPlainList(
        this.sections,
        'sections',
        s => s.name,
        options,
      ),
      controllers: {},
    };
    for (const v of this.controllers.values()) {
      out.controllers[v.name] = v.toJSON(options);
    }
    return out;
  }

  /** `servers`/`sections` are plain objects rather than document elements,
   *  so they get their texts through this api's own key plus one container
   *  level. `docKey` is stripped here — it is an authoring aid, not part of
   *  the published schema. */
  protected exportPlainList<
    T extends { description?: string; docKey?: string },
  >(
    items: T[] | undefined,
    container: string,
    keyOf: (item: T) => string | undefined,
    options?: ApiDocument.ExportOptions,
  ): T[] | undefined {
    if (!items) return undefined;
    return items.map((item, i) => {
      const { docKey, ...rest } = item;
      return applyTranslations(
        this,
        rest as T,
        options,
        ['description'],
        [container, docKey || keyOf(item) || String(i)],
        // A server's `url` is usually environment-dependent, so keying
        // documentation by it is fragile — flagged unless a `docKey` says
        // otherwise. A section's `name` is a real identifier.
        container === 'servers' && !docKey,
      );
    });
  }
}
