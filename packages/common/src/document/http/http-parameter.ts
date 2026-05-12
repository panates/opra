import { omitUndefined } from '@jsopen/objects';
import {
  asMutable,
  type Combine,
  type StrictOmit,
  type Type,
  type TypeThunkAsync,
} from 'ts-gems';
import { type Validator, vg } from 'valgen';
import type { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DocumentElement } from '../common/document-element.js';
import { Value } from '../common/value.js';
import { DataType } from '../data-type/data-type.js';
import type { EnumType } from '../data-type/enum-type.js';
import { parseRegExp } from '../utils/parse-regexp.util.js';

/**
 * @namespace HttpParameter
 */
export namespace HttpParameter {
  export interface Metadata extends StrictOmit<
    OpraSchema.HttpParameter,
    'type'
  > {
    name: string | RegExp;
    type?:
      | string
      | TypeThunkAsync
      | EnumType.EnumObject
      | EnumType.EnumArray
      | object;
    keyParam?: boolean;
    designType?: Type;
  }

  export interface Options extends Partial<StrictOmit<Metadata, 'type'>> {
    type?: string | TypeThunkAsync | object;
    parser?: (v: any) => any;
  }

  export interface InitArguments extends Combine<
    {
      type?: DataType;
    },
    Metadata
  > {
    parser?: (v: any) => any;
  }
}

/**
 * Type definition for HttpParameter
 * @class HttpParameter
 */
interface HttpParameterStatic {
  new (
    owner: DocumentElement,
    args: HttpParameter.InitArguments,
  ): HttpParameter;

  prototype: HttpParameter;
}

/**
 * Type definition of HttpParameter prototype
 * @interface HttpParameter
 */
export interface HttpParameter extends HttpParameterClass {}

export const HttpParameter = function (
  this: HttpParameter,
  owner: DocumentElement,
  initArgs: HttpParameter.InitArguments,
) {
  if (!this)
    throw new TypeError('"this" should be passed to call class constructor');
  Value.call(this, owner, initArgs);
  const _this = asMutable(this);
  if (initArgs.name) {
    _this.name =
      initArgs.name instanceof RegExp
        ? initArgs.name
        : initArgs.name.startsWith('/')
          ? parseRegExp(initArgs.name, {
              includeFlags: 'i',
              excludeFlags: 'm',
            })
          : initArgs.name;
  }
  _this.location = initArgs.location;
  _this.deprecated = initArgs.deprecated;
  _this.required = initArgs.required;
  if (_this.required == null && initArgs.location === 'path')
    _this.required = true;
  _this.default = initArgs.default;
  _this.arraySeparator = initArgs.arraySeparator;
  _this.keyParam = initArgs.keyParam;
  _this.parser = initArgs.parser;
  _this.designType = initArgs.designType;
} as Function as HttpParameterStatic;

/**
 * @class HttpParameter
 */
class HttpParameterClass extends Value {
  declare readonly owner: DocumentElement;
  declare location: OpraSchema.HttpParameterLocation;
  declare keyParam?: boolean;
  declare deprecated?: boolean | string;
  declare required?: boolean;
  declare readonly default?: any;
  declare arraySeparator?: string;
  declare parser?: (v: any) => any;
  declare designType?: Type;

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.HttpParameter {
    return omitUndefined<OpraSchema.HttpParameter>({
      ...super.toJSON(options),
      name: this.name,
      location: this.location,
      arraySeparator: this.arraySeparator,
      keyParam: this.keyParam,
      required: this.required,
      default: this.default,
      deprecated: this.deprecated,
    });
  }

  generateCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
    properties?: any,
  ): Validator {
    const fn =
      this.type?.generateCodec(codec, options, {
        ...properties,
        designType: this.designType,
      }) || vg.isAny();
    if (this.default !== undefined) {
      return vg.optional(fn, this.default);
    }
    return fn;
  }
}

HttpParameter.prototype = HttpParameterClass.prototype;
