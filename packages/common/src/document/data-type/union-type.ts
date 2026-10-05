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
import type { MappedType } from './mapped-type.js';
import type { MixinType } from './mixin-type.js';
import type { SimpleType } from './simple-type.js';

/**
 * @namespace UnionType
 */
export namespace UnionType {
  export interface Metadata extends Combine<
    {
      kind: OpraSchema.UnionType.Kind;
      name?: string;
      types: Type[];
    },
    DataType.Metadata,
    OpraSchema.UnionType
  > {}

  export interface InitArguments extends Combine<
    {
      kind: OpraSchema.UnionType.Kind;
      types: (ComplexType | MappedType | MixinType | SimpleType)[];
      ctor?: Type;
    },
    DataType.InitArguments,
    UnionType.Metadata
  > {}

  export interface Options extends Combine<
    Pick<OpraSchema.UnionType, 'discriminator'>,
    DataType.Options
  > {}
}

/**
 * Type definition for UnionType
 * @class UnionType
 */
export interface UnionTypeStatic {
  /**
   * Class constructor of UnionType
   *
   * @param owner
   * @param args
   * @constructor
   */
  new (owner: DocumentElement, args: UnionType.InitArguments): UnionType;

  /**
   * Create a new mixin type from given two types
   */
  (types: (string | Type | object)[], options?: UnionType.Options): Type;

  prototype: UnionType;
}

/**
 * Type definition of UnionType prototype
 * @interface
 */
export interface UnionType extends UnionTypeClass {}

/**
 * @class UnionType
 */
export const UnionType = function (this: UnionType, ...args: any[]) {
  // UnionType factory
  if (!this) {
    return UnionType[DECORATOR].apply(undefined, args);
  }
  // Constructor
  const [owner, initArgs, context] = args as [
    DocumentElement,
    UnionType.InitArguments,
    DocumentInitContext | undefined,
  ];
  DataType.call(this, owner, initArgs, context);
  const _this = asMutable(this);
  _this.kind = OpraSchema.UnionType.Kind;
  _this.discriminator = initArgs.discriminator;
  _this.types = [];
  for (const base of initArgs.types) {
    _this.types.push(base);
  }
} as UnionTypeStatic;

/**
 *
 * @class UnionType
 */
class UnionTypeClass extends DataType {
  declare readonly kind: OpraSchema.UnionType.Kind;
  declare readonly types: (ComplexType | MixinType | MappedType | SimpleType)[];
  declare readonly discriminator?: string;

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.UnionType {
    const superJson = super.toJSON(options);
    return omitUndefined<OpraSchema.UnionType>({
      ...superJson,
      kind: this.kind as any,
      discriminator: this.discriminator,
      types: this.types.map(base => {
        const baseName = this.node.getDataTypeNameWithNs(base);
        return baseName ? baseName : base.toJSON(options);
      }),
    });
  }

  generateCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
  ): Validator {
    const codecs: any = this.types.map(t => {
      const fn = t.generateCodec(codec, options);
      if (
        (t.kind === OpraSchema.ComplexType.Kind ||
          t.kind === OpraSchema.MappedType.Kind) &&
        t.discriminatorField
      ) {
        return [
          fn,
          { [t.discriminatorField]: vg.isEqual(t.discriminatorValue) },
        ];
      }
      return fn;
    });
    return vg.oneOf(codecs);
  }

  extendsFrom(): boolean {
    return false;
  }

  protected _locateBase(): UnionType | undefined {
    return;
  }
}

UnionType.prototype = UnionTypeClass.prototype;
UnionType[DECORATOR] = UnionTypeFactory;

/**
 *
 */
function UnionTypeFactory(clasRefs: Type[], options?: DataType.Options): Type {
  class UnionClass {}

  const metadata: UnionType.Metadata = {
    ...options,
    kind: OpraSchema.UnionType.Kind,
    types: clasRefs,
  };
  Reflect.defineMetadata(DATATYPE_METADATA, metadata, UnionClass);
  return UnionClass as any;
}
