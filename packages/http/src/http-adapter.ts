import * as process from 'node:process';
import type { Readable } from 'node:stream';
import typeIs from '@browsery/type-is';
import type { ApiUiOptions } from '@opra/api-ui';
import {
  ArrayType,
  BadRequestError,
  HttpApi,
  HttpController,
  HttpHeaderCodes,
  HttpMediaType,
  HttpOperation,
  HttpOperationResponse,
  HttpParameter,
  HttpStatusCode,
  InternalServerError,
  isBlob,
  isReadable,
  isReadableStream,
  IssueSeverity,
  MethodNotAllowedError,
  MimeTypes,
  OperationResult,
  OpraException,
  OpraHttpError,
  OpraSchema,
  safeJsonStringify,
} from '@opra/common';
import { kAssetCache, PlatformAdapter } from '@opra/core';
import type { OpenApiDocumentFactory } from '@opra/openapi';
import { parse as parseContentType } from 'content-type';
import { splitString } from 'fast-tokenizer';
import http from 'http';
import MultipartStream from 'multipart-stream';
import type { EventMap } from 'node-events-async';
import { md5 } from 'super-fast-md5';
import { asMutable } from 'ts-gems';
import {
  type ErrorIssue,
  toArray,
  ValidationError,
  type Validator,
  vg,
} from 'valgen';
import { kBundle } from './constants.js';
import type { HttpBundle } from './http-bundle.js';
import { HttpContext } from './http-context.js';
import { IncomingMessageHost } from './impl/incoming-message-host.js';
import { MultipartReader } from './impl/multipart-reader.js';
import { ServerResponseHost } from './impl/server-response-host.js';
import { HttpRequest } from './interfaces/http-request.interface.js';
import { HttpResponse } from './interfaces/http-response.interface.js';
import { toReadable } from './utils/to-readeble.js';
import { wrapException } from './utils/wrap-exception.js';

/**
 * HttpAdapter is the base class for all HTTP platform adapters.
 * It provides core functionality for handling HTTP requests and managing interceptors.
 *
 * @abstract
 */
export abstract class HttpAdapter<
  T extends HttpAdapter.Events = HttpAdapter.Events,
