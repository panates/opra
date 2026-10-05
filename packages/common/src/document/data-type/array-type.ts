import 'reflect-metadata';
import { omitUndefined } from '@jsopen/objects';
import type { Combine, Type } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { type Validator, vg } from 'valgen';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import type { DocumentElement } from '../common/document-element.js';
import type { DocumentInitContext } from '../common/document-init-context.js';
import { DATATYPE_METADATA, DECORATOR } from '../constants.js';
import type { ComplexType } from './complex-type.js';
import { DataType } from './data-type.js';
import { EnumType } from './enum-type.js';
import type { MappedType } from './mapped-type.js';
import type { MixinType } from './mixin-type.js';
import type { SimpleType } from './simple-type.js';
import type { UnionType } from './union-type.js';

/**
 * @namespace ArrayType
 */
export namespace ArrayType {
  export interface Metadata extends Combine<
    {
      kind: OpraSchema.ArrayType.Kind;
      name?: string;
      type: Type;
    },
    DataType.Metadata,
    OpraSchema.ArrayType
  > {}

  export interface InitArguments extends Combine<
    {
      kind: OpraSchema.ArrayType.Kind;
      type:
        | ArrayType
        | ComplexType
        | EnumType
        | MappedType
        | MixinType
        | SimpleType
        | UnionType;
      ctor?: Type;
    },
    DataType.InitArguments,
    ArrayType.Metadata
  > {}

  export interface Options extends Combine<
    Pick<OpraSchema.ArrayType, 'minOccurs' | 'maxOccurs'>,
    DataType.Options
  > {}
}

/**
 * Type definition for ArrayType
 * @class ArrayType
 */
export interface ArrayTypeStatic {
  /**
   * Class constructor of ArrayType
   *
   * @param owner
   * @param args
   * @constructor
   */
  new (owner: DocumentElement, args: ArrayType.InitArguments): ArrayType;

  /**
   * Create a new mixin type from the given data type
   */
  (
    type: string | Type | EnumType.EnumObject | object,
    options?: ArrayType.Options,
  ): Type;

  prototype: ArrayType;
}

/**
 * Type definition of ArrayType prototype
 * @interface
 */
export interface ArrayType extends ArrayTypeClass {}

/**
 * @class ArrayType
 */
export const ArrayType = function (this: ArrayType, ...args: any[]) {
  // ArrayType factory
  if (!this) {
    return ArrayType[DECORATOR].apply(undefined, args);
  }
  // Constructor
  const [owner, initArgs, context] = args as [
    DocumentElement,
    ArrayType.InitArguments,
    DocumentInitContext | undefined,
  ];
  DataType.call(this, owner, initArgs, context);
  const _this = asMutable(this);
  _this.kind = OpraSchema.ArrayType.Kind;
  _this.type = initArgs.type;
  _this.minOccurs = initArgs.minOccurs;
  _this.maxOccurs = initArgs.maxOccurs;
} as ArrayTypeStatic;

/**
 *
 * @class ArrayType
 */
class ArrayTypeClass extends DataType {
  declare readonly kind: OpraSchema.ArrayType.Kind;
  declare readonly type:
    | ComplexType
    | MixinType
    | MappedType
    | SimpleType
    | UnionType
    | EnumType
    | ArrayType;
  declare readonly minOccurs?: number;
  declare readonly maxOccurs?: number;

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.ArrayType {
    const superJson = super.toJSON(options);
    const typeName = this.node.getDataTypeNameWithNs(this.type);
    return omitUndefined<OpraSchema.ArrayType>({
      ...superJson,
      kind: this.kind as any,
      type: typeName ? typeName : this.type.toJSON(options),
      minOccurs: this.minOccurs,
      maxOccurs: this.maxOccurs,
    });
  }

  generateCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
    properties?: object,
  ): Validator {
    let fn = this.type.generateCodec(codec, options, properties);
    fn = vg.isArray(fn);
    const fns: any[] = [];
    if (this.minOccurs) fns.push(vg.lengthMin(this.minOccurs));
    if (this.maxOccurs) fns.push(vg.lengthMax(this.maxOccurs));
    if (fns.length > 0) return vg.pipe([fn, ...fns], { returnIndex: 0 });
    return fn;
  }

  extendsFrom(): boolean {
    return false;
  }

  protected _locateBase(): ArrayType | undefined {
    return;
  }
}

ArrayType.prototype = ArrayTypeClass.prototype;
ArrayType[DECORATOR] = ArrayTypeFactory;

/**
 *
 */
function ArrayTypeFactory(clasRefs: Type, options?: ArrayType.Options): Type {
  class ArrayClass {}

  const metadata: ArrayType.Metadata = {
    ...options,
    kind: OpraSchema.ArrayType.Kind,
    type: clasRefs,
  };
  Reflect.defineMetadata(DATATYPE_METADATA, metadata, ArrayClass);
  return ArrayClass as any;
}
