import { Readable } from 'node:stream';
import { type HeaderInfo, HTTPParser } from '@browsery/http-parser';
import MultipartStream from '@browsery/multipart-stream';
import typeIs from '@browsery/type-is';
import { omit } from '@jsopen/objects';
import { MimeTypes, type URLSearchParamsInit } from '@opra/common';
import { Buffer } from 'buffer';
import * as MP from 'multipasta/node';
import { lastValueFrom, Observable } from 'rxjs';
import { ClientError } from './client-error.js';
import { kBackend, kContext } from './constants.js';
import { HttpBackend } from './http-backend.js';
import { HttpInterceptorHandler } from './http-interceptor-handler.js';
import { HttpRequestObservable } from './http-request-observable.js';
import { HttpResponse } from './http-response.js';
import { serializeHttpRequest } from './http-utils.js';
import { HttpEventType } from './interfaces/http-event.js';

/**
 * Fully drains a Node-style Readable into a single Buffer.
 *
 * The multipart body is built upfront in memory anyway (every sub-request is
 * already known), so there is no reason to hand `fetch()` a streaming body —
 * doing so hits two unrelated environment bugs: `@browsery/stream`'s
 * `Readable.toWeb()` is unimplemented (its internal `lazyWebStreams()`
 * returns `{}` and is never populated, so calling it throws), and even a
 * hand-rolled web-stream body trips Chrome's refusal to send a streaming
 * (`duplex: "half"`) fetch body over plain HTTP/1.1 — it only allows that
 * over HTTP/2, so the request fails with `TypeError: Failed to fetch`
 * before ever reaching the network. A plain `Buffer` body sidesteps both.
 */
async function readableToBuffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable as unknown as AsyncIterable<
    Uint8Array | string
  >) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 *
 * @class HttpBundleObservable
 */
export class HttpBundleObservable<
  /* Determines type of http request options */
  TRequestOptions = {},
