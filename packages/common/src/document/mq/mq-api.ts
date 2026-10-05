import type { StrictOmit, Type } from 'ts-gems';
import { ResponsiveMap } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { ApiBase } from '../common/api-base.js';
import { MQController } from './mq-controller.js';
import { MQOperation } from './mq-operation.js';

export namespace MQApi {
  export interface InitArguments
    extends
      ApiBase.InitArguments,
      StrictOmit<OpraSchema.MQApi, 'controllers'> {}
}

/**
 * @class MQApi
 */
export class MQApi extends ApiBase {
  protected get docKeySegment(): string {
    return 'api';
  }

  // noinspection JSUnusedGlobalSymbols
  protected _controllerReverseMap: WeakMap<Type, MQController | null> =
    new WeakMap();
  declare readonly owner: ApiDocument;
  readonly transport = 'mq';
  platform: string;
  controllers: ResponsiveMap<MQController> = new ResponsiveMap();

  constructor(init: MQApi.InitArguments) {
    super(init);
    this.platform = init.platform;
  }

  findController(controller: Type): MQController | undefined;
  findController(name: string): MQController | undefined;
  findController(arg0: string | Type): MQController | undefined {
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
  ): MQOperation | undefined;
  findOperation(
    controllerName: string,
    operationName: string,
  ): MQOperation | undefined;
  findOperation(
    arg0: string | Type,
    operationName: string,
  ): MQOperation | undefined {
    const controller = this.findController(arg0 as any);
    return controller?.operations.get(operationName);
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.MQApi {
    const schema = super.toJSON(options);
    const out: OpraSchema.MQApi = {
      ...schema,
      transport: this.transport,
      platform: this.platform,
      controllers: {},
    };
    for (const v of this.controllers.values()) {
      out.controllers[v.name] = v.toJSON(options);
    }
    return out;
  }
}
