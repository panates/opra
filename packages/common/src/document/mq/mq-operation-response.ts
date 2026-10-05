import { omitUndefined } from '@jsopen/objects';
import type { Combine, Type, TypeThunkAsync } from 'ts-gems';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DocumentElement } from '../common/document-element.js';
import { applyTranslations } from '../common/translate-doc.js';
import { DataType } from '../data-type/data-type.js';
import type { MQHeader } from './mq-header.js';
import type { MQOperation } from './mq-operation.js';

/**
 * @namespace MQOperationResponse
 */
export namespace MQOperationResponse {
  export interface Metadata extends Combine<
    {
      type?: TypeThunkAsync | string;
      keyType?: TypeThunkAsync | string;
      headers?: MQHeader.Metadata[];
    },
    OpraSchema.MQOperationResponse
  > {
    designType?: Type;
    keyDesignType?: Type;
  }

  export interface Options extends Combine<
    {
      keyType?: Type | string;
    },
    Pick<Metadata, 'channel' | 'description'>
  > {}

  export interface InitArguments extends Combine<
    {
      type?: DataType | string | Type;
      keyType?: DataType | string | Type;
    },
    Pick<Metadata, 'channel' | 'description' | 'designType' | 'keyDesignType'>
  > {}
}

/**
 * @class MQOperationResponse
 */
export class MQOperationResponse extends DocumentElement {
  protected get docKeySegment(): string {
    return 'response';
  }

  declare readonly owner: MQOperation;
  channel?: string | RegExp | (string | RegExp)[];
  description?: string;
  type: DataType;
  keyType?: DataType;
  headers: MQHeader[] = [];
  designType?: Type;
  keyDesignType?: Type;

  constructor(
    owner: MQOperation,
    initArgs?: MQOperationResponse.InitArguments,
  ) {
    super(owner);
    this.channel = initArgs?.channel;
    this.description = initArgs?.description;
    if (initArgs?.type) {
      this.type =
        initArgs?.type instanceof DataType
          ? initArgs.type
          : this.owner.node.getDataType(initArgs.type);
    } else this.type = this.owner.node.getDataType('any');
    if (initArgs?.keyType) {
      this.keyType =
        initArgs?.keyType instanceof DataType
          ? initArgs.keyType
          : this.owner.node.getDataType(initArgs.keyType);
    }
    this.designType = initArgs?.designType;
    this.keyDesignType = initArgs?.keyDesignType;
  }

  findHeader(paramName: string): MQHeader | undefined {
    const paramNameLower = paramName.toLowerCase();
    let prm: any;
    for (prm of this.headers) {
      if (typeof prm.name === 'string') {
        prm._nameLower = prm._nameLower || prm.name.toLowerCase();
        if (prm._nameLower === paramNameLower) return prm;
      }
      if (prm.name instanceof RegExp && prm.name.test(paramName)) return prm;
    }
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.MQOperationResponse {
    const out = applyTranslations(
      this,
      omitUndefined<OpraSchema.MQOperationResponse>({
        description: this.description,
        channel: this.channel,
        type: this.type.name ? this.type.name : this.type.toJSON(options),
        keyType: this.keyType
          ? this.keyType.name
            ? this.keyType.name
            : this.keyType.toJSON(options)
          : undefined,
      }),
      options,
      ['description'],
    );
    if (this.headers.length) {
      out.headers = [];
      for (const prm of this.headers) {
        out.headers.push(prm.toJSON(options));
      }
    }
    return out;
  }
}
