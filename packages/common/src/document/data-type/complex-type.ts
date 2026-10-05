import 'reflect-metadata';
import { omitUndefined } from '@jsopen/objects';
import type { Combine, Type, TypeThunkAsync } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import type { DocumentElement } from '../common/document-element.js';
import { DocumentInitContext } from '../common/document-init-context.js';
import { DECORATOR } from '../constants.js';
import { ComplexTypeDecorator } from '../decorators/complex-type.decorator.js';
import { ApiField } from './api-field.js';
import { ComplexTypeBase } from './complex-type-base.js';
import { DataType } from './data-type.js';
import type { MappedType } from './mapped-type.js';
import type { MixinType } from './mixin-type.js';

/**
 * @namespace ComplexType
 */
export namespace ComplexType {
  export interface Metadata extends Combine<
    {
      kind: OpraSchema.ComplexType.Kind;
      fields?: Record<string, ApiField.Metadata>;
      additionalFields?:
        boolean | string | TypeThunkAsync | ['error'] | ['error', string];
    },
    DataType.Metadata,
    OpraSchema.ComplexType
  > {}

  export interface Options extends Combine<
    Pick<
      Metadata,
      | 'additionalFields'
      | 'keyField'
      | 'discriminatorField'
      | 'discriminatorValue'
    >,
    DataType.Options,
    Pick<OpraSchema.ComplexType, 'abstract'>
  > {}

  export interface InitArguments extends Combine<
    {
      kind: OpraSchema.ComplexType.Kind;
      base?: ComplexType | MappedType | MixinType;
      fields?: Record<string, ApiField.InitArguments | ApiField>;
      additionalFields?: boolean | DataType | ['error'] | ['error', string];
    },
    DataType.InitArguments,
    ComplexType.Metadata
  > {}

  export interface ParsedFieldPath {
    fieldName: string;
    dataType: DataType;
    field?: ApiField;
    additionalField?: boolean;
    sign?: '+' | '-';
  }
}

/**
 * Type definition for MixinType
 * @class ComplexType
 */
export interface ComplexTypeStatic {
  /**
   * Class constructor of ComplexType
   *
   * @param owner
   * @param args
   * @param context
   * @constructor
   */
  new (
    owner: DocumentElement,
    args?: ComplexType.InitArguments,
    context?: DocumentInitContext,
  ): ComplexType;

  (options?: ComplexType.Options): ClassDecorator;

  prototype: ComplexType;

  extend<T extends Type>(
    typeClass: T,
    fields: Record<string, ApiField.Options>,
  ): T;
}

/**
 * Type definition of ComplexType prototype
 * @interface ComplexType
 */
export interface ComplexType extends ComplexTypeClass {}

/**
 * ComplexType constructor
 */
export const ComplexType = function (this: ComplexType | void, ...args: any[]) {
  // Decorator
  if (!this) return ComplexType[DECORATOR].apply(undefined, args);
  // Constructor
  const [owner, initArgs] = args as [
    DocumentElement,
    ComplexType.InitArguments,
  ];
  const context: DocumentInitContext =
    args[2] || new DocumentInitContext({ maxErrors: 0 });
  ComplexTypeBase.call(this, owner, initArgs, context);
  const _this = asMutable(this);
  _this.kind = OpraSchema.ComplexType.Kind;
  _this.discriminatorField = initArgs.discriminatorField;
  _this.discriminatorValue = initArgs.discriminatorValue;
  if (initArgs.base) {
    context.enter('.base', () => {
      // noinspection SuspiciousTypeOfGuard
      if (!(initArgs.base instanceof ComplexTypeBase)) {
        throw new TypeError(
          `"${(initArgs.base! as DataType).kind}" can't be set as base for a "${this.kind}"`,
        );
      }
      _this.base = initArgs.base;
      _this.additionalFields = _this.base.additionalFields;
      _this.keyField = _this.base.keyField;

      /* Copy fields from base */
      for (const v of _this.base.fields('*')) {
        (_this as any)._fields.set(v.name, new ApiField(this, v));
      }
    });
  }
  if (initArgs.additionalFields !== undefined)
    _this.additionalFields = initArgs.additionalFields;
  if (initArgs.keyField !== undefined) _this.keyField = initArgs.keyField;
  _this.ctor = initArgs.ctor || _this.base?.ctor;

  /* Add own fields */
  if (initArgs.fields) {
    context.enter('.fields', () => {
      for (const [k, v] of Object.entries(initArgs.fields!)) {
        const field = new ApiField(this, {
          ...v,
          name: k,
        });
        (this as any)._fields.set(field.name, field);
      }
    });
  }
} as Function as ComplexTypeStatic;

/**
 *
 * @class ComplexType
 */
abstract class ComplexTypeClass extends ComplexTypeBase {
  declare readonly kind: OpraSchema.ComplexType.Kind;
  readonly base?: ComplexType | MappedType | MixinType;
  declare readonly ctor?: Type;
  declare discriminatorField?: string;
  declare discriminatorValue?: string;

  extendsFrom(baseType: DataType | string | Type | object): boolean {
    if (!(baseType instanceof DataType))
      baseType = this.node.getDataType(baseType);
    if (!(baseType instanceof ComplexTypeBase)) return false;
    if (baseType === this) return true;
    return !!this.base?.extendsFrom(baseType);
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.ComplexType {
    const superJson = super.toJSON(options);
    const baseName = this.base
      ? this.node.getDataTypeNameWithNs(this.base)
      : undefined;
    const out: OpraSchema.ComplexType = {
      ...superJson,
      kind: this.kind,
      base: this.base
        ? baseName
          ? baseName
          : this.base.toJSON(options)
        : undefined,
      discriminatorField: this.discriminatorField,
      discriminatorValue: this.discriminatorValue,
    };
    if (this.additionalFields) {
      if (this.additionalFields instanceof DataType) {
        const typeName = this.node.getDataTypeNameWithNs(this.additionalFields);
        out.additionalFields = typeName
          ? typeName
          : (this.additionalFields.toJSON(options) as OpraSchema.DataType);
      } else out.additionalFields = this.additionalFields;
    }
    if (this._fields?.size) {
      const fields = {};
      let i = 0;
      for (const field of this._fields.values()) {
        if (field.origin === this && field.inScope(options?.scope)) {
          // `forScope()` applies any `.Override(scopePattern, ...)` for
          // this scope (e.g. `readonly: false` in "db") before
          // serializing — a plain `field.toJSON()` would always emit the
          // field's base (un-overridden) values, regardless of scope.
          fields[field.name] = field.forScope(options?.scope).toJSON(options);
          i++;
        }
      }
      if (i) out.fields = fields;
    }
    return omitUndefined(out);
  }

  protected _locateBase(
    callback: (base: ComplexTypeBase) => boolean,
  ): ComplexTypeBase | undefined {
    if (!this.base) return;
    if (callback(this.base)) return this.base;
    if ((this.base as any)._locateBase)
      return (this.base as any)._locateBase(callback);
  }
}

ComplexType.prototype = ComplexTypeClass.prototype;
Object.assign(ComplexType, ComplexTypeDecorator);
ComplexType[DECORATOR] = ComplexTypeDecorator;
