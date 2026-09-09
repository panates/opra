// /// <reference lib="dom" />
import typeIs from '@browsery/type-is';
import { omit } from '@jsopen/objects';
import { isBlob, isFormData } from '@opra/common';
import { Buffer } from 'buffer';
import { Observable } from 'rxjs';
import { isReadableStreamLike } from 'rxjs/internal/util/isReadableStreamLike';
import type { Combine, StrictOmit } from 'ts-gems';
import { HttpBackend } from './http-backend.js';
import { HttpResponse } from './http-response.js';
import {
  type HttpDownloadProgressEvent,
  type HttpEvent,
  HttpEventType,
  type HttpResponseEvent,
  type HttpResponseHeaderEvent,
  type HttpSentEvent,
  type HttpUploadProgressEvent,
} from './interfaces/http-event.js';
import type { HttpInterceptor } from './interfaces/http-interceptor.js';

/**
 *
 * @class FetchBackend
 */
export class FetchBackend extends HttpBackend {
  interceptors: FetchBackend.Interceptor[];
  defaults: FetchBackend.RequestDefaults;

  constructor(serviceUrl: string, options?: FetchBackend.Options) {
    super(serviceUrl, options);
    // Create deduped interceptor array
    this.interceptors = Array.from(new Set([...(options?.interceptors || [])]));
    this.defaults = {
      ...options?.defaults,
      headers:
        options?.defaults?.headers instanceof Headers
          ? options?.defaults?.headers
          : new Headers(options?.defaults?.headers),
      params:
        options?.defaults?.params instanceof URLSearchParams
          ? options?.defaults?.params
          : new URLSearchParams(options?.defaults?.params),
    };
  }

