/*
  Some parts of this file contains codes from open source express library
  https://github.com/expressjs
 */

import type { CipherKey } from 'node:crypto';
import path from 'node:path';
import { HttpStatusCode } from '@opra/common';
import contentDisposition from 'content-disposition';
import contentType from 'content-type';
import * as cookie from 'cookie';
import cookieSignature from 'cookie-signature';
import encodeUrl from 'encodeurl';
import mime from 'mime-types';
import { toString } from 'putil-varhelpers';
import vary from 'vary';
import type {
  CookieOptions,
  HttpOutgoing,
} from '../interfaces/http-outgoing.interface.js';

const charsetRegExp = /;\s*charset\s*=/;

export interface HttpOutgoingHost extends HttpOutgoing {}

export class HttpOutgoingHost {
  attachment(filename?: string): this {
    if (filename) {
      this.contentType(path.extname(filename));
      this.setHeader(
        'Content-Disposition',
        contentDisposition.create(path.basename(filename), {
          type: 'attachment',
        }),
      );
    }
    return this;
  }

  contentType(type: any): this {
    const ct = type.indexOf('/') === -1 ? mime.lookup(type) : type;
    this.setHeader('Content-Type', ct);
    return this;
  }

  setHeader(field: string | Record<string, any>, val?: any): this {
    const setHeader: Function = Object.getPrototypeOf(this).setHeader;
    if (typeof field === 'object') {
      for (const [k, v] of Object.entries(field)) {
        this.setHeader(k, v);
      }
      return this;
    }
    const fieldLower = field.toLowerCase();
    let value = Array.isArray(val) ? val.map(String) : val ? String(val) : '';

    // add charset to content-type
    if (fieldLower === 'content-type') {
      if (Array.isArray(value)) {
        throw new TypeError('Content-Type cannot be set to an Array');
      }
      if (!charsetRegExp.test(value)) {
        const charset = mime.charsets.lookup(value.split(';')[0]);
        if (charset) value += '; charset=' + charset.toLowerCase();
      }
    }
    setHeader.call(this, field, value);
    return this;
  }

  clearCookie(name: string, options: CookieOptions): this {
    const opts = {
      expires: new Date(1),
      path: '/',
      ...options,
    };
    return this.cookie(name, '', opts);
  }

  cookie(name: string, value: any, options?: CookieOptions): this {
    const opts = { ...options };
    let val =
      typeof value === 'object' ? 'j:' + JSON.stringify(value) : String(value);

    if (opts.signed) {
      const secret: CipherKey | undefined = opts.secret || this.req?.secret;
      if (!secret) throw new Error('"secret" required for signed cookies');
      val = 's:' + cookieSignature.sign(val, secret);
    }

    if (opts.maxAge != null) {
      const maxAge = opts.maxAge - 0;
      if (!isNaN(maxAge)) {
        opts.expires = new Date(Date.now() + maxAge);
        opts.maxAge = Math.floor(maxAge / 1000);
      }
    }

    if (opts.path == null) opts.path = '/';

    this.appendHeader('Set-Cookie', cookie.serialize(name, String(val), opts));

    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  sendStatus(statusCode: number): this {
    const body = HttpStatusCode[statusCode] || String(statusCode);
    this.statusCode = statusCode;
    this.contentType('txt');
    return this.send(body);
  }

  links(links: Record<string, string>): this {
    let link = this.getHeader('Link') || '';
    if (link) link += ', ';
    this.setHeader(
      'Link',
      link +
        Object.keys(links)
          .map(rel => '<' + links[rel] + '>; rel="' + rel + '"')
          .join(', '),
    );
    return this;
  }

  location(url: string) {
    let loc = url;

    // "back" is an alias for the referrer
    if (url === 'back') loc = this.req?.get('Referrer') || '/';

    // set location
    return this.setHeader('Location', encodeUrl(loc));
  }

  redirect(arg0: string | number, arg1?: string) {
    const address = String(arg1 || arg0);
    const status = typeof arg0 === 'number' ? arg0 : 302;
    // Set location header
    this.location(address);
    // Respond
    this.statusCode = status;
    this.end();
  }

  send(body: any) {
    let chunk = body;
    let encoding: BufferEncoding | undefined;
    const req = this.req;
    let ctype = toString(this.getHeader('Content-Type'));

    if (typeof chunk !== 'string') {
      if (chunk === null) chunk = '';
      else if (Buffer.isBuffer(chunk)) {
        if (!ctype) this.contentType('bin');
      } else {
        ctype = 'json';
        chunk = JSON.stringify(chunk);
      }
    }

    // write strings in utf-8
    if (typeof chunk === 'string') {
      encoding = 'utf-8';
      this.setHeader('Content-Type', setCharset(ctype || 'txt', encoding));
    }

    // populate Content-Length
    let len: number;
    if (chunk !== undefined) {
      if (Buffer.isBuffer(chunk)) {
        // get length of Buffer
        len = chunk.length;
      } else if (chunk.length < 1000) {
        // just calculate length when small chunk
        len = Buffer.byteLength(chunk, encoding);
      } else {
        // convert chunk to Buffer and calculate
        chunk = Buffer.from(chunk, encoding);
        encoding = undefined;
        len = chunk.length;
      }
      this.setHeader('Content-Length', len);
    }

    // freshness
    if (req?.fresh) this.statusCode = 304;

    // strip irrelevant headers
    if (this.statusCode === 204 || this.statusCode === 304) {
      this.removeHeader('Content-Type');
      this.removeHeader('Content-Length');
      this.removeHeader('Transfer-Encoding');
      chunk = '';
    }

    // alter headers for 205
    if (this.statusCode === 205) {
      this.setHeader('Content-Length', '0');
      this.removeHeader('Transfer-Encoding');
      chunk = '';
    }

    if (req?.method === 'HEAD') {
      // skip body for HEAD
      this.end();
    } else {
      // respond
      if (encoding) this.end(chunk, encoding);
      else this.end(chunk);
    }

    return this;
  }

  vary(field: string) {
    vary(this as any, field);
    return this;
  }
}

function setCharset(type: string, charset: string): string {
  if (!(type && charset)) return type;
  // parse type
  const parsed = contentType.parse(type);
  // set charset
  parsed.parameters.charset = charset;
  // format type
  return contentType.format(parsed);
}