> extends PlatformAdapter<EventMap<T>> {
  // readonly handler: HttpHandler;
  readonly transform: OpraSchema.Transport = 'http';
  readonly basePath: string;
  scope: string;
  interceptors: (
    HttpAdapter.InterceptorFunction | HttpAdapter.IHttpInterceptor
  )[];
  /** Whether `$schema` (native Opra schema) is published. See
   *  `HttpAdapter.Options.schema`. */
  schema: boolean;
  /** Whether `$openapi` is published, and with which options, if any.
   *  See `HttpAdapter.Options.openapi`. */
  openapi: boolean | OpenApiDocumentFactory.Options;
  /** Whether the `@opra/api-ui` reference page is published, and with
   *  which options, if any. See `HttpAdapter.Options.apiUi`. Concrete
   *  adapters (e.g. `ExpressAdapter`) are the ones that actually mount
   *  it — this base class only carries the option through, the same way
   *  `scope`/`basePath` do, since *how* a UI page gets mounted is
   *  entirely transport-specific. */
  apiUi: boolean | (ApiUiOptions & { path?: string });

  protected constructor(options?: HttpAdapter.Options) {
    super(options);
    this.interceptors = [...(options?.interceptors || [])];
    this.basePath = options?.basePath || '/';
    if (!this.basePath.startsWith('/')) this.basePath = '/' + this.basePath;
    this.scope = options?.scope ?? 'api';
    this.schema = options?.schema ?? true;
    this.openapi = options?.openapi ?? false;
    this.apiUi = options?.apiUi ?? false;
  }

  get api(): HttpApi {
    return this.document.getHttpApi();
  }

  async createContext(
    _req: http.IncomingMessage,
    _res: http.OutgoingMessage,
    args?: {
      controller?: HttpController;
      controllerInstance?: any;
      operation?: HttpOperation;
      operationHandler: Function;
    },
  ): Promise<HttpContext> {
    const request = HttpRequest.create(_req);
    const response = HttpResponse.create(_res);
    const ctx = new HttpContext({
      __adapter: this,
      bundle: _res[kBundle],
      __contDef: args?.controller,
      __controller: args?.controllerInstance,
      __oprDef: args?.operation,
      __handler: args?.operationHandler,
      platform: this.platform,
      request,
      response,
    });
    await this.emitAsync('create-context', ctx);
    return ctx;
  }

  abstract handleRawRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void>;

  /**
   * Main HTTP request handler.
   *
   * @param context - The HTTP execution context.
   * @returns A promise that resolves when the request is handled.
   * @protected
   */
  async handleRequest(context: HttpContext): Promise<void> {
    const { response } = context;
    try {
      response.setHeader(
        HttpHeaderCodes.X_Opra_Version,
        OpraSchema.SpecVersion,
      );
      // Expose headers if cors enabled
      if (response.getHeader(HttpHeaderCodes.Access_Control_Allow_Origin)) {
        // Expose X-Opra-* headers
        response.appendHeader(
          HttpHeaderCodes.Access_Control_Expose_Headers,
          Object.values(HttpHeaderCodes).filter(k =>
            k.toLowerCase().startsWith('x-opra-'),
          ),
        );
      }

      // Parse request
      try {
        await this.parseRequest(context);
      } catch (e: any) {
        if (e instanceof OpraException) throw e;
        if (e instanceof ValidationError) {
          throw new BadRequestError(
            {
              message: 'Request validation failed',
              code: 'REQUEST_VALIDATION',
              details: e.issues,
            },
            e,
          );
        }
        throw new BadRequestError(e);
      }
      await this.emitAsync('request', context);
      if (!context.__handler) throw new MethodNotAllowedError();

      const execute = async () => {
        await context.emitAsync('before-execute', context);
        await this.emitAsync('context-before-execute', context);
        /* Call operation handler */
        const responseValue = await context.__handler!.call(
          context.__controller,
          context,
        );
        context.success =
          !context.errors.length && context.response.statusCode < 400;
        await context.emitAsyncSafe('after-execute', responseValue, context);
        await this.emitAsyncSafe(
          'context-after-execute',
          responseValue,
          context,
        );
        // context
        /* Send response if not ended yet */
        if (!response.writableEnded) {
          await this.sendResponse(context, responseValue).finally(() => {
            if (!response.writableEnded) response.end();
          });
        }
      };

      // Call interceptors
      if (this.interceptors) {
        const interceptors = this.interceptors;
        let i = 0;
        const next = async () => {
          const interceptor = interceptors[i++];
          if (typeof interceptor === 'function')
            await interceptor(context, next);
          else if (typeof interceptor?.intercept === 'function')
            await interceptor.intercept(context, next);
          await execute();
        };
        await next();
      } else await execute();
    } catch (error: any) {
      context.success = false;
      let e = error;
      if (e instanceof ValidationError) {
        e = new InternalServerError(
          {
            message: 'Response validation failed',
            code: 'RESPONSE_VALIDATION',
            details: e.issues,
          },
          e,
        );
      } else e = wrapException(e);
      await this.emitAsyncSafe('error', e, context);
      context.errors.push(e);
      await this.sendResponse(context);
    } finally {
      context.finished = true;
      await context.emitAsyncSafe('finish', context);
      await this.emitAsyncSafe('context-finish', context);
    }
  }

  async handleBundle(bundle: HttpBundle) {
    const { request, response } = bundle;
    if (!request.is(MimeTypes.multipart_mixed))
      throw new BadRequestError(
        `Content-Type must be ${MimeTypes.multipart_mixed}`,
      );

    const reader = new MultipartReader(request, { isFile: () => true });
    let item: MultipartReader.Item | undefined;
    const subResponses: {
      response: ServerResponseHost;
      requestId: string;
    }[] = [];

    try {
      await bundle.emitAsync('before-execute', bundle);
      await this.emitAsync('bundle-before-execute', bundle);
      // Process all sub-requests and buffer their responses
      while ((item = await reader.getNext())) {
        if (item.kind !== 'file') continue;
        // getNext() pauses the incoming stream as soon as a part starts;
        // resume it now so this file part's remaining bytes can still be
        // written to disk while we await its buffer below.
        reader.resume();
        const buffer = await item.buffer();
        const req = await IncomingMessageHost.from(buffer);
        const res = ServerResponseHost.create(req);
        req[kBundle] = bundle;
        await this.handleRawRequest(req, res);
        // Wait for request to be fully processed
        if (!res.writableEnded)
          await new Promise<void>(resolve => res.once('finish', resolve));
        subResponses.push({
          response: res,
          requestId: String(item.headers['x-request-id'] || ''),
        });
      }
      bundle.finished = true;
      bundle.success = !bundle.contexts.find(c => !c.success);
    } catch (e) {
      const error = wrapException(e);
      bundle.error = error;
      bundle.success = false;
      bundle.finished = true;
      await bundle.emitAsyncSafe('error', error, bundle);
      await this._sendErrorResponse(response, [error], bundle);
      return;
    } finally {
      await bundle.emitAsyncSafe('finish', bundle);
      await this.emitAsyncSafe('bundle-finish', bundle);
    }

    // Add all parts synchronously before piping so SandwichStream
    // sees a fully populated queue and ends cleanly after the last part
    const stream = new MultipartStream();
    response.setHeader(
      'Content-Type',
      `multipart/mixed; boundary=${stream.boundary}`,
    );
    for (const subItem of subResponses) {
      stream.addPart({
        headers: {
          'Content-Type': 'application/http',
          'Content-Transfer-Encoding': 'binary',
          'X-Request-Id': subItem.requestId,
        },
        body: subItem.response.capacitor.createReadStream(),
      });
    }
    await new Promise<void>((resolve, reject) => {
      response.once('error', reject);
      stream.once('error', reject);
      stream.once('end', () => {
        response.end();
        resolve();
      });
      stream.on('data', (chunk: Buffer | string) => {
        response.write(chunk);
      });
      stream.resume();
    });
    await bundle.emitAsync('finish', bundle);
  }

  /**
   * Parses the HTTP request, including parameters and content type.
   *
   * @param context - The HTTP execution context.
   * @returns A promise that resolves when the request is parsed.
   */
  async parseRequest(context: HttpContext): Promise<void> {
    await this._parseParameters(context);
    await this._parseContentType(context);
    if (context.__oprDef?.requestBody?.immediateFetch) await context.getBody();
    /* Set default status code as the first status code between 200 and 299 */
    if (context.__oprDef) {
      for (const r of context.__oprDef.responses) {
        const st = r.statusCode.find(sc => sc.start <= 299 && sc.end >= 200);
        if (st) {
          context.response.status(st.start);
          break;
        }
      }
    }
  }

  /**
   * Parses various HTTP parameters (cookies, headers, path, query).
   *
   * @param context - The HTTP execution context.
   * @returns A promise that resolves when parameters are parsed.
   * @throws {@link BadRequestError} If parameter validation fails.
   * @protected
   */
  protected async _parseParameters(context: HttpContext) {
    const { __oprDef, request } = context;
    if (!__oprDef) return;

    let key: string = '';
    try {
      const onFail = (issue: ErrorIssue) => {
        issue.location = key;
        return issue;
      };
      /* prepare decoders */

      const getDecoder = (prm: HttpParameter): Validator => {
        let decode = this[kAssetCache].get<Validator>(prm, 'decode');
        if (!decode) {
          decode = prm.generateCodec('decode', {
            scope: this.scope,
            ignoreReadonlyFields: true,
          });
          this[kAssetCache].set(prm, 'decode', decode);
        }
        return decode;
      };

      const paramsLeft = new Set([
        ...__oprDef.parameters,
        ...__oprDef.owner.parameters,
      ]);

      /* parse cookie parameters */
      if (request.cookies) {
        for (key of Object.keys(request.cookies)) {
          const oprPrm = __oprDef.findParameter(key, 'cookie');
          const cntPrm = __oprDef.owner.findParameter(key, 'cookie');
          const prm = oprPrm || cntPrm;
          if (!prm) continue;
          if (oprPrm) paramsLeft.delete(oprPrm);
          if (cntPrm) paramsLeft.delete(cntPrm);
          const decode = getDecoder(prm);
          const v: any = decode(request.cookies[key], {
            coerce: true,
            label: key,
            onFail,
          });
          const prmName = typeof prm.name === 'string' ? prm.name : key;
          if (v !== undefined) context.cookies[prmName] = v;
        }
      }

      /* parse headers */
      if (request.headers) {
        for (key of Object.keys(request.headers)) {
          const oprPrm = __oprDef.findParameter(key, 'header');
          const cntPrm = __oprDef.owner.findParameter(key, 'header');
          const prm = oprPrm || cntPrm;
          if (!prm) continue;
          if (oprPrm) paramsLeft.delete(oprPrm);
          if (cntPrm) paramsLeft.delete(cntPrm);
          const decode = getDecoder(prm);
          const v: any = decode(request.headers[key], {
            coerce: true,
            label: key,
            onFail,
          });
          const prmName = typeof prm.name === 'string' ? prm.name : key;
          if (v !== undefined) context.headers[prmName] = v;
        }
      }

      /* parse path parameters */
      if (request.params) {
        for (key of Object.keys(request.params)) {
          const oprPrm = __oprDef.findParameter(key, 'path');
          const cntPrm = __oprDef.owner.findParameter(key, 'path');
          const prm = oprPrm || cntPrm;
          if (!prm) continue;
          if (oprPrm) paramsLeft.delete(oprPrm);
          if (cntPrm) paramsLeft.delete(cntPrm);
          const decode = getDecoder(prm);
          const v: any = decode(request.params[key], {
            coerce: true,
            label: key,
            onFail,
          });
          if (v !== undefined) context.pathParams[key] = v;
        }
      }

      /* parse query parameters */
      const url = new URL(
        request.originalUrl || request.url || '/',
        'http://tempuri.org',
      );
      const { searchParams } = url;
      for (key of searchParams.keys()) {
        const oprPrm = __oprDef.findParameter(key, 'query');
        const cntPrm = __oprDef.owner.findParameter(key, 'query');
        const prm = oprPrm || cntPrm;
        if (!prm) continue;
        if (oprPrm) paramsLeft.delete(oprPrm);
        if (cntPrm) paramsLeft.delete(cntPrm);
        const decode = getDecoder(prm);
        let values: any[] = searchParams?.getAll(key);
        const prmName = typeof prm.name === 'string' ? prm.name : key;
        if (values?.length && (prm.type instanceof ArrayType || prm.isArray)) {
          values = values
            .map(v =>
              splitString(v, {
                delimiters: prm.arraySeparator || ',',
                quotes: true,
              }),
            )
            .flat();
          if (prm.type instanceof ArrayType)
            values = decode(values, { coerce: true, label: key, onFail });
          else
            values = values.map(v =>
              decode(v, { coerce: true, label: key, onFail }),
            );
          if (prm.parser) values = prm.parser(values);
          if (values.length) context.queryParams[prmName] = values;
        } else {
          let v = decode(values[0], { coerce: true, label: key, onFail });
          if (prm.parser) v = prm.parser(v);
          if (values.length) context.queryParams[prmName] = v;
        }
      }

      for (const prm of paramsLeft) {
        key = String(prm.name);
        // Throw error for required parameters
        if (prm.default !== undefined && typeof prm.name === 'string') {
          context.queryParams[prm.name] = prm.default;
        } else if (prm.required) {
          const decode = getDecoder(prm);
          decode(undefined, { coerce: true, label: String(prm.name), onFail });
        }
      }
    } catch (e: any) {
      if (e instanceof ValidationError) {
        throw new BadRequestError(
          {
            message: `Invalid parameter (${key}) value. ` + e.message,
            code: 'REQUEST_VALIDATION',
            details: e.issues,
          },
          e,
        );
      }
      throw e;
    }
  }

  /**
   * Parses and validates the request content type.
   *
   * @param context - The HTTP execution context.
   * @returns A promise that resolves when content type is parsed.
   * @throws {@link BadRequestError} If the content type is invalid or missing.
   * @protected
   */
  protected async _parseContentType(context: HttpContext) {
    const { request, __oprDef } = context;
    if (!__oprDef) return;
    if (__oprDef.requestBody?.content.length) {
      let mediaType: HttpMediaType | undefined;
      let contentType = request.header('content-type');
      if (contentType) {
        const ct = parseContentType(contentType);
        contentType = ct.type;
        mediaType = __oprDef.requestBody.content.find(
          mc =>
            mc.contentType &&
            typeIs.is(
              contentType!,
              Array.isArray(mc.contentType) ? mc.contentType : [mc.contentType],
            ),
        );
        if (mediaType) mediaType = Object.create(mediaType);
        if (ct && mediaType) {
          mediaType.contentType = contentType;
          mediaType.contentEncoding =
            ct.parameters?.['charset'] || mediaType.contentEncoding;
        }
      }
      if (!mediaType) {
        const contentTypes = __oprDef.requestBody.content
          .map(mc => mc.contentType)
          .flat();
        throw new BadRequestError(
          `Request body should be one of required content types (${contentTypes.join(', ')})`,
        );
      }
      asMutable(context).mediaType = mediaType;
    }
  }

  /**
   * Sends an HTTP response back to the client.
   *
   * @param context - The HTTP execution context.
   * @param responseValue - The value to be sent in the response body.
   * @returns A promise that resolves when the response is sent.
   */
  async sendResponse(context: HttpContext, responseValue?: any): Promise<void> {
    if (context.errors.length) {
      context.errors = this._wrapExceptions(context.errors);
      return this._sendErrorResponse(context.response, context.errors, context);
    }
    const { response } = context;
    const { document } = this;
    try {
      const responseArgs = this._determineResponseArgs(context, responseValue);

      const { operationResponse, statusCode } = responseArgs;
      let { contentType, body } = responseArgs;

      const operationResultType = document.node.getDataType(OperationResult);
      let operationResultEncoder = this[kAssetCache].get<Validator>(
        operationResultType,
        'encode',
      );
      if (!operationResultEncoder) {
        operationResultEncoder = operationResultType.generateCodec('encode', {
          scope: this.scope,
          ignoreWriteonlyFields: true,
        });
        this[kAssetCache].set(
          operationResultType,
          'encode',
          operationResultEncoder,
        );
      }

      /* Validate response */
      if (operationResponse?.type) {
        if (!(
          body == null &&
          (statusCode as HttpStatusCode) === HttpStatusCode.NO_CONTENT
        )) {
          /* Generate encoder */
          const projection = responseArgs.projection || '*';
          const assetKey = md5(String(projection));
          let encode = this[kAssetCache].get<Validator>(
            operationResponse,
            'encode:' + assetKey,
          )!;
          if (!encode) {
            encode = operationResponse.type.generateCodec('encode', {
              scope: this.scope,
              partial: operationResponse.partial,
              projection,
              ignoreWriteonlyFields: true,
              onFail: issue =>
                `Response body validation failed: ` + issue.message,
            });
            if (operationResponse) {
              if (operationResponse.isArray) encode = vg.isArray(encode);
              this[kAssetCache].set(
                operationResponse,
                'encode:' + assetKey,
                encode,
              );
            }
          }
          /* Encode body */
          if (operationResponse.type.extendsFrom(operationResultType)) {
            if (body instanceof OperationResult) body = encode(body);
            else {
              body.payload = encode(body.payload);
              body = operationResultEncoder(body);
            }
          } else {
            if (
              body instanceof OperationResult &&
              contentType &&
              typeIs.is(contentType, [MimeTypes.opra_response_json])
            ) {
              body.payload = encode(body.payload);
              body = operationResultEncoder(body);
            } else {
              body = encode(body);
            }
          }

          if (
            body instanceof OperationResult &&
            operationResponse.type &&
            operationResponse.type !==
              document.node.getDataType(OperationResult)
          ) {
            body.type = operationResponse.type.name
              ? operationResponse.type.name
              : '#embedded';
          }
        }
      } else if (body != null) {
        if (body instanceof OperationResult) {
          body = operationResultEncoder(body);
          contentType = MimeTypes.opra_response_json;
        } else if (Buffer.isBuffer(body)) contentType = MimeTypes.binary;
        else if (typeof body === 'object') {
          contentType = contentType || MimeTypes.json;
          if (typeof body.toJSON === 'function') body = body.toJSON();
        } else {
          contentType = contentType || MimeTypes.text;
          body = String(body);
        }
      }
      /* Set content-type header value if not set */
      if (contentType && contentType !== responseArgs.contentType)
        response.setHeader('content-type', contentType);

      response.status(statusCode);
      if (body == null) {
        response.end();
        return;
      }
      let source: Readable | undefined;
      if (isReadable(body)) source = body;
      else if (isReadableStream(body)) source = toReadable(body);
      else if (isBlob(body)) source = toReadable(body);
      if (source) {
        await new Promise<void>((resolve, reject) => {
          source.once('error', reject);
          response.once('error', reject);
          response.once('finish', resolve);
          source.pipe(response);
        });
        return;
      }
      if (typeof body === 'object') body = JSON.stringify(body);
      if (!Buffer.isBuffer(body)) body = Buffer.from(String(body));
      response.end(body);
    } catch (error: any) {
      context.errors.push(error);
      context.errors = this._wrapExceptions(context.errors);
      return this._sendErrorResponse(context.response, context.errors, context);
    }
  }

  protected async _sendErrorResponse(
    response: HttpResponse,
    errors: any[],
    context: HttpContext | HttpBundle,
  ): Promise<void> {
    context.emitSafe('error', errors[0], context);
    if (this.logger?.error) {
      const logger = this.logger;
      errors.forEach(e => {
        if (e.status >= 500 && e.status < 600) logger.error(e);
      });
    }

    if (response.headersSent) {
      response.end();
      return;
    }

    let status = response.statusCode || 0;
    if (!status || status < Number(HttpStatusCode.BAD_REQUEST)) {
      status = errors[0].status;
      if (status < Number(HttpStatusCode.BAD_REQUEST))
        status = HttpStatusCode.INTERNAL_SERVER_ERROR;
    }
    response.statusCode = status;

    const { document } = this;
    const dt = document.node.getComplexType('OperationResult');
    let encode = this[kAssetCache].get<Validator>(dt, 'encode');
    if (!encode) {
      encode = dt.generateCodec('encode', {
        scope: this.scope,
        ignoreWriteonlyFields: true,
      });
      this[kAssetCache].set(dt, 'encode', encode);
    }
    // const { i18n } = this.adapter;
    const bodyObject = new OperationResult({
      errors: errors.map(x => {
        const o = x.toJSON();
        if (!(
          process.env.NODE_ENV === 'dev' ||
          process.env.NODE_ENV === 'development'
        ))
          delete o.stack;
        return o; // i18n.deep(o);
      }),
    });
    const body = encode(bodyObject);

    response.setHeader(
      HttpHeaderCodes.Content_Type,
      MimeTypes.opra_response_json + '; charset=utf-8',
    );
    response.setHeader(HttpHeaderCodes.Cache_Control, 'no-cache');
    response.setHeader(HttpHeaderCodes.Pragma, 'no-cache');
    response.setHeader(HttpHeaderCodes.Expires, '-1');
    response.setHeader(HttpHeaderCodes.X_Opra_Version, OpraSchema.SpecVersion);
    response.send(safeJsonStringify(body));
    response.end();
  }

  /**
   * Sends the document schema as a JSON response.
   *
   * @param context - The HTTP execution context.
   * @returns A promise that resolves when the schema is sent.
   */
  async sendDocumentSchema(context: HttpContext): Promise<void> {
    const { request, response } = context;
    const { document } = this;
    response.setHeader('content-type', MimeTypes.json);
    const url = new URL(
      request.originalUrl || request.url || '/',
      'http://tempuri.org',
    );
    const { searchParams } = url;
    const documentId = searchParams.get('id');
    const doc = documentId ? document.findDocument(documentId) : document;
    if (!doc) {
      context.errors.push(
        new BadRequestError({
          message: `Document with given id [${documentId}] does not exists`,
        }),
      );
      return this.sendResponse(context);
    }
    /* Documentation language comes from `?lang=` alone — deliberately not
     * from `Accept-Language`. Sniffing the header would make one URL return
     * different bodies, which any shared cache in front of this service
     * would then serve to the wrong client (and `Vary: Accept-Language`,
     * the alternative, all but disables caching since real header values
     * are near-unique per browser). Without the parameter the document's
     * own default language answers — which resolves to nothing at all for
     * a document that ships no translations, leaving the texts written in
     * the source exactly as they are. */
    const lang = doc.resolveLanguage(searchParams.get('lang') || undefined);
    /* Check if response cache exists. The language is part of the key: the
     * same document serializes differently per language. */
    const cacheKey = `$schema${lang ? ':' + lang : ''}`;
    let responseBody = this[kAssetCache].get(doc, cacheKey);
    /* Create response if response cache does not exists */
    if (!responseBody) {
      const schema = doc.export({
        scope: this.scope,
        lang,
      });
      responseBody = JSON.stringify(schema);
      this[kAssetCache].set(doc, cacheKey, responseBody);
    }
    response.end(responseBody);
  }

  /**
   * Sends the document mapped to an OpenAPI 3.0/3.1 document as JSON —
   * the `$openapi` counterpart of `sendDocumentSchema()` above, same
   * `?id=` sub-document lookup included. Requires the optional
   * `@opra/openapi` package; it's lazily imported here (only once,
   * cached by Node itself) rather than imported at the top of this file,
   * so an adapter that never enables `openapi` never loads it.
   *
   * @param context - The HTTP execution context.
   * @returns A promise that resolves when the document is sent.
   */
  async sendOpenApiDocument(context: HttpContext): Promise<void> {
    const { request, response } = context;
    const { document } = this;
    const url = new URL(
      request.originalUrl || request.url || '/',
      'http://tempuri.org',
    );
    const { searchParams } = url;
    const documentId = searchParams.get('id');
    const doc = documentId ? document.findDocument(documentId) : document;
    if (!doc) {
      context.errors.push(
        new BadRequestError({
          message: `Document with given id [${documentId}] does not exists`,
        }),
      );
      return this.sendResponse(context);
    }
    if (!(doc.api instanceof HttpApi)) {
      context.errors.push(
        new BadRequestError({
          message: `Document${documentId ? ` [${documentId}]` : ''} has no HTTP api to convert to OpenAPI`,
        }),
      );
      return this.sendResponse(context);
    }
    let responseBody = this[kAssetCache].get(doc, `$openapi`);
    if (!responseBody) {
      let generate: typeof import('@opra/openapi').OpenApiDocumentFactory.generate;
      try {
        ({
          OpenApiDocumentFactory: { generate },
        } = await import('@opra/openapi'));
      } catch {
        context.errors.push(
          new InternalServerError({
            message:
              'OpenAPI export requires the "@opra/openapi" package to be installed',
          }),
        );
        return this.sendResponse(context);
      }
      const openApiOptions =
        typeof this.openapi === 'object' ? this.openapi : undefined;
      const openApiDoc = generate(doc, {
        scope: this.scope,
        ...openApiOptions,
      });
      responseBody = JSON.stringify(openApiDoc);
      this[kAssetCache].set(doc, `$openapi`, responseBody);
    }
    response.setHeader('content-type', MimeTypes.json);
    response.end(responseBody);
  }

  /**
   * Determines the response arguments (status code, content type, etc.) for a given response value.
   *
   * @param context - The HTTP execution context.
   * @param body - The response body.
   * @returns The determined response arguments.
   * @throws {@link InternalServerError} If response configuration is missing or invalid.
   * @protected
   */
  protected _determineResponseArgs(
    context: HttpContext,
    body: any,
  ): HttpAdapter.ResponseArgs {
    const { response, __oprDef } = context;

    const hasBody = body != null;
    const statusCode =
      !hasBody && (response.statusCode as any) === HttpStatusCode.OK
        ? HttpStatusCode.NO_CONTENT
        : response.statusCode;
    /* Parse content-type header */
    const parsedContentType =
      hasBody && response.hasHeader('content-type')
        ? parseContentType(String(response.getHeader('content-type')))
        : undefined;
    let contentType = parsedContentType?.type;
    /* Estimate content type if not defined */
    if (hasBody && !contentType) {
      if (body instanceof OperationResult)
        contentType = MimeTypes.opra_response_json;
      else if (Buffer.isBuffer(body)) contentType = MimeTypes.binary;
    }
    let operationResponse: HttpOperationResponse | undefined;

    const cacheKey = `HttpOperationResponse:${statusCode}${contentType ? ':' + contentType : ''}`;
    let responseArgs = this[kAssetCache].get<HttpAdapter.ResponseArgs>(
      response,
      cacheKey,
    );
    if (!responseArgs) {
      responseArgs = { statusCode, contentType } as HttpAdapter.ResponseArgs;

      if (__oprDef?.responses.length) {
        /* Filter available HttpOperationResponse instances according to status code. */
        const filteredResponses = __oprDef.responses.filter(r =>
          r.statusCode.find(
            sc => sc.start <= statusCode && sc.end >= statusCode,
          ),
        );

        /* Throw InternalServerError if controller returns non-configured status code */
        if (!filteredResponses.length && statusCode < 400) {
          throw new InternalServerError(
            `No responses defined for status code ${statusCode} in operation "${__oprDef.name}"`,
          );
        }

        /* We search for content-type in filtered HttpOperationResponse array */
        if (filteredResponses.length) {
          /* If no response returned, and content-type has not been set (No response wants to be returned by operation) */
          if (!hasBody) {
            /* Find HttpOperationResponse with no content-type */
            operationResponse = filteredResponses.find(r => !r.contentType);
          }

          if (!operationResponse) {
            /* Find HttpOperationResponse according to content-type */
            if (contentType) {
              // Find HttpEndpointResponse instance according to content-type header
              operationResponse = filteredResponses.find(r =>
                typeIs.is(contentType!, toArray(r.contentType)),
              );
              /* A response that declares no content type at all constrains
               * nothing, so it answers for whatever the operation actually
               * returned - the same reading the `!hasBody` branch above
               * already gives it. Without this, declaring
               * `.Response(200, { type: OperationResult })` and returning an
               * `OperationResult` is unsatisfiable: the body's type decides
               * the content type is `opra.response+json` a few lines up,
               * and nothing declared could ever match it. */
              operationResponse ??= filteredResponses.find(r => !r.contentType);
              if (!operationResponse) {
                throw new InternalServerError(
                  `Operation didn't configured to return "${contentType}" content`,
                );
              }
            } else {
              /* Select first HttpOperationResponse if content-type header has not been set */
              operationResponse = filteredResponses[0];
              if (operationResponse.contentType) {
                const ct = typeIs.normalize(
                  Array.isArray(operationResponse.contentType)
                    ? operationResponse.contentType[0]
                    : operationResponse.contentType,
                );
                if (typeof ct === 'string')
                  responseArgs.contentType = contentType = ct;
                else if (operationResponse.type)
                  responseArgs.contentType = MimeTypes.opra_response_json;
              }
            }
          }
          responseArgs.operationResponse = operationResponse;
          if (
            !operationResponse.statusCode.find(
              sc => sc.start <= statusCode && sc.end >= statusCode,
            )
          ) {
            responseArgs.statusCode = operationResponse.statusCode[0].start;
          }
        }
      }
      if (!hasBody) delete responseArgs.contentType;
      if (__oprDef?.composition?.startsWith('Entity.')) {
        if (context.queryParams.projection)
          responseArgs.projection = context.queryParams.projection;
      }
      this[kAssetCache].set(response, cacheKey, { ...responseArgs });
    }

    /* Fix response value according to composition */
    const composition = operationResponse?.owner.composition;
    if (composition && body != null) {
      switch (composition) {
        case 'Entity.Create':
        case 'Entity.Get':
        case 'Entity.FindMany':
        case 'Entity.Update': {
          if (!(body instanceof OperationResult)) {
            body = new OperationResult({
              payload: body,
            });
          }
          if (
            (composition === 'Entity.Create' ||
              composition === 'Entity.Update') &&
            composition &&
            body.affected == null
          ) {
            body.affected = 1;
          }
          break;
        }
        case 'Entity.Delete':
        case 'Entity.DeleteMany':
        case 'Entity.UpdateMany': {
          if (!(body instanceof OperationResult)) {
            body = new OperationResult({
              affected: body,
            });
          }
          body.affected =
            typeof body.affected === 'number'
              ? body.affected
              : typeof body.affected === 'boolean'
                ? body.affected
                  ? 1
                  : 0
                : undefined;
          break;
        }
        default:
          break;
      }
    }

    if (
      responseArgs.contentType &&
      responseArgs.contentType !== parsedContentType?.type
    ) {
      response.setHeader('content-type', responseArgs.contentType);
    }
    if (
      responseArgs.contentType &&
      body != null &&
      !(body instanceof OperationResult) &&
      typeIs.is(responseArgs.contentType!, [MimeTypes.opra_response_json])
    ) {
      body = new OperationResult({ payload: body });
    }

    if (hasBody) responseArgs.body = body;
    return responseArgs;
  }

  protected _wrapExceptions(exceptions: any[]): OpraHttpError[] {
    const wrappedErrors = exceptions.map(wrapException);
    if (!wrappedErrors.length) wrappedErrors.push(new InternalServerError());
    // Sort errors from fatal to info
    wrappedErrors.sort((a, b) => {
      const i =
        IssueSeverity.Keys.indexOf(a.severity) -
        IssueSeverity.Keys.indexOf(b.severity);
      if (i === 0) return b.status - a.status;
      return i;
    });
    return wrappedErrors;
  }
}

