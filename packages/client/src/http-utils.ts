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
 * Returns a Buffer for synchronous body types (null, string, Buffer, plain object)
 * or a PassThrough stream for readable/stream bodies.
 */
export function serializeHttpRequest(ctx: {
  method: string;
  url: URL | string;
  headers: Headers;
  body?: any;
}): Buffer | PassThrough {
  const url = ctx.url instanceof URL ? ctx.url : new URL(String(ctx.url));
  const requestLine = `${ctx.method} ${url.pathname}${url.search} HTTP/1.1${CRLF}`;
  const rawBody = ctx.body;
  let bodyBuffer: Buffer | undefined;
  let defaultContentType: string | undefined;

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
    if (lower === 'content-type') hasContentType = true;
    if (lower === 'content-length') hasContentLength = true;
    headerLines += `${name}: ${value}${CRLF}`;
  });
  if (defaultContentType && !hasContentType && bodyBuffer.length > 0) {
    headerLines += `Content-Type: ${defaultContentType}${CRLF}`;
  }
  if (!hasContentLength && bodyBuffer.length > 0) {
    headerLines += `Content-Length: ${bodyBuffer.length}${CRLF}`;
  }
  headerLines += CRLF;

  return Buffer.concat([Buffer.from(headerLines, 'utf-8'), bodyBuffer]);
}
