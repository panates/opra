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
import { MQControllerDecoratorFactory } from '../decorators/mq-controller.decorator.js';
import {
  colorFgMagenta,
  colorFgYellow,
  colorReset,
  nodeInspectCustom,
} from '../utils/inspect.util.js';
import type { MQApi } from './mq-api.js';
import type { MQHeader } from './mq-header.js';
import type { MQOperation } from './mq-operation.js';

/**
 * @namespace MQController
 */
export namespace MQController {
  export interface Metadata extends Pick<
    OpraSchema.MQController,
    'description'
  > {
    name: string;
    types?: ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>[];
    operations?: Record<string, MQOperation.Metadata>;
    headers?: MQHeader.Metadata[];
  }

  export interface Options extends Partial<
    Pick<OpraSchema.MQController, 'description'>
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
 * Type definition for MQController
 * @class MQController
 */
export interface MQControllerStatic extends MQControllerDecoratorFactory {
  /**
   * Class constructor of MQController
   * @param owner
   * @param args
   */
  new (
    owner: MQApi | MQController,
    args: MQController.InitArguments,
  ): MQController;

  prototype: MQController;
}

/**
 * Type definition of MQController prototype
 * @interface MQController
 */
export interface MQController extends MQControllerClass {}

/**
 * MQController
 */
export const MQController = function (
  this: MQController | void,
  ...args: any[]
) {
  // ClassDecorator
  if (!this) return MQController[DECORATOR].apply(undefined, args);

  // Constructor
  const [owner, initArgs] = args as [
    MQApi | MQController,
    MQController.InitArguments,
  ];
  DocumentElement.call(this, owner);
  if (!CLASS_NAME_PATTERN.test(initArgs.name))
    throw new TypeError(`Invalid resource name (${initArgs.name})`);
  const _this = asMutable(this);
  _this.kind = OpraSchema.MQController.Kind;
  _this.types = _this.node[kDataTypeMap] = new DataTypeMap();
  _this.operations = new ResponsiveMap();
  _this.headers = [];
  _this.name = initArgs.name;
  _this.description = initArgs.description;
  _this.instance = initArgs.instance;
  _this.ctor = initArgs.ctor;
  (_this as any)._controllerReverseMap = new WeakMap();
  (_this as any)._initialize?.(initArgs);
} as MQControllerStatic;

/**
 *
 * @class MQController
 */
class MQControllerClass extends DocumentElement {
  protected get docKeySegment(): string[] {
    return ['controllers', this.docKey || this.name];
  }

  declare protected _controllerReverseMap: WeakMap<Type, MQController | null>;
  declare readonly kind: OpraSchema.MQController.Kind;
  declare readonly name: string;
  declare description?: string;
  declare path: string;
  declare instance?: any;
  declare ctor?: Type;
  declare headers: MQHeader[];
  declare operations: ResponsiveMap<MQOperation>;
  declare types: DataTypeMap;

  findHeader(
    paramName: string,
    location?: OpraSchema.HttpParameterLocation,
  ): MQHeader | undefined {
    const paramNameLower = paramName.toLowerCase();
    let prm: any;
    for (prm of this.headers) {
      if (typeof prm.name === 'string') {
        prm._nameLower = prm._nameLower || prm.name.toLowerCase();
        if (prm._nameLower === paramNameLower) return prm;
      }
      if (prm.name instanceof RegExp && prm.name.test(paramName)) return prm;
    }
    if (this.node.parent && this.node.parent.element instanceof MQController) {
      return this.node.parent.element.findHeader(paramName, location);
    }
  }

  /**
   *
   */
  toString(): string {
    return `[MQController ${this.name}]`;
  }

  /**
   *
   */
  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.MQController {
    const out = applyTranslations(
      this,
      omitUndefined<OpraSchema.MQController>({
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
    if (this.headers.length) {
      out.headers = [];
      for (const prm of this.headers) {
        out.headers.push(prm.toJSON(options));
      }
    }
    return out;
  }

  /**
   *
   */
  protected [nodeInspectCustom](): string {
    return `[${colorFgYellow}MQController${colorFgMagenta + this.name + colorReset}]`;
  }
}

MQController.prototype = MQControllerClass.prototype;
Object.assign(MQController, MQControllerDecoratorFactory);
MQController[DECORATOR] = MQControllerDecoratorFactory;