  handle(init: FetchBackend.RequestInit): Observable<HttpEvent> {
    return new Observable<HttpEvent>(subscriber => {
      (async () => {
        let request = this.prepareRequest(init);

        if (request.body && init.reportProgress) {
          const stream = request.body;
          const contentLength = request.headers.get('content-length') || '0';
          const total = parseInt(contentLength, 10) || 0;
          let loaded = 0;
          const progressTrackingStream = new TransformStream({
            transform(chunk, controller) {
              controller.enqueue(chunk);
              loaded += chunk.byteLength;
              // Emit 'UploadProgress' event
              subscriber.next({
                type: HttpEventType.UploadProgress,
                request,
                total,
                loaded,
              } satisfies HttpUploadProgressEvent);
            },
          });
          request = new Request(request.url, {
            cache: request.cache,
            credentials: request.credentials,
            headers: request.headers,
            integrity: request.integrity,
            keepalive: request.keepalive,
            method: request.method,
            mode: request.mode,
            redirect: request.redirect,
            referrer: request.referrer,
            referrerPolicy: request.referrerPolicy,
            signal: request.signal,
            body: stream.pipeThrough(progressTrackingStream),
            window: init.window,
            ...{
              // undici library requires
              duplex: 'half',
            },
          });
        }

        // Send request
        const fetchPromise = this.send(request);

        // Emit 'Sent' event
        subscriber.next({
          request,
          type: HttpEventType.Sent,
        } satisfies HttpSentEvent);

        const fetchResponse = await fetchPromise;

        // Emit 'ResponseHeader' event
        const headersResponse = this.createResponse({
          url: fetchResponse.url,
          headers: fetchResponse.headers,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          hasBody: !!fetchResponse.body,
        }) as HttpResponse<never>;
        subscriber.next({
          request,
          type: HttpEventType.ResponseHeader,
          response: headersResponse,
        } satisfies HttpResponseHeaderEvent);

        // Parse body
        let body: unknown;
        if (fetchResponse.body) {
          if (init.reportProgress) {
            const fetchBody = fetchResponse.body;
            const contentLength =
              fetchResponse.headers.get('content-length') || '0';
            const total = parseInt(contentLength, 10) || 0;
            let loaded = 0;
            const res = new Response(
              new ReadableStream({
                async start(controller) {
                  const reader = fetchBody.getReader();
                  for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    loaded += value.byteLength;
                    controller.enqueue(value);
                    // Emit 'DownloadProgress' event
                    subscriber.next({
                      type: HttpEventType.DownloadProgress,
                      request,
                      total,
                      loaded,
                    } satisfies HttpDownloadProgressEvent);
                  }
                  controller.close();
                },
              }),
            );
            body = await this.parseBody(res);
          } else {
            body = await this.parseBody(fetchResponse);
          }
        }

        const response = this.createResponse({
          url: fetchResponse.url,
          headers: fetchResponse.headers,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          body,
        });

        // Emit 'Response' event
        subscriber.next({
          request,
          type: HttpEventType.Response,
          response,
        } satisfies HttpResponseEvent);

        subscriber.complete();
      })().catch(error => subscriber.error(error));
    });
  }

  protected send(request: Request): Promise<Response> {
    return fetch(request);
  }

  protected prepareRequest(init: FetchBackend.RequestInit) {
    const headers = init.headers || new Headers();
    const requestInit: FetchBackend.RequestInit = {
      ...init,
      ...omit(this.defaults, ['headers', 'params']),
      headers,
    };
    this.defaults.headers.forEach((val, key) => {
      if (!headers.has(key)) headers.set(key, val);
    });
    const url = new URL(requestInit.url, this.serviceUrl);
    if (this.defaults.params.size) {
      this.defaults.params.forEach((val, key) => {
        if (!url.searchParams.has(key)) url.searchParams.set(key, val);
      });
      requestInit.url = url.toString();
    }
    const body = requestInit.body;
    if (body) {
      let contentType = '';
      if (
        typeof body === 'string' ||
        typeof body === 'number' ||
        typeof body === 'boolean'
      ) {
        contentType = 'text/plain; charset="UTF-8"';
        requestInit.body = new Blob([String(body)], { type: contentType });
        headers.set('Content-Length', String(requestInit.body.size));
        delete requestInit.duplex;
      } else if (isReadableStreamLike(body)) {
        contentType = 'application/octet-stream';
        requestInit.duplex = 'half'; // undici library requires "duplex" option to be set for streams
      } else if (Buffer.isBuffer(body)) {
        contentType = 'application/octet-stream';
        headers.set('Content-Length', String(body.length));
        delete requestInit.duplex;
      } else if (isBlob(body)) {
        contentType = body.type || 'application/octet-stream';
        headers.set('Content-Length', String(body.size));
        delete requestInit.duplex;
      } else if (isFormData(body)) {
        delete requestInit.duplex;
      } else {
        contentType = 'application/json;charset="UTF-8"';
        requestInit.body = new Blob([JSON.stringify(body)], {
          type: contentType,
        });
        headers.set('Content-Length', String(requestInit.body.size));
        delete requestInit.duplex;
      }
      if (contentType && !headers.has('Content-Type'))
        headers.set('Content-Type', contentType);
    }
    return new Request(url.toString(), requestInit);
  }

  protected createResponse(init: HttpResponse.Initiator): HttpResponse {
    return new HttpResponse(init);
  }

  protected async parseBody(fetchResponse: Response): Promise<any> {
    let body: any;
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    if (typeIs.is(contentType, ['json', 'application/*+json'])) {
      body = await fetchResponse.json();
      if (typeof body === 'string') body = JSON.parse(body);
    } else if (typeIs.is(contentType, ['text']))
      body = await fetchResponse.text();
    else if (typeIs.is(contentType, ['multipart/form-data']))
      body = await fetchResponse.formData();
    else {
      const buf = await fetchResponse.arrayBuffer();
      if (buf.byteLength) body = buf;
    }
    return body;
  }
}

type DomRequestInit = RequestInit;
/**
 * @namespace FetchBackend
 */
export namespace FetchBackend {
  export type Interceptor = HttpInterceptor<RequestInit>;

  export interface Options extends HttpBackend.Options {
    interceptors?: Interceptor[];
    defaults?: RequestDefaults;
  }

  export interface RequestInit extends Combine<
    StrictOmit<HttpBackend.RequestInit, 'body'>,
    DomRequestInit
  > {
    duplex?: string;
    reportProgress?: boolean;
  }

  export interface RequestOptions extends Partial<
    Pick<
      RequestInit,
      | 'cache'
      | 'credentials'
      | 'integrity'
      | 'keepalive'
      | 'mode'
      | 'redirect'
      | 'referrer'
      | 'referrerPolicy'
      | 'reportProgress'
    >
  > {}

  export type RequestDefaults = RequestOptions & {
    headers: Headers;
    params: URLSearchParams;
  };
}
