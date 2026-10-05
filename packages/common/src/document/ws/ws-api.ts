import type { StrictOmit, Type } from 'ts-gems';
import { ResponsiveMap } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { ApiBase } from '../common/api-base.js';
import { WSController } from './ws-controller.js';
import { WSOperation } from './ws-operation.js';

export namespace WSApi {
  export interface InitArguments
    extends
      ApiBase.InitArguments,
      StrictOmit<OpraSchema.WSApi, 'controllers'> {}
}

/**
 * @class WSApi
 */
export class WSApi extends ApiBase {
  protected get docKeySegment(): string {
    return 'api';
  }

  // noinspection JSUnusedGlobalSymbols
  protected _controllerReverseMap: WeakMap<Type, WSController | null> =
    new WeakMap();
  declare readonly owner: ApiDocument;
  readonly transport = 'ws';
  controllers: ResponsiveMap<WSController> = new ResponsiveMap();

  constructor(init: WSApi.InitArguments) {
    super(init);
  }

  findController(controller: Type): WSController | undefined;
  findController(name: string): WSController | undefined;
  findController(arg0: string | Type): WSController | undefined {
    if (typeof arg0 === 'function') {
      /* Check for cached mapping */
      const controller = this._controllerReverseMap.get(arg0);
      if (controller != null) return controller;
      /* Lookup for ctor in all controllers */
      for (const c of this.controllers.values()) {
        if (c.ctor === arg0) {
          this._controllerReverseMap.set(arg0, c);
          return c;
        }
      }
      this._controllerReverseMap.set(arg0, null);
      return;
    }
    return this.controllers.get(arg0);
  }

  findOperation(
    controller: Type,
    operationName: string,
  ): WSOperation | undefined;
  findOperation(
    controllerName: string,
    operationName: string,
  ): WSOperation | undefined;
  findOperation(
    arg0: string | Type,
    operationName: string,
  ): WSOperation | undefined {
    const controller = this.findController(arg0 as any);
    return controller?.operations.get(operationName);
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.WSApi {
    const schema = super.toJSON(options);
    const out: OpraSchema.WSApi = {
      ...schema,
      transport: this.transport,
      controllers: {},
    };
    for (const v of this.controllers.values()) {
      out.controllers[v.name] = v.toJSON(options);
    }
    return out;
  }
}
