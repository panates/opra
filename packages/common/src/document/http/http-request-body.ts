import { omitUndefined } from '@jsopen/objects';
import type { StrictOmit } from 'ts-gems';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DocumentElement } from '../common/document-element.js';
import { HttpMediaType } from './http-media-type.js';
import type { HttpOperation } from './http-operation.js';

/**
 * @namespace HttpRequestBody
 */
export namespace HttpRequestBody {
  export interface Metadata extends Partial<
    StrictOmit<OpraSchema.HttpRequestBody, 'content'>
  > {
    content: HttpMediaType.Metadata[];
    immediateFetch?: boolean;
    allowPatchOperators?: boolean;
    allowNullOptionals?: boolean;
    keepKeyFields?: boolean;
  }

  export interface Options extends Partial<
    StrictOmit<OpraSchema.HttpRequestBody, 'content'>
  > {
    immediateFetch?: boolean;
    allowPatchOperators?: boolean;
    allowNullOptionals?: boolean;
    keepKeyFields?: boolean;
  }
}

/**
 * @class HttpRequestBody
 */
export class HttpRequestBody extends DocumentElement {
  declare readonly owner: HttpOperation;
  description?: string;
  content: HttpMediaType[] = [];
  required?: boolean;
  maxContentSize?: number;
  immediateFetch?: boolean;
  partial?: boolean | 'deep';
  allowPatchOperators?: boolean;
  keepKeyFields?: boolean;
  allowNullOptionals?: boolean;

  constructor(owner: HttpOperation) {
    super(owner);
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.HttpRequestBody {
    return omitUndefined<OpraSchema.HttpRequestBody>({
      description: this.description,
      required: this.required,
      maxContentSize: this.maxContentSize,
      content: this.content.length
        ? this.content.map(x => x.toJSON(options))
        : [],
      partial: this.partial,
      allowPatchOperators: this.allowPatchOperators,
      allowNullOptionals: this.allowNullOptionals,
    });
  }
}