export namespace HttpAdapter {
  export type NextCallback = () => Promise<void>;

  /**
   * The interceptor function signature.
   */
  export type InterceptorFunction = IHttpInterceptor['intercept'];

  /**
   * Interface for HTTP interceptors.
   */
  export type IHttpInterceptor = {
    intercept(context: HttpContext, next: NextCallback): Promise<void>;
  };

  export interface Options extends PlatformAdapter.Options {
    basePath?: string;
    interceptors?: (InterceptorFunction | IHttpInterceptor)[];
    scope?: string;
    /**
     * Whether to publish the document's own native Opra schema at
     * `GET $schema` (and accept `$bundle` multipart batch requests — see
     * `handleBundle`). Enabled by default, matching this adapter's
     * long-standing behavior; set to `false` to omit it entirely (e.g. to
     * keep the schema private in production).
     * @default true
     */
    schema?: boolean;
    /**
     * Whether to publish an OpenAPI 3.0/3.1 mapping of the document at
     * `GET $openapi`. Requires the optional `@opra/openapi` package to be
     * installed — lazily imported on first request, so an adapter that
     * leaves this disabled (the default) never loads it. Pass an options
     * object instead of `true` to customize the generated document (see
     * `OpenApiDocumentFactory.Options`).
     * @default false
     */
    openapi?: boolean | OpenApiDocumentFactory.Options;
    /**
     * Whether to publish the interactive API reference UI (`@opra/api-ui`)
     * alongside this adapter's own routes. Requires the optional
     * `@opra/api-ui` package to be installed — lazily imported on first
     * request, so an adapter that leaves this disabled (the default)
     * never loads it. Pass an options object instead of `true` to
     * customize the rendered page (see `ApiUiOptions`); `path` (default
     * `"$docs"`) picks where it's mounted, relative to this adapter's own
     * `basePath`. *How* this actually gets mounted is entirely
     * transport-specific — see each concrete adapter (e.g.
     * `ExpressAdapter`) for what it does with this option.
     * @default false
     */
    apiUi?: boolean | (ApiUiOptions & { path?: string });
  }

  /**
   * @interface ResponseArgs
   */
  export interface ResponseArgs {
    statusCode: number;
    contentType?: string;
    operationResponse?: HttpOperationResponse;
    body?: any;
    projection?: string[] | '*';
  }

  export interface Events {
    createContext: [context: HttpContext];
    error: [error: Error, context?: HttpContext];
    request: [context: HttpContext];
    /* Emitted before an operation starts execution */
    'context-before-execute': [context: HttpContext];
    /* Emitted after an operation starts execution */
    'context-after-execute': [context: HttpContext];
    /* Emitted when an operation finishes successfully */
    'context-finish': [responseValue: any, context: HttpContext];
    /* Emitted before an operation starts execution */
    'bundle-before-execute': [context: HttpBundle];
    /* Emitted after an operation starts execution */
    'bundle-after-execute': [context: HttpBundle];
    /* Emitted when an operation finishes successfully */
    'bundle-finish': [responseValue: any, context: HttpBundle];
  }
}
