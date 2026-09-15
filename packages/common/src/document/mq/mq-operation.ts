import { omitUndefined } from '@jsopen/objects';
import type { Combine, ThunkAsync, Type, TypeThunkAsync } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { type Validator, vg } from 'valgen';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DataTypeMap } from '../common/data-type-map.js';
import { DocumentElement } from '../common/document-element.js';
import { applyTranslations } from '../common/translate-doc.js';
import { CLASS_NAME_PATTERN, DECORATOR, kDataTypeMap } from '../constants.js';
import { DataType } from '../data-type/data-type.js';
import type { EnumType } from '../data-type/enum-type.js';
import {
  type MQOperationDecorator,
  MQOperationDecoratorFactory,
} from '../decorators/mq-operation.decorator.js';
import type { MQController } from './mq-controller.js';
import type { MQHeader } from './mq-header.js';
import type { MQOperationResponse } from './mq-operation-response.js';

/**
 * @namespace MQOperation
 */
export namespace MQOperation {
  export interface Metadata extends Pick<
    OpraSchema.MQOperation,
    'description' | 'channel'
  > {
    type: TypeThunkAsync | string;
    keyType?: TypeThunkAsync | string;
    types?: ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>[];
    headers?: MQHeader.Metadata[];
    response?: MQOperationResponse.Metadata;
    designType?: Type;
    keyDesignType?: Type;
  }

  export interface Options extends Partial<
    Pick<Metadata, 'description' | 'keyType'>
  > {
    channel?: (string | RegExp) | (string | RegExp)[];
  }

  export interface InitArguments extends Combine<
    {
      name: string;
      types?: DataType[];
      type?: DataType | string | Type;
      keyType?: DataType | string | Type;
    },
    Pick<Metadata, 'description' | 'channel' | 'designType' | 'keyDesignType'>
  > {}
}

/**
 * Type definition for MQOperation
 * @class MQOperation
 */
export interface MQOperationStatic {
  /**
   * Class constructor of MQOperation
   * @param controller
   * @param args
   */
  new (controller: MQController, args: MQOperation.InitArguments): MQOperation;

  /**
   * Property decorator
   * @param type
   * @param options
   */ <T extends MQOperation.Options>(
    type: ThunkAsync<Type> | string,
    options?: T,
  ): MQOperationDecorator;

  prototype: MQOperation;
}

/**
 * @class MQOperation
 */
export interface MQOperation extends MQOperationClass {}

/**
 *  MQOperation
 */
export const MQOperation = function (this: MQOperation, ...args: any[]) {
  // Decorator
  if (!this) {
    const [type, options] = args as [
      type: ThunkAsync<Type> | string,
      options: MQOperation.Options,
    ];
    const decoratorChain: Function[] = [];
    return (MQOperation[DECORATOR] as MQOperationDecoratorFactory).call(
      undefined,
      decoratorChain,
      type,
      options,
    );
  }

  // Constructor
  const [resource, initArgs] = args as [
    MQController,
    MQOperation.InitArguments,
  ];
  DocumentElement.call(this, resource);
  if (!CLASS_NAME_PATTERN.test(initArgs.name))
    throw new TypeError(`Invalid operation name (${initArgs.name})`);
  const _this = asMutable(this);
  _this.headers = [];
  _this.types = _this.node[kDataTypeMap] = new DataTypeMap();
  _this.name = initArgs.name;
  _this.description = initArgs.description;
  _this.channel = initArgs.channel;
  if (initArgs?.type) {
    _this.type =
      initArgs?.type instanceof DataType
        ? initArgs.type
        : _this.owner.node.getDataType(initArgs.type);
  }
  if (initArgs?.keyType) {
    _this.keyType =
      initArgs?.keyType instanceof DataType
        ? initArgs.keyType
        : _this.owner.node.getDataType(initArgs.keyType);
  }
  _this.designType = initArgs.designType;
  _this.keyDesignType = initArgs.keyDesignType;
} as MQOperationStatic;

/**
 * @class MQOperation
 */
class MQOperationClass extends DocumentElement {
  protected get docKeySegment(): string[] {
    return ['operations', this.docKey || this.name];
  }

  declare readonly owner: MQController;
  declare readonly name: string;
  declare channel: string | RegExp | (string | RegExp)[];
  declare description?: string;
  declare type: DataType;
  declare keyType?: DataType;
  declare types: DataTypeMap;
  declare headers: MQHeader[];
  declare response: MQOperationResponse;
  declare designType?: Type;
  declare keyDesignType?: Type;

  findHeader(paramName: string): MQHeader | undefined {
    const paramNameLower = paramName.toLowerCase();
    let prm: any;
    for (prm of this.headers) {
      if (typeof prm.name === 'string') {
        prm._nameLower = prm._nameLower || prm.name.toLowerCase();
        if (prm._nameLower === paramNameLower) return prm;
      }
      if (prm.name instanceof RegExp && prm.name.test(paramName)) return prm;
    }
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.MQOperation {
    const out = applyTranslations(
      this,
      omitUndefined<OpraSchema.MQOperation>({
        kind: OpraSchema.MQOperation.Kind,
        description: this.description,
        channel: this.channel,
        type: this.type.name ? this.type.name : this.type.toJSON(options),
        keyType: this.keyType
          ? this.keyType.name
            ? this.keyType.name
            : this.keyType.toJSON(options)
          : undefined,
        response: this.response?.toJSON(options),
      }),
      options,
      ['description'],
    );
    if (this.headers.length) {
      out.headers = [];
      for (const prm of this.headers) {
        out.headers.push(prm.toJSON(options));
      }
    }
    return out;
  }

  generateCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
    properties?: any,
  ): Validator {
    return (
      this.type?.generateCodec(codec, options, {
        ...properties,
        designType: this.designType,
      }) || vg.isAny()
    );
  }

  generateKeyCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
    properties?: any,
  ): Validator {
    return (
      this.keyType?.generateCodec(codec, options, {
        ...properties,
        designType: this.keyDesignType,
      }) || vg.isAny()
    );
  }
}

MQOperation.prototype = MQOperationClass.prototype;
MQOperation[DECORATOR] = MQOperationDecoratorFactory;
