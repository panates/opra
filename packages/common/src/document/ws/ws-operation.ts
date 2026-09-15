import { omitUndefined } from '@jsopen/objects';
import type { Combine, ThunkAsync, Type } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DataTypeMap } from '../common/data-type-map.js';
import { DocumentElement } from '../common/document-element.js';
import { applyTranslations } from '../common/translate-doc.js';
import { CLASS_NAME_PATTERN, DECORATOR, kDataTypeMap } from '../constants.js';
import { DataType } from '../data-type/data-type.js';
import type { EnumType } from '../data-type/enum-type.js';
import {
  type WSOperationDecorator,
  WSOperationDecoratorFactory,
} from '../decorators/ws-operation.decorator.js';
import { parseRegExp } from '../utils/parse-regexp.util.js';
import { WSController } from './ws-controller.js';

/**
 * @namespace WSOperation
 */
export namespace WSOperation {
  export interface Metadata extends Pick<
    OpraSchema.WSOperation,
    'description' | 'event'
  > {
    arguments?: {
      type:
        ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray> | string;
      parameterIndex: number;
      required?: boolean;
    }[];
    types?: ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>[];
    response?: ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>[];
  }

  export interface Options extends Partial<Pick<Metadata, 'description'>> {
    event?: string | RegExp;
    response?:
      string | ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>;
  }

  export interface InitArguments extends Combine<
    {
      name: string;
      types?: DataType[];
      arguments?: {
        type: DataType | string | Type;
        parameterIndex: number;
        required?: boolean;
      }[];
    },
    Pick<Metadata, 'description'>
  > {
    event?: string | RegExp;
    response?: DataType | string | Type;
  }
}

/**
 * Type definition for WSOperation
 * @class WSOperation
 */
export interface WSOperationStatic {
  /**
   * Class constructor of WSOperation
   * @param controller
   * @param args
   */
  new (controller: WSController, args: WSOperation.InitArguments): WSOperation;

  /**
   * Property decorator
   * @param options
   */ <T extends WSOperation.Options>(options?: T): WSOperationDecorator;

  prototype: WSOperation;
}

/**
 * @class WSOperation
 */
export interface WSOperation extends WSOperationClass {}

/**
 *  WSOperation
 */
export const WSOperation = function (this: WSOperation, ...args: any[]) {
  // Decorator
  if (!this) {
    const [type, options] = args as [
      type: ThunkAsync<Type> | string,
      options: WSOperation.Options,
    ];
    const decoratorChain: Function[] = [];
    return (WSOperation[DECORATOR] as WSOperationDecoratorFactory).call(
      undefined,
      decoratorChain,
      type,
      options,
    );
  }

  // Constructor
  const [resource, initArgs] = args as [
    WSController,
    WSOperation.InitArguments,
  ];
  DocumentElement.call(this, resource);
  if (!CLASS_NAME_PATTERN.test(initArgs.name))
    throw new TypeError(`Invalid operation name (${initArgs.name})`);
  const _this = asMutable(this);
  _this.types = _this.node[kDataTypeMap] = new DataTypeMap();
  // noinspection JSConstantReassignment
  _this.name = initArgs.name;
  _this.description = initArgs.description;
  if (initArgs.event)
    this.event =
      initArgs.event instanceof RegExp
        ? initArgs.event
        : initArgs.event.startsWith('/')
          ? parseRegExp(initArgs.event)
          : initArgs.event;
  else _this.event = this.name;
  if (initArgs?.arguments) {
    _this.arguments = initArgs.arguments.map(arg => {
      const type =
        arg.type instanceof DataType
          ? arg.type
          : _this.owner.node.getDataType(arg.type);
      return { type, parameterIndex: arg.parameterIndex };
    });
  } else _this.arguments = [];
  if (initArgs?.response)
    _this.response =
      initArgs.response instanceof DataType
        ? initArgs.response
        : _this.owner.node.getDataType(initArgs.response);
} as WSOperationStatic;

/**
 * @class WSOperation
 */
class WSOperationClass extends DocumentElement {
  protected get docKeySegment(): string[] {
    return ['operations', this.docKey || this.name];
  }

  declare readonly owner: WSController;
  declare readonly name: string;
  declare description?: string;
  declare event: string | RegExp;
  declare arguments: {
    type: DataType;
    parameterIndex: number;
    required?: boolean;
  }[];
  declare types: DataTypeMap;
  declare response?: DataType;

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.WSOperation {
    return applyTranslations(
      this,
      omitUndefined<OpraSchema.WSOperation>({
        kind: OpraSchema.WSOperation.Kind,
        description: this.description,
        event: this.event,
        arguments: this.arguments?.map(arg =>
          arg.type.name ? arg.type.name : arg.type.toJSON(options),
        ),
      }),
      options,
      ['description'],
    );
  }
}

WSOperation.prototype = WSOperationClass.prototype;
WSOperation[DECORATOR] = WSOperationDecoratorFactory;
