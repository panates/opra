import 'reflect-metadata';
import { omitUndefined } from '@jsopen/objects';
import type { Combine, Type } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { isAny, type Validator } from 'valgen';
import { cloneObject } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import type { DocumentElement } from '../common/document-element.js';
import { DocumentInitContext } from '../common/document-init-context.js';
import { applyTranslations } from '../common/translate-doc.js';
import { DECORATOR } from '../constants.js';
import {
  AttributeDecoratorFactory,
  SimpleTypeDecoratorFactory,
} from '../decorators/simple-type.decorator.js';
import { DataType } from './data-type.js';

/**
 * @namespace SimpleType
 */
export namespace SimpleType {
  export interface Metadata extends Combine<
    {
      kind: OpraSchema.SimpleType.Kind;
    },
    DataType.Metadata,
    OpraSchema.SimpleType
  > {}

  export interface Options extends Combine<
    Pick<OpraSchema.SimpleType, 'nameMappings'>,
    DataType.Options
  > {}

  export interface InitArguments extends Combine<
    {
      kind: OpraSchema.SimpleType.Kind;
      base?: SimpleType;
      ctor?: Type;
      properties?: object;
      designType?: boolean;
      generateDecoder?: SimpleType.ValidatorGenerator;
      generateEncoder?: SimpleType.ValidatorGenerator;
    },
    DataType.InitArguments,
    SimpleType.Metadata
  > {}

  export interface Attribute extends OpraSchema.Attribute {}

  export type ValidatorGenerator = (
    properties: Record<string, any>,
    args: {
      dataType: SimpleType;
      element: DocumentElement;
      scope?: string;
    },
  ) => Validator;
}

/**
 * Type definition for MixinType
 * @class SimpleType
 */
export interface SimpleTypeStatic extends SimpleTypeDecoratorFactory {
  /**
   * Class constructor of SimpleType
   *
   * @param owner
   * @param initArgs
   * @param context
   * @constructor
   */
  new (
    owner: DocumentElement,
    initArgs: SimpleType.InitArguments,
    context?: DocumentInitContext,
  ): SimpleType;

  prototype: SimpleType;

  Attribute: AttributeDecoratorFactory;
}

/**
 * Type definition of SimpleType prototype
 * @interface SimpleType
 */
export interface SimpleType extends SimpleTypeClass {}

/**
 * SimpleType constructor
 */
export const SimpleType = function (this: SimpleType | void, ...args: any[]) {
  // Decorator
  if (!this) return SimpleType[DECORATOR](...args);
  // Constructor
  const [owner, initArgs, context] = args as [
    DocumentElement,
    SimpleType.InitArguments,
    DocumentInitContext | undefined,
  ];
  DataType.call(this, owner, initArgs, context);
  const _this = asMutable(this);
  _this.kind = OpraSchema.SimpleType.Kind;
  if (initArgs.base) {
    // noinspection SuspiciousTypeOfGuard
    if (!(initArgs.base instanceof SimpleType)) {
      throw new TypeError(
        `"${(initArgs.base as DataType).kind}" can't be set as base for a "${this.kind}"`,
      );
    }
    _this.base = initArgs.base;
  }

  _this.properties = initArgs.properties;
  _this.ownNameMappings = { ...initArgs.nameMappings };
  _this.nameMappings = {
    ..._this.base?.nameMappings,
    ...initArgs.nameMappings,
  };
  _this.ownAttributes = cloneObject(initArgs.attributes || {});
  _this.attributes = _this.base ? cloneObject(_this.base.attributes) : {};
  if (_this.ownAttributes) {
    for (const [k, el] of Object.entries(_this.ownAttributes)) {
      if (_this.attributes[k]?.sealed)
        throw new TypeError(`Sealed attribute "${k}" can not be overwritten`);
      _this.attributes[k] = el;
    }
  }
  (_this as any)._generateDecoder = initArgs.generateDecoder;
  (_this as any)._generateEncoder = initArgs.generateEncoder;
} as SimpleTypeStatic;

/**
 *
 * @class SimpleType
 */
abstract class SimpleTypeClass extends DataType {
  declare readonly kind: OpraSchema.SimpleType.Kind;
  declare readonly base?: SimpleType;
  declare readonly attributes: Record<string, SimpleType.Attribute>;
  declare readonly nameMappings: Record<string, string>;
  declare readonly ownAttributes: Record<string, SimpleType.Attribute>;
  declare readonly ownNameMappings: Record<string, string>;
  protected _generateDecoder?: SimpleType.ValidatorGenerator;
  protected _generateEncoder?: SimpleType.ValidatorGenerator;
  properties?: any;

  extend<T>(properties: Partial<T>): SimpleType & T {
    Object.setPrototypeOf(properties, this);
    return properties as any;
  }

  extendsFrom(baseType: DataType | string | Type | object): boolean {
    if (!(baseType instanceof DataType))
      baseType = this.node.getDataType(baseType);
    if (!(baseType instanceof SimpleType)) return false;
    if (baseType === this) return true;
    return !!this.base?.extendsFrom(baseType);
  }

  generateCodec<T extends Record<string, any> | object = object>(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions | null,
    properties?: Partial<T>,
  ): Validator {
    const prop = {
      ...this.properties,
      ...properties,
    };
    if (codec === 'decode') {
      let t: SimpleType | undefined = this;
      while (t) {
        if (t._generateDecoder)
          return t._generateDecoder(prop, {
            dataType: this,
            element: options?.documentElement || this.owner,
            scope: options?.scope,
          });
        t = this.base;
      }
      return isAny;
    }
    let t: SimpleType | undefined = this;
    while (t) {
      if (t._generateEncoder)
        return t._generateEncoder(prop, {
          dataType: this,
          element: options?.documentElement || this.owner,
          scope: options?.scope,
        });
      t = this.base;
    }
    return isAny;
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.SimpleType {
    const superJson = super.toJSON(options);
    const baseName = this.base
      ? this.node.getDataTypeNameWithNs(this.base)
      : undefined;
    const attributes = omitUndefined<any>(this.ownAttributes);
    // An attribute's own `description` is prose like any other — keyed
    // under this type, one level down (`attributes.<name>.description`).
    for (const [key, attr] of Object.entries<any>(attributes)) {
      if (attr && typeof attr === 'object') {
        applyTranslations(
          this,
          attr,
          options,
          ['description'],
          ['attributes', key],
        );
      }
    }
    let properties: any;
    if (this.properties && typeof this.properties.toJSON === 'function') {
      properties = this.properties.toJSON(this.properties, this.owner, options);
    } else properties = this.properties ? cloneObject(this.properties) : {};
    const out: OpraSchema.SimpleType = {
      ...superJson,
      kind: this.kind,
      base: baseName,
      attributes:
        attributes && Object.keys(attributes).length ? attributes : undefined,
      properties: Object.keys(properties).length ? properties : undefined,
    };
    if (Object.keys(this.ownNameMappings).length)
      out.nameMappings = { ...this.ownNameMappings };
    return omitUndefined(out, true);
  }

  protected _locateBase(
    callback: (base: SimpleType) => boolean,
  ): SimpleType | undefined {
    if (!this.base) return;
    if (callback(this.base)) return this.base;
    if ((this.base as any)._locateBase)
      return (this.base as any)._locateBase(callback);
  }
}

SimpleType.prototype = SimpleTypeClass.prototype;
Object.assign(SimpleType, SimpleTypeDecoratorFactory);
SimpleType[DECORATOR] = SimpleTypeDecoratorFactory;
SimpleType.Attribute = AttributeDecoratorFactory;