> extends Observable<HttpResponse[]> {
  declare [kBackend]: HttpBackend;
  declare [kContext]: {
    requests: HttpRequestObservable<any>[];
    method: string;
    url: URL;
    headers: Headers;
    [key: string]: any;
  };

  constructor(
    backend: HttpBackend,
    requests: HttpRequestObservable<any>[],
    init?: Pick<HttpBackend.RequestInit, 'headers'>,
  ) {
    /* Bind every request to this bundle *before* the caller has a chance to
       subscribe to one directly (e.g. `req.getBody()` right after
       `client.bundle([...])`) — otherwise it would fire its own network call */
    for (const req of requests) {
      // @ts-ignore
      req._bindBundle();
    }

    super(subscriber => {
      if (!requests.length) {
        subscriber.next([]);
        subscriber.complete();
        return;
      }

      const _this = this;

      /* Parsing the multipart response is asynchronous, but the source
         observable completes synchronously right after emitting the Response
         event — without this guard, that completion would race ahead of our
         parsing and reach `subscriber.complete()` before `subscriber.next()`
         is ever called (surfacing as "no elements in sequence" downstream) */
      let handled = false;

      /* Building the body is async (it's fully buffered upfront — see
         readableToBuffer), so the dispatch has to wait for it too */
      (async () => {
        /* Build the multipart body from sub-requests */
        const multipartStream = new MultipartStream();
        for (const req of requests) {
          multipartStream.addPart({
            headers: {
              'Content-Type': 'application/http',
              'Content-Transfer-Encoding': 'binary',
              'X-Request-Id': req.requestId,
            },
            body: serializeHttpRequest(req[kContext]),
          });
        }

        this[kContext].body = await readableToBuffer(
          multipartStream as unknown as Readable,
        );
        this[kContext].headers.set(
          'Content-Type',
          `multipart/mixed; boundary=${multipartStream.boundary}`,
        );

        new HttpInterceptorHandler(backend.interceptors || [], this[kBackend])
          .handle(this[kContext])
          .subscribe({
            next(event) {
              if (event.type === HttpEventType.Response) {
                handled = true;
                const { response } = event;

                if (response.status >= 400 && response.status < 600) {
                  const error = new ClientError({
                    message: response.status + ' ' + response.statusText,
                    status: response.status,
                  });
                  for (const req of requests) req._finalizeError(error);
                  subscriber.error(error);
                  subscriber.complete();
                  return;
                }

                if (
                  !typeIs.is(response.contentType || '', [
                    MimeTypes.multipart_mixed,
                  ])
                ) {
                  const error = new ClientError({
                    message: 'Server did not return a multipart/mixed response',
                    status: 500,
                  });
                  for (const req of requests) req._finalizeError(error);
                  subscriber.error(error);
                  subscriber.complete();
                  return;
                }

                /* Parse multipart/mixed response */
                const rawBody = response.body as ArrayBuffer | undefined;
                if (!rawBody?.byteLength) {
                  const fallback = new HttpResponse({
                    status: 0,
                    statusText: 'No response',
                  });
                  for (const req of requests) {
                    // @ts-ignore
                    req._finalize(fallback);
                  }
                  subscriber.next([]);
                  subscriber.complete();
                  return;
                }

                /* Match each request by its unique requestId so it can be
                   finalized as soon as its part is parsed, without waiting
                   for the rest of the bundle */
                const requestQueue = new Map(
                  requests.map(req => [req.requestId, req]),
                );
                const responseMap = new Map<string, HttpResponse>();
                /* Must include the boundary parameter, so use the raw header
                 rather than HttpResponse#contentType (which strips it) */
                const contentTypeHeader =
                  response.headers.get('content-type') || '';

                /* Parse parts via multipasta; each part is matched and its
                   request finalized as soon as it becomes available */
                _this
                  ._parseMultipartParts(
                    Buffer.from(rawBody),
                    contentTypeHeader,
                    part => {
                      const requestId = part.headers['x-request-id'];
                      if (!requestId) return;
                      const partResponse = _this._parseRawHttpResponse(
                        part.body,
                      );
                      responseMap.set(requestId, partResponse);
                      // @ts-ignore
                      requestQueue.get(requestId)?._finalize(partResponse);
                      requestQueue.delete(requestId);
                    },
                  )
                  .then(() => {
                    /* Finalize any request whose part never arrived so its
                     subscribers/promises don't hang forever */
                    for (const req of requestQueue.values()) {
                      const fallback = new HttpResponse({
                        status: 0,
                        statusText: 'No response',
                      });
                      responseMap.set(req.requestId, fallback);
                      // @ts-ignore
                      req._finalize(fallback);
                    }
                    /* Emit responses in original request order */
                    const responses = requests.map(req =>
                      responseMap.get(req.requestId)!,
                    );
                    subscriber.next(responses);
                    subscriber.complete();
                  })
                  .catch(err => {
                    for (const req of requests) req._finalizeError(err);
                    subscriber.error(err);
                  });
              }
            },
            error(error) {
              handled = true;
              for (const req of requests) req._finalizeError(error);
              subscriber.error(error);
            },
            complete() {
              /* The Response branch (sync or async) always terminates the
               subscriber itself; only act as a fallback if it never ran */
              if (!handled) subscriber.complete();
            },
          });
      })().catch(err => {
        for (const req of requests) req._finalizeError(err);
        subscriber.error(err);
      });
    });
    Object.defineProperty(this, kBackend, {
      enumerable: false,
      value: backend,
    });
    Object.defineProperty(this, kContext, {
      enumerable: false,
      value: {
        ...init,
        method: 'POST',
        url: '$bundle',
        requests,
        headers: new Headers(init?.headers),
      },
    });
  }

  options(options: TRequestOptions): HttpBundleObservable<TRequestOptions> {
    Object.assign(
      this[kContext],
      omit(options as any, ['requests', 'headers']),
    );
    return this;
  }

  header(headers: HeadersInit): this;
  header(name: string, value?: string | number | boolean | null): this;
  header(
    arg0: string | HeadersInit,
    value?: string | number | boolean | null,
  ): this {
    const target = this[kContext].headers;
    if (typeof arg0 === 'object') {
      const h = arg0 instanceof Headers ? arg0 : new Headers(arg0);
      h.forEach((v, k) => {
        if (k.toLowerCase() === 'set-cookie') {
          target.append(k, v);
        } else target.set(k, v);
      });
      return this;
    }
    if (value == null || value === '') target.delete(arg0);
    else target.append(arg0, String(value));
    return this;
  }

  param(
    params:
      URLSearchParamsInit | Record<string, string | number | boolean | Date>,
  ): this;
  param(name: string, value: any): this;
  param(arg0: string | URLSearchParamsInit, value?: any): this {
    if (value && typeof value === 'object') {
      value = JSON.stringify(value);
    }
    const target = this[kContext].url.searchParams;
    if (typeof arg0 === 'object') {
      if (typeof arg0.forEach === 'function') {
        arg0.forEach((v: any, k: any) => target.set(String(k), String(v)));
      } else {
        Object.entries(arg0).forEach(entry =>
          target.set(String(entry[0]), String(entry[1])),
        );
      }
      return this;
    }
    if (value == null) target.delete(arg0);
    else target.set(arg0, String(value));
    return this;
  }

  getResponses(): Promise<HttpResponse[]> {
    return lastValueFrom(this);
  }

  /**
   * Parses a multipart/mixed body buffer into individual parts using multipasta,
   * invoking `onPart` as soon as each part is fully read rather than buffering
   * the whole set. Each part contains its headers (lowercased keys) and raw
   * body buffer. The stream-based approach handles large payloads without
   * buffering the entire response in memory at once.
   */
  protected async _parseMultipartParts(
    buf: Buffer,
    contentTypeHeader: string,
    onPart: (part: { headers: Record<string, string>; body: Buffer }) => void,
  ): Promise<void> {
    const stream = MP.make({
      headers: { 'content-type': contentTypeHeader },
      isFile: () => true, // treat all parts as file streams (no Content-Disposition)
    });

    /* Pipe the buffer into the multipasta Duplex and start it flowing */
    Readable.from(buf).pipe(stream);
    stream.resume();

    for await (const part of stream) {
      /* Flatten headers to lowercase string keys */
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(part.info.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v)
          ? v.join(', ')
          : String(v ?? '');
      }

      let body: Buffer;
      if (part._tag === 'Field') {
        body = Buffer.from(part.value);
      } else {
        /* FileStream — collect chunks via async iteration */
        const chunks: Buffer[] = [];
        for await (const chunk of part) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }

      onPart({ headers, body });
    }
  }
  /**
   * Parses a raw HTTP/1.1 response buffer into an {@link HttpResponse} using
   * `@browsery/http-parser`, mirroring the server-side request parsing in
   * `@opra/http`'s `IncomingMessageHost.from()`.
   */
  protected _parseRawHttpResponse(buf: Buffer): HttpResponse {
    const parser = new HTTPParser(HTTPParser.RESPONSE);
    let status = 200;
    let statusText = 'OK';
    const headers = new Headers();
    const bodyChunks: Buffer[] = [];

    parser[HTTPParser.kOnHeadersComplete] = (info: HeaderInfo) => {
      status = info.statusCode;
      statusText = info.statusMessage;
      for (let i = 0; i < info.headers.length; i += 2) {
        headers.append(info.headers[i], info.headers[i + 1]);
      }
    };
    parser[HTTPParser.kOnBody] = (
      chunk: Buffer,
      offset: number,
      length: number,
    ) => {
      bodyChunks.push(chunk.subarray(offset, offset + length));
    };

    parser.execute(buf);
    parser.finish();

    const bodyBuf = Buffer.concat(bodyChunks);
    let body: any;
    if (bodyBuf.length > 0) {
      const contentType = headers.get('content-type') || '';
      if (typeIs.is(contentType, ['json', 'application/*+json'])) {
        try {
          body = JSON.parse(bodyBuf.toString('utf-8'));
          if (typeof body === 'string') body = JSON.parse(body);
        } catch {
          body = bodyBuf.toString('utf-8');
        }
      } else if (typeIs.is(contentType, ['text'])) {
        body = bodyBuf.toString('utf-8');
      } else {
        body = bodyBuf.buffer.slice(
          bodyBuf.byteOffset,
          bodyBuf.byteOffset + bodyBuf.byteLength,
        );
      }
    }

    return new HttpResponse({ status, statusText, headers, body });
  }
}
