import nodePath from 'node:path';
import { omitUndefined } from '@jsopen/objects';
import type { Combine, StrictOmit, ThunkAsync, Type } from 'ts-gems';
import { asMutable } from 'ts-gems';
import { cloneObject } from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { ApiDocument } from '../api-document.js';
import { DataTypeMap } from '../common/data-type-map.js';
import { DocumentElement } from '../common/document-element.js';
import { CLASS_NAME_PATTERN, DECORATOR, kDataTypeMap } from '../constants.js';
import type { DataType } from '../data-type/data-type.js';
import type { EnumType } from '../data-type/enum-type.js';
import {
  type HttpOperationDecorator,
  HttpOperationDecoratorFactory,
} from '../decorators/http-operation.decorator.js';
import type { HttpController } from './http-controller.js';
import type { HttpOperationResponse } from './http-operation-response.js';
import type { HttpParameter } from './http-parameter.js';
import type { HttpRequestBody } from './http-request-body.js';

/**
 * @namespace HttpOperation
 */
export namespace HttpOperation {
  export interface Metadata extends Pick<
    OpraSchema.HttpOperation,
    | 'description'
    | 'method'
    | 'path'
    | 'mergePath'
    | 'composition'
    | 'compositionOptions'
  > {
    types?: ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray>[];
    parameters?: HttpParameter.Metadata[];
    responses?: HttpOperationResponse.Metadata[];
    requestBody?: HttpRequestBody.Metadata;
    immediateFetch?: boolean;
    allowPatchOperators?: boolean;
    allowNullOptionals?: boolean;
  }

  export interface Options extends Partial<
    Pick<
      Metadata,
      | 'path'
      | 'mergePath'
      | 'description'
      | 'method'
      | 'immediateFetch'
      | 'allowPatchOperators'
      | 'allowNullOptionals'
    >
  > {
    requestBody?: HttpRequestBody.Options;
  }

  export interface InitArguments extends Combine<
    {
      name: string;
      types?: DataType[];
    },
    Pick<
      Metadata,
      | 'description'
      | 'method'
      | 'path'
      | 'mergePath'
      | 'composition'
      | 'compositionOptions'
      | 'immediateFetch'
      | 'allowPatchOperators'
      | 'allowNullOptionals'
    >
  > {}
}

/**
 * Type definition for HttpOperation
 * @class HttpOperation
 */
export interface HttpOperationStatic {
  /**
   * Class constructor of HttpOperation
   * @param controller
   * @param args
   */
  new (
    controller: HttpController,
    args: HttpOperation.InitArguments,
  ): HttpOperation;

  /**
   * Property decorator
   * @param options
   */ <T extends HttpOperation.Options>(options?: T): HttpOperationDecorator;

  prototype: HttpOperation;

  GET(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  DELETE(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  HEAD(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  OPTIONS(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  PATCH(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  POST(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  PUT(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;

  SEARCH(
    options?: StrictOmit<HttpOperation.Options, 'method'>,
  ): HttpOperationDecorator;
}

/**
 * @class HttpOperation
 */
export interface HttpOperation extends HttpOperationClass {}

/**
 *  HttpOperation
 */
export const HttpOperation = function (this: HttpOperation, ...args: any[]) {
  // Decorator
  if (!this) {
    const [options] = args as [options: HttpOperation.Options];
    const decoratorChain: Function[] = [];
    return (HttpOperation[DECORATOR] as HttpOperationDecoratorFactory).call(
      undefined,
      decoratorChain,
      options,
    );
  }

  // Constructor
  const [resource, initArgs] = args as [
    HttpController,
    HttpOperation.InitArguments,
  ];
  DocumentElement.call(this, resource);
  if (!CLASS_NAME_PATTERN.test(initArgs.name))
    throw new TypeError(`Invalid operation name (${initArgs.name})`);
  const _this = asMutable(this);
  _this.parameters = [];
  _this.responses = [];
  _this.types = _this.node[kDataTypeMap] = new DataTypeMap();
  _this.name = initArgs.name;
  _this.path = initArgs.path;
  _this.mergePath = initArgs.mergePath;
  _this.method = initArgs.method || 'GET';
  _this.description = initArgs.description;
  _this.composition = initArgs.composition;
  _this.compositionOptions = initArgs.compositionOptions
    ? cloneObject(initArgs.compositionOptions)
    : undefined;
} as HttpOperationStatic;

/**
 * @class HttpOperation
 */
class HttpOperationClass extends DocumentElement {
  declare readonly owner: HttpController;
  declare readonly name: string;
  declare method: OpraSchema.HttpMethod;
  declare description?: string;
  declare path?: string;
  declare mergePath?: boolean;
  declare types: DataTypeMap;
  declare parameters: HttpParameter[];
  declare responses: HttpOperationResponse[];
  declare requestBody?: HttpRequestBody;
  declare composition?: string;
  declare compositionOptions?: Record<string, any>;

  findParameter(
    paramName: string,
    location?: OpraSchema.HttpParameterLocation,
  ): HttpParameter | undefined {
    const paramNameLower = paramName.toLowerCase();
    let prm: any;
    for (prm of this.parameters) {
      if (location && location !== prm.location) continue;
      if (typeof prm.name === 'string') {
        prm._nameLower = prm._nameLower || prm.name.toLowerCase();
        if (prm._nameLower === paramNameLower) return prm;
      }
      if (prm.name instanceof RegExp && prm.name.test(paramName)) return prm;
    }
  }

  getFullUrl(): string {
    const out = this.owner.getFullUrl();
    if (out) {
      if (this.path) {
        if (this.mergePath) return out + this.path;
        return nodePath.posix.join(out, this.path);
      }
      return out;
    }
    return this.path || '/';
  }

  toJSON(options?: ApiDocument.ExportOptions): OpraSchema.HttpOperation {
    const out = omitUndefined<OpraSchema.HttpOperation>({
      kind: OpraSchema.HttpOperation.Kind,
      description: this.description,
      method: this.method,
      path: this.path,
      mergePath: this.mergePath,
      composition: this.composition,
      requestBody: this.requestBody?.toJSON(options),
    });
    if (this.types.size) {
      out.types = {};
      for (const v of this.types.values()) {
        out.types[v.name!] = v.toJSON(options);
      }
    }
    if (this.parameters.length) {
      out.parameters = [];
      for (const prm of this.parameters) {
        out.parameters.push(prm.toJSON(options));
      }
    }
    if (this.responses.length)
      out.responses = this.responses.map(r => r.toJSON(options));
    return out;
  }
}

HttpOperation.prototype = HttpOperationClass.prototype;
HttpOperation[DECORATOR] = HttpOperationDecoratorFactory;

HttpOperation.GET = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'GET' });
};

HttpOperation.DELETE = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'DELETE' });
};

HttpOperation.HEAD = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'HEAD' });
};

HttpOperation.OPTIONS = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'OPTIONS' });
};

HttpOperation.PATCH = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'PATCH' });
};

HttpOperation.POST = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'POST' });
};

HttpOperation.PUT = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'PUT' });
};

HttpOperation.SEARCH = function (
  options?: StrictOmit<HttpOperation.Options, 'method'>,
): HttpOperationDecorator {
  return HttpOperationDecoratorFactory([], { ...options, method: 'SEARCH' });
};
