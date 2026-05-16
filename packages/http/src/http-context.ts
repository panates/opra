import typeIs from '@browsery/type-is';
import {
  BadRequestError,
  HttpController,
  HttpMediaType,
  HttpOperation,
  InternalServerError,
  MimeTypes,
  NotAcceptableError,
} from '@opra/common';
import { ExecutionContext, kAssetCache } from '@opra/core';
import toml from 'toml';
import { type Validator } from 'valgen';
import yaml from 'yaml';
import type { HttpAdapter } from './http-adapter.js';
import { MultipartReader } from './impl/multipart-reader.js';
import type { HttpIncoming } from './interfaces/http-incoming.interface.js';
import type { HttpOutgoing } from './interfaces/http-outgoing.interface.js';

export class HttpContext extends ExecutionContext {
  protected _body?: any;
  protected _multipartReader?: MultipartReader;
  declare readonly __contDef: HttpController;
  declare readonly __oprDef: HttpOperation;
  declare readonly __controller: any;
  declare readonly __handler?: Function;
  declare readonly __adapter: HttpAdapter;
  readonly request: HttpIncoming;
  readonly response: HttpOutgoing;
  readonly mediaType?: HttpMediaType;
  readonly cookies: Record<string, any>;
  readonly headers: Record<string, any>;
  readonly pathParams: Record<string, any>;
  readonly queryParams: Record<string, any>;
  errors: Error[] = [];

  constructor(init: HttpContext.Initiator) {
    super({
      ...init,
      __docNode:
        init.__oprDef?.node ||
        init.__contDef?.node ||
        init.__adapter.document.node,
      transport: 'http',
    });
    if (init.__controller) this.__controller = init.__controller;
    if (init.__contDef) this.__contDef = Object.create(init.__contDef);
    if (init.__oprDef) this.__oprDef = Object.create(init.__oprDef);
    if (init.__handler) this.__handler = init.__handler;
    this.request = init.request;
    this.response = init.response;
    this.mediaType = init.mediaType;
    this.cookies = init.cookies || {};
    this.headers = init.headers || {};
    this.pathParams = init.pathParams || {};
    this.queryParams = init.queryParams || {};
    this._body = init.body;
    this.on('finish', () => {
      if (this._multipartReader)
        this._multipartReader.purge().catch(() => undefined);
    });
  }

  /**
   * Checks if the request is a multipart request.
   */
  get isMultipart(): boolean {
    return !!this.request.is('multipart');
  }

  /**
   * Retrieves the multipart reader for the current context.
   *
   * @returns A promise that resolves to the multipart reader.
   * @throws {@link InternalServerError} If the request content is not multipart.
   * @throws {@link NotAcceptableError} If the endpoint does not accept multipart requests.
   */
  async getMultipartReader(): Promise<MultipartReader> {
    if (!this.isMultipart)
      throw new InternalServerError(
        'Request content is not a multipart content',
      );
    if (this._multipartReader) return this._multipartReader;
    const { mediaType } = this;
    if (mediaType?.contentType) {
      const arr = Array.isArray(mediaType.contentType)
        ? mediaType.contentType
        : [mediaType.contentType];
      const contentType = arr.find(ct => typeIs.is(ct, ['multipart']));
      if (!contentType)
        throw new NotAcceptableError(
          'This endpoint does not accept multipart requests',
        );
    }
    const reader = new MultipartReader(
      this,
      {
        limits: {
          fields: mediaType?.maxFields,
          fieldSize: mediaType?.maxFieldsSize,
          files: mediaType?.maxFiles,
          fileSize: mediaType?.maxFileSize,
        },
      },
      mediaType,
    );
    this._multipartReader = reader;
    return reader;
  }

  /**
   * Retrieves and parses the request body.
   *
   * @param args - Optional arguments for body retrieval.
   * @param args.toFile - Whether to save the body to a file.
   * @returns A promise that resolves to the parsed body.
   * @throws {@link BadRequestError} If the body cannot be parsed or validated.
   */
  async getBody<T>(args?: { toFile: boolean | string }): Promise<T> {
    if (this._body !== undefined) return this._body;
    try {
      const { request, __oprDef, mediaType } = this;

      if (this.isMultipart) {
        const reader = await this.getMultipartReader();
        /* Retrieve all fields */
        const parts = await reader.getAll();
        /* Filter fields according to configuration */
        this._body = [...parts];
        return this._body;
      }

      this._body = await this.request.readBody({
        limit: __oprDef?.requestBody?.maxContentSize,
        toFile: args?.toFile,
      });
      if (this._body != null) {
        const encoding = request.characterEncoding();
        if (encoding) this._body = this._body.toString(encoding);
        if (
          Buffer.isBuffer(this._body) &&
          request.is([
            'json',
            'xml',
            'txt',
            'text',
            'yaml',
            'toml',
            MimeTypes.yaml2,
            MimeTypes.toml2,
          ])
        ) {
          this._body = this._body.toString('utf-8');
        }

        // Transform text to Object if media is JSON
        if (typeof this._body === 'string' && request.is(['json']))
          this._body = JSON.parse(this._body);
        // Transform text to Object if media is YAML
        if (
          typeof this._body === 'string' &&
          request.is(['yaml', MimeTypes.yaml2])
        )
          this._body = yaml.parse(this._body);
        // Transform text to Object if media is YAML
        if (
          typeof this._body === 'string' &&
          request.is(['toml', MimeTypes.toml2])
        )
          this._body = toml.parse(this._body);
      }

      if (mediaType) {
        // Decode/Validate the data object according to data model
        if (this._body && mediaType.type) {
          let decode = this.__adapter[kAssetCache].get<Validator>(
            mediaType,
            'decode',
          )!;
          if (!decode) {
            decode = mediaType.generateCodec('decode', {
              scope: this.__adapter.scope,
              partial: __oprDef?.requestBody?.partial,
              projection: '*',
              ignoreReadonlyFields: true,
              allowPatchOperators: __oprDef?.requestBody?.allowPatchOperators,
              allowNullOptionals: __oprDef?.requestBody?.allowNullOptionals,
              keepKeyFields: __oprDef?.requestBody?.keepKeyFields,
            });
            this.__adapter[kAssetCache].set(mediaType, 'decode', decode);
          }
          this._body = decode(this._body);
        }
      }
      return this._body;
    } catch (error: any) {
      throw new BadRequestError(error);
    }
  }
}

export namespace HttpContext {
  export interface Initiator extends Omit<
    ExecutionContext.Initiator,
    '__adapter' | '__docNode' | 'transport'
  > {
    __adapter: HttpAdapter;
    __contDef?: HttpController;
    __oprDef?: HttpOperation;
    __controller?: any;
    __handler?: Function;
    request: HttpIncoming;
    response: HttpOutgoing;
    cookies?: Record<string, any>;
    headers?: Record<string, any>;
    pathParams?: Record<string, any>;
    queryParams?: Record<string, any>;
    mediaType?: HttpMediaType;
    body?: any;
  }
}
