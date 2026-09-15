import typeIs from '@browsery/type-is';
import { omitUndefined } from '@jsopen/objects';
import type { Combine, StrictOmit, Type } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { isAny, type Validator, vg } from 'valgen';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DocumentElement } from '../common/document-element.js';
import { applyTranslations } from '../common/translate-doc.js';
import { ArrayType } from '../data-type/array-type.js';
import { DataType } from '../data-type/data-type.js';
import type { HttpMultipartField } from './http-multipart-field.js';

/**
 * Type definition for HttpMediaType
 * @class HttpMediaType
 */
interface HttpMediaTypeStatic {
  new (
    parent: DocumentElement,
    initArgs: HttpMediaType.InitArguments,
  ): HttpMediaType;

  prototype: HttpMediaType;
}

/**
 * Type definition of HttpMediaType prototype
 * @interface HttpMediaType
 */
export interface HttpMediaType extends HttpMediaTypeClass {}

export const HttpMediaType = function (
  this: HttpMediaType,
  owner: DocumentElement,
  initArgs: HttpMediaType.InitArguments,
) {
  if (!this)
    throw new TypeError('"this" should be passed to call class constructor');
  DocumentElement.call(this, owner);

  const _this = asMutable(this);
  if (initArgs.contentType) {
    let arr = Array.isArray(initArgs.contentType)
      ? initArgs.contentType
      : [initArgs.contentType];
    arr = arr.map(x => x.split(/\s*,\s*/)).flat();
    _this.contentType = arr.length > 1 ? arr : arr[0];
  }
  _this.description = initArgs.description;
  _this.docKey = initArgs.docKey;
  _this.contentEncoding = initArgs.contentEncoding;
  _this.example = initArgs.example;
  _this.examples = initArgs.examples;
  _this.multipartFields = [];
  _this.maxParts = initArgs.maxParts;
  _this.maxPartSize = initArgs.maxPartSize;
  _this.maxFieldSize = initArgs.maxFieldSize;
  _this.maxTotalSize = initArgs.maxTotalSize;
  if (initArgs?.type) {
    _this.type =
      initArgs?.type instanceof DataType
        ? initArgs.type
        : _this.owner.node.getDataType(initArgs.type);
  }
  _this.isArray = initArgs.isArray;
  _this.designType = initArgs.designType;
} as Function as HttpMediaTypeStatic;

/**
 * @class HttpMediaType
 */
class HttpMediaTypeClass extends DocumentElement {
  declare readonly owner: DocumentElement;
  declare description?: string;

  /** A media type inside a request body's `content` array has no identity
   *  of its own beyond `contentType`, which is optional — so when the body
   *  declares just one content (by far the common case) this adds no level
   *  at all and its texts sit directly under the body's own key. */
  override get docKeyUnstable(): boolean {
    const content = (this.owner as any)?.content;
    if (Array.isArray(content) && content.length === 1) return false;
    return !this.docKey && !this.contentType;
  }

  protected get docKeySegment(): string | string[] | undefined {
    const content = (this.owner as any)?.content;
    if (Array.isArray(content) && content.length === 1) return undefined;
    const contentType = Array.isArray(this.contentType)
      ? this.contentType[0]
      : this.contentType;
    return ['content', this.docKey || contentType || '0'];
  }

  declare contentType?: string | string[];
  declare contentEncoding?: string;
  declare type?: DataType;
  declare isArray?: boolean;
  declare example?: string;
  declare examples?: Record<string, string>;
  declare multipartFields: HttpMultipartField[];
  declare maxParts?: number;
  declare maxPartSize?: number;
  declare maxFieldSize?: number;
  declare maxTotalSize?: number;
  declare designType?: Type;

  findMultipartField(
    fieldName: string,
    fieldType?: OpraSchema.HttpMultipartFieldType,
  ): HttpMultipartField | undefined {
    if (!this.multipartFields) return;
    for (const f of this.multipartFields) {
      if (
        (!fieldType || fieldType === f.fieldType) &&
        ((f.fieldName instanceof RegExp && f.fieldName.test(fieldName)) ||
          f.fieldName === fieldName)
      ) {
        return f;
      }
    }
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.HttpMediaType {
    const typeName = this.type
      ? this.node.getDataTypeNameWithNs(this.type)
      : undefined;
    const out = applyTranslations(
      this,
      omitUndefined<OpraSchema.HttpMediaType>({
        description: this.description,
        contentType: this.contentType,
        contentEncoding: this.contentEncoding,
        type: typeName ? typeName : this.type?.toJSON(options),
        isArray: this.isArray,
        example: this.example,
        examples: this.examples,
        maxParts: this.maxParts,
        maxPartSize: this.maxPartSize,
        maxFieldSize: this.maxFieldSize,
        maxTotalSize: this.maxTotalSize,
      }),
      options,
      ['description'],
    );
    if (this.multipartFields?.length) {
      out.multipartFields = this.multipartFields.map(x => x.toJSON(options));
    }
    return out;
  }

  generateCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
    properties?: object,
  ): Validator {
    let fn: Validator | undefined;
    if (this.type) {
      fn = this.type.generateCodec(codec, options, {
        designType: this.designType,
      });
    } else if (this.contentType) {
      const arr = Array.isArray(this.contentType)
        ? this.contentType
        : [this.contentType];
      if (arr.find(ct => typeIs.is(ct, ['json']))) {
        fn = this.node.findDataType('object')!.generateCodec(codec, options, {
          ...properties,
          designType: this.designType,
        });
      }
    }
    fn = fn || isAny;
    return this.isArray && !(this.type instanceof ArrayType)
      ? vg.isArray(fn)
      : fn;
  }
}

HttpMediaType.prototype = HttpMediaTypeClass.prototype;

/**
 * @namespace HttpMediaType
 */
export namespace HttpMediaType {
  export interface Metadata extends Partial<
    StrictOmit<OpraSchema.HttpMediaType, 'type' | 'multipartFields'>
  > {
    type?: Type | string;
    multipartFields?: HttpMultipartField.Metadata[];
    designType?: Type;
    /** Authoring-only; never exported. See `DocumentElement#docKey`. */
    docKey?: string;
  }

  export interface Options extends Partial<
    StrictOmit<OpraSchema.HttpMediaType, 'type' | 'multipartFields'>
  > {
    type?: Type | string;
    /** Authoring-only; never exported. See `DocumentElement#docKey`. */
    docKey?: string;
  }

  export interface InitArguments extends Combine<
    {
      type?: DataType | string | Type;
    },
    StrictOmit<Metadata, 'multipartFields'>
  > {}
}
