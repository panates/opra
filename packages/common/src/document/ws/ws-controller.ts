import { omitUndefined } from '@jsopen/objects';
import type { Combine, ThunkAsync, Type } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { ResponsiveMap } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DataTypeMap } from '../common/data-type-map.js';
import { DocumentElement } from '../common/document-element.js';
import { applyTranslations } from '../common/translate-doc.js';
import { CLASS_NAME_PATTERN, DECORATOR, kDataTypeMap } from '../constants.js';
import type { EnumType } from '../data-type/enum-type.js';
import { WSControllerDecoratorFactory } from '../decorators/ws-controller.decorator.js';
import {
  colorFgMagenta,
  colorFgYellow,
  colorReset,
  nodeInspectCustom,
} from '../utils/inspect.util.js';
import type { WSApi } from './ws-api.js';
import type { WSOperation } from './ws-operation.js';

/**
 * @namespace WSController
 */
export namespace WSController {
  export interface Metadata extends Pick<
    OpraSchema.WSController,
    'description'
  > {
    name: string;
    types?: ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>[];
    operations?: Record<string, WSOperation.Metadata>;
  }

  export interface Options extends Partial<
    Pick<OpraSchema.WSController, 'description'>
  > {
    name?: string;
  }

  export interface InitArguments extends Combine<
    {
      instance?: object;
      ctor?: Type;
    },
    Pick<Metadata, 'name' | 'description'>
  > {}
}

/**
 * Type definition for WSController
 * @class WSController
 */
export interface WSControllerStatic extends WSControllerDecoratorFactory {
  /**
   * Class constructor of WSController
   * @param owner
   * @param args
   */
  new (
    owner: WSApi | WSController,
    args: WSController.InitArguments,
  ): WSController;

  prototype: WSController;
}

/**
 * Type definition of WSController prototype
 * @interface WSController
 */
export interface WSController extends WSControllerClass {}

/**
 * WSController
 */
export const WSController = function (
  this: WSController | void,
  ...args: any[]
) {
  // ClassDecorator
  if (!this) return WSController[DECORATOR].apply(undefined, args);

  // Constructor
  const [owner, initArgs] = args as [
    WSApi | WSController,
    WSController.InitArguments,
  ];
  DocumentElement.call(this, owner);
  if (!CLASS_NAME_PATTERN.test(initArgs.name))
    throw new TypeError(`Invalid resource name (${initArgs.name})`);
  const _this = asMutable(this);
  _this.kind = OpraSchema.WSController.Kind;
  _this.types = _this.node[kDataTypeMap] = new DataTypeMap();
  _this.operations = new ResponsiveMap();
  _this.name = initArgs.name;
  _this.description = initArgs.description;
  _this.instance = initArgs.instance;
  _this.ctor = initArgs.ctor;
  (_this as any)._controllerReverseMap = new WeakMap();
  (_this as any)._initialize?.(initArgs);
} as WSControllerStatic;

/**
 *
 * @class WSController
 */
class WSControllerClass extends DocumentElement {
  protected get docKeySegment(): string[] {
    return ['controllers', this.docKey || this.name];
  }

  declare protected _controllerReverseMap: WeakMap<Type, WSController | null>;
  declare readonly kind: OpraSchema.WSController.Kind;
  declare readonly name: string;
  declare description?: string;
  declare instance?: any;
  declare ctor?: Type;
  declare operations: ResponsiveMap<WSOperation>;
  declare types: DataTypeMap;

  /**
   *
   */
  toString(): string {
    return `[WSController ${this.name}]`;
  }

  /**
   *
   */
  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.WSController {
    const out = applyTranslations(
      this,
      omitUndefined<OpraSchema.WSController>({
        kind: this.kind,
        description: this.description,
      }),
      options,
      ['description'],
    );
    if (this.operations.size) {
      out.operations = {};
      for (const v of this.operations.values()) {
        out.operations[v.name] = v.toJSON(options);
      }
    }
    if (this.types.size) {
      out.types = {};
      for (const v of this.types.values()) {
        out.types[v.name!] = v.toJSON(options);
      }
    }
    return out;
  }

  /**
   *
   */
  protected [nodeInspectCustom](): string {
    return `[${colorFgYellow}WSController${colorFgMagenta + this.name + colorReset}]`;
  }
}

WSController.prototype = WSControllerClass.prototype;
Object.assign(WSController, WSControllerDecoratorFactory);
WSController[DECORATOR] = WSControllerDecoratorFactory;
