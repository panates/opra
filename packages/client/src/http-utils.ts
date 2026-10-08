import { PassThrough } from 'node:stream';
import { Buffer } from 'buffer';

const CRLF = '\r\n';

export function urlPath(strings: string[], ...values: any[]) {
  let str = '';
  let i: number;
  for (i = 0; i < strings.length; i++) {
    str += strings[0] + encodeURIComponent(values[i]);
  }
  return str;
}

/**
 * Serializes an HTTP request context into raw HTTP/1.1 bytes.
 * Returns a Buffer for body types that can be read into one, or a
 * PassThrough stream for readable/stream bodies.
 *
 * Asynchronous because of the web body types: a `Blob`/`File` is read with
 * `arrayBuffer()`, and a `FormData` is encoded by the platform. Everything
 * else resolves without ever yielding.
 */
export async function serializeHttpRequest(ctx: {
  method: string;
  url: URL | string;
  headers: Headers;
  body?: any;
}): Promise<Buffer | PassThrough> {
  const url = ctx.url instanceof URL ? ctx.url : new URL(String(ctx.url));
  const requestLine = `${ctx.method} ${url.pathname}${url.search} HTTP/1.1${CRLF}`;
  const rawBody = ctx.body;
  let bodyBuffer: Buffer | undefined;
  let defaultContentType: string | undefined;
  /* Unlike `defaultContentType`, this one wins over a header the caller
     set: it carries the multipart boundary this function generated, which
     the caller had no way of knowing. */
  let forcedContentType: string | undefined;

  if (rawBody == null) {
    bodyBuffer = Buffer.alloc(0);
  } else if (typeof rawBody === 'string') {
    bodyBuffer = Buffer.from(rawBody, 'utf-8');
    defaultContentType = 'text/plain; charset="UTF-8"';
  } else if (typeof rawBody === 'number' || typeof rawBody === 'boolean') {
    bodyBuffer = Buffer.from(String(rawBody), 'utf-8');
    defaultContentType = 'text/plain; charset="UTF-8"';
  } else if (Buffer.isBuffer(rawBody)) {
    bodyBuffer = rawBody;
    defaultContentType = 'application/octet-stream';
  } else if (typeof Blob !== 'undefined' && rawBody instanceof Blob) {
    /* A `Blob` or a `File` - what a browser actually has in hand for an
       upload. None of the checks below recognize one, so it used to fall
       through to the JSON branch at the end and get sent as the string
       "{}": a bundled upload silently delivered an empty object. */
    bodyBuffer = Buffer.from(await rawBody.arrayBuffer());
    defaultContentType = rawBody.type || 'application/octet-stream';
  } else if (typeof FormData !== 'undefined' && rawBody instanceof FormData) {
    /* Same silent "{}" as a `Blob`, and the other half of how a browser
       sends an upload. `Response` is what encodes it: generating a
       boundary, escaping part headers and framing each part by hand is
       exactly the work the platform already does correctly in both
       browsers and Node. */
    const encoded = new Response(rawBody);
    bodyBuffer = Buffer.from(await encoded.arrayBuffer());
    forcedContentType = encoded.headers.get('content-type') || undefined;
  } else if (rawBody instanceof URLSearchParams) {
    bodyBuffer = Buffer.from(rawBody.toString(), 'utf-8');
    defaultContentType = 'application/x-www-form-urlencoded; charset="UTF-8"';
  } else if (rawBody instanceof ArrayBuffer) {
    bodyBuffer = Buffer.from(rawBody);
    defaultContentType = 'application/octet-stream';
  } else if (ArrayBuffer.isView(rawBody)) {
    /* A plain `Uint8Array` (or any other view) - `Buffer.isBuffer` above
       is false for one, and in a browser there is no `Buffer` to begin
       with. Copied by offset/length rather than from `.buffer`, which for
       a view over a larger buffer would send the whole thing. */
    bodyBuffer = Buffer.from(
      rawBody.buffer,
      rawBody.byteOffset,
      rawBody.byteLength,
    );
    defaultContentType = 'application/octet-stream';
  } else if (
    /* Node.js Readable */ typeof (rawBody as any).pipe === 'function' ||
    /* Web ReadableStream */ typeof (rawBody as any).getReader === 'function'
  ) {
    /* Streaming body — write header preamble then pipe body */
    const pass = new PassThrough();
    let headerLines = requestLine;
    ctx.headers.forEach((value: string, name: string) => {
      headerLines += `${name}: ${value}${CRLF}`;
    });
    headerLines += CRLF;
    pass.write(Buffer.from(headerLines, 'utf-8'));
    if (typeof (rawBody as any).pipe === 'function') {
      (rawBody as NodeJS.ReadableStream).pipe(pass);
    } else {
      /* Web ReadableStream */
      (async () => {
        try {
          for await (const chunk of rawBody as unknown as AsyncIterable<Uint8Array>) {
            pass.write(chunk);
          }
          pass.end();
        } catch (err) {
          pass.destroy(err as Error);
        }
      })();
    }
    return pass;
  } else {
    /* Plain object → JSON */
    bodyBuffer = Buffer.from(JSON.stringify(rawBody), 'utf-8');
    defaultContentType = 'application/json; charset="UTF-8"';
  }

  /* Build header section */
  let headerLines = requestLine;
  let hasContentType = false;
  let hasContentLength = false;
  ctx.headers.forEach((value: string, name: string) => {
    const lower = name.toLowerCase();
    if (lower === 'content-type') {
      hasContentType = true;
      /* Dropped in favour of the generated one below - keeping a
         boundary-less `multipart/form-data` here would frame the body in a
         way nothing can parse. */
      if (forcedContentType) return;
    }
    if (lower === 'content-length') hasContentLength = true;
    headerLines += `${name}: ${value}${CRLF}`;
  });
  if (forcedContentType) {
    headerLines += `Content-Type: ${forcedContentType}${CRLF}`;
  } else if (defaultContentType && !hasContentType && bodyBuffer.length > 0) {
    headerLines += `Content-Type: ${defaultContentType}${CRLF}`;
  }
  if (!hasContentLength && bodyBuffer.length > 0) {
    headerLines += `Content-Length: ${bodyBuffer.length}${CRLF}`;
  }
  headerLines += CRLF;

  return Buffer.concat([Buffer.from(headerLines, 'utf-8'), bodyBuffer]);
}
