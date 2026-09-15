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
import { applyTranslations } from '../common/translate-doc.js';
import { Value } from '../common/value.js';
import { DataType } from '../data-type/data-type.js';
import type { EnumType } from '../data-type/enum-type.js';
import { parseRegExp } from '../utils/parse-regexp.util.js';

/**
 * @namespace MQHeader
 */
export namespace MQHeader {
  export interface Metadata extends StrictOmit<OpraSchema.MQHeader, 'type'> {
    name: string | RegExp;
    type?:
      | string
      | TypeThunkAsync
      | EnumType.EnumObject
      | EnumType.EnumArray
      | object;
    designType?: Type;
  }

  export interface Options extends Partial<StrictOmit<Metadata, 'type'>> {
    type?: string | TypeThunkAsync | object;
  }

  export interface InitArguments extends Combine<
    {
      type?: DataType;
    },
    Metadata
  > {}
}

/**
 * Type definition for MQHeader
 * @class MQHeader
 */
interface MQHeaderStatic {
  new (owner: DocumentElement, args: MQHeader.InitArguments): MQHeader;

  prototype: MQHeader;
}

/**
 * Type definition of MQHeader prototype
 * @interface MQHeader
 */
export interface MQHeader extends MQHeaderClass {}

export const MQHeader = function (
  this: MQHeader,
  owner: DocumentElement,
  initArgs: MQHeader.InitArguments,
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
  _this.deprecated = initArgs.deprecated;
  _this.required = initArgs.required;
  _this.designType = initArgs.designType;
} as Function as MQHeaderStatic;

/**
 * @class MQHeader
 */
class MQHeaderClass extends Value {
  declare readonly owner: DocumentElement;

  override get docKeyUnstable(): boolean {
    return !this.docKey && this.name instanceof RegExp;
  }

  protected get docKeySegment(): string[] {
    return [
      'headers',
      this.docKey ||
        (typeof this.name === 'string' ? this.name : this.name.source),
    ];
  }

  declare deprecated?: boolean | string;
  declare required?: boolean;
  declare designType?: Type;

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.MQHeader {
    return applyTranslations(
      this,
      omitUndefined<OpraSchema.MQHeader>({
        ...super.toJSON(options),
        name: this.name,
        required: this.required,
        deprecated: this.deprecated,
      }),
      options,
      ['description', 'deprecated'],
    );
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
}

MQHeader.prototype = MQHeaderClass.prototype;
