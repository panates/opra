import type { StrictOmit, Type } from 'ts-gems';
import { ResponsiveMap } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { ApiBase } from '../common/api-base.js';
import { HttpController } from './http-controller.js';
import type { HttpOperation } from './http-operation.js';

export namespace HttpApi {
  export interface InitArguments
    extends
      ApiBase.InitArguments,
      StrictOmit<OpraSchema.HttpApi, 'controllers'> {
    transport: 'http';
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
  servers?: OpraSchema.HttpServer[];

  constructor(init: HttpApi.InitArguments) {
    super(init);
    this.url = init.url;
    this.servers = init.servers?.map(s => ({ ...s }));
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

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.HttpApi {
    const schema = super.toJSON();
    const out: OpraSchema.HttpApi = {
      ...schema,
      transport: this.transport,
      url: this.url,
      servers: this.servers,
      controllers: {},
    };
    for (const v of this.controllers.values()) {
      out.controllers[v.name] = v.toJSON(options);
    }
    return out;
  }
}
