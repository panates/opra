import 'reflect-metadata';
import { omitUndefined } from '@jsopen/objects';
import { asMutable, type Combine, type Type } from 'ts-gems';
import { type Validator, vg } from 'valgen';
import { cloneObject } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import type { DocumentElement } from '../common/document-element.js';
import { DocumentInitContext } from '../common/document-init-context.js';
import { applyTranslations } from '../common/translate-doc.js';
import { DATATYPE_METADATA, DECORATOR } from '../constants.js';
import { DataType } from './data-type.js';

/**
 * @namespace EnumType
 */
export namespace EnumType {
  export type EnumObject = Record<string, string | number>;
  export type EnumArray = readonly string[];

  export interface Metadata extends Combine<
    {
      kind: OpraSchema.EnumType.Kind;
      base?: EnumObject | EnumArray | string;
      name: string;
    },
    DataType.Metadata,
    OpraSchema.EnumType
  > {}

  export interface Options<
    T,
    Keys extends string | number | symbol = T extends readonly any[]
      ? T[number]
      : keyof T,
  > extends Combine<
    {
      base?: EnumObject | EnumArray | string;
      meanings?: Record<Keys, string>;
    },
    DataType.Options
  > {}

  export interface InitArguments extends Combine<
    {
      kind: OpraSchema.EnumType.Kind;
      base?: EnumType;
      instance?: object;
    },
    DataType.InitArguments,
    EnumType.Metadata
  > {}
}

/**
 * Mixin type definition of class constructor and helper method for EnumType
 */
export interface EnumTypeStatic {
  /**
   * Class constructor of EnumType
   *
   * @param owner
   * @param args
   * @constructor
   */
  new (owner: DocumentElement, args?: EnumType.InitArguments): EnumType;

  <T extends EnumType.EnumObject, B extends EnumType.EnumObject>(
    enumSource: T,
    base?: B,
    options?: EnumType.Options<T>,
  ): B & T;

  <T extends EnumType.EnumArray, B extends EnumType.EnumArray>(
    enumSource: T,
    base?: B,
    options?: EnumType.Options<T>,
  ): B & T;

  <T extends EnumType.EnumObject | EnumType.EnumArray>(
    target: T,
    options?: EnumType.Options<T>,
  ): T;
}

/**
 * Type definition of EnumType prototype
 * @interface EnumType
 */
export interface EnumType extends EnumTypeClass {}

/**
 * @class EnumType
 */
export const EnumType = function (this: EnumType | void, ...args: any[]) {
  // Injector
  if (!this) return EnumType[DECORATOR].apply(undefined, args);
  // Constructor
  const [owner, initArgs, context] = args as [
    DocumentElement,
    EnumType.InitArguments,
    DocumentInitContext | undefined,
  ];
  DataType.call(this, owner, initArgs, context);
  const _this = asMutable(this);
  _this.kind = OpraSchema.EnumType.Kind;
  if (initArgs.base) {
    // noinspection SuspiciousTypeOfGuard
    if (!(initArgs.base instanceof EnumType)) {
      throw new TypeError(
        `"${(initArgs.base as DataType).kind}" can't be set as base for a "${_this.kind}"`,
      );
    }
    _this.base = initArgs.base;
  }
  _this.instance = initArgs.instance;
  _this.ownAttributes = cloneObject(initArgs.attributes || {});
  _this.attributes = _this.base ? cloneObject(_this.base.attributes) : {};
  for (const [k, el] of Object.entries(_this.ownAttributes)) {
    _this.attributes[k] = el;
  }
} as EnumTypeStatic;

/**
 * @class EnumType
 */
class EnumTypeClass extends DataType {
  declare readonly kind: OpraSchema.EnumType.Kind;
  declare readonly base?: EnumType;
  declare readonly instance?: object;
  declare readonly attributes: Record<
    string | number,
    OpraSchema.EnumType.ValueInfo
  >;
  declare readonly ownAttributes: Record<
    string | number,
    OpraSchema.EnumType.ValueInfo
  >;

  extendsFrom(baseType: DataType | string | Type | object): boolean {
    if (!(baseType instanceof DataType))
      baseType = this.node.getDataType(baseType);
    if (!(baseType instanceof EnumType)) return false;
    if (baseType === this) return true;
    return !!this.base?.extendsFrom(baseType);
  }

  generateCodec(): Validator {
    return vg.isEnum(Object.keys(this.attributes) as any);
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.EnumType {
    const superJson = super.toJSON(options);
    const baseName = this.base
      ? this.node.getDataTypeNameWithNs(this.base)
      : undefined;
    const attributes = cloneObject(this.ownAttributes);
    if (options?.lang) {
      // Only each value's `description` is prose — the value keys
      // themselves are data and stay untouched.
      for (const [key, info] of Object.entries(attributes)) {
        applyTranslations(
          this,
          info as any,
          options,
          ['description'],
          ['values', key],
        );
      }
    }
    return omitUndefined<OpraSchema.EnumType>({
      ...superJson,
      kind: this.kind,
      base: baseName,
      attributes,
    });
  }

  protected _locateBase(
    callback: (base: EnumType) => boolean,
  ): EnumType | undefined {
    if (!this.base) return;
    if (callback(this.base)) return this.base;
    if ((this.base as any)._locateBase)
      return (this.base as any)._locateBase(callback);
  }
}

EnumType.prototype = EnumTypeClass.prototype;
Object.assign(EnumType, EnumTypeClass);

/**
 *
 */
function EnumTypeFactory(enumSource: object, ...args: any[]) {
  const base = args.length >= 2 ? args[0] : undefined;
  const options = args.length >= 2 ? args[1] : args[0];
  let attributes: Record<string | number, OpraSchema.EnumType.ValueInfo> = {};
  let out = enumSource;
  if (Array.isArray(enumSource)) {
    if (base) {
      if (!Array.isArray(base))
        throw new TypeError(
          'Both "target" and "base" arguments should be array',
        );
      out = [...base, ...enumSource];
    }
    attributes = {};
    enumSource.forEach(k => {
      if (!isNaN(Number(k))) return;
      const description = options?.meanings?.[k];
      attributes[k] = omitUndefined({ description });
    });
  } else {
    if (base) {
      if (Array.isArray(base))
        throw new TypeError(
          'Both "target" and "base" arguments should be enum object',
        );
      out = { ...base, ...enumSource };
    }
    Object.keys(enumSource).forEach(k => {
      if (!isNaN(Number(k))) return;
      const description = options?.meanings?.[k];
      attributes[enumSource[k]] = omitUndefined({ alias: k, description });
    });
  }
  const metadata: EnumType.Metadata = {
    kind: OpraSchema.EnumType.Kind,
    attributes,
    base: options?.base,
    name: options?.name,
    description: options?.description,
  };
  Object.defineProperty(out, DATATYPE_METADATA, {
    value: metadata,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return out;
}

EnumType.prototype = EnumTypeClass.prototype;
EnumType[DECORATOR] = EnumTypeFactory;
