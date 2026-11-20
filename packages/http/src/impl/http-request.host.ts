/*
  Some parts of this file contains codes from open source express library
  https://github.com/expressjs
 */
import typeIs from '@browsery/type-is';
import accepts from 'accepts';
import fresh from 'fresh';
import type { HttpRequest } from '../interfaces/http-request.interface.js';
import { BodyReader } from '../utils/body-reader.js';
import { parseRange, type ParseRangeOptions } from '../utils/parse-range.js';

export interface HttpRequestHost extends HttpRequest {}
const ENCODING_PATTERN = /encoding=([^;]+)/;

export class HttpRequestHost {
  body?: any;

  get protocol(): string {
    const proto = this.header('X-Forwarded-Proto') || 'http';
    const index = proto.indexOf(',');
    return index !== -1 ? proto.substring(0, index).trim() : proto.trim();
  }

  get secure(): boolean {
    return this.protocol === 'https';
  }

  get hostname(): string | undefined {
    let host = this.get('X-Forwarded-Host');
    if (!host) {
      host = this.get('Host');
    } else if (host.indexOf(',') !== -1) {
      // Note: X-Forwarded-Host is normally only ever a
      //       single value, but this is to be safe.
      host = host.substring(0, host.indexOf(',')).trim();
    }

    if (host) {
      // IPv6 literal support
      const offset = host[0] === '[' ? host.indexOf(']') + 1 : 0;
      const index = host.indexOf(':', offset);
      return index !== -1 ? host.substring(0, index) : host;
    }
    return '';
  }

  get fresh(): boolean {
    const method = this.method;
    // GET or HEAD for weak freshness validation only
    if (method !== 'GET' && method !== 'HEAD') return false;
    const status = this.res?.statusCode;
    // 2xx or 304 as per rfc2616 14.26
    if ((status >= 200 && status < 300) || status === 304) {
      return fresh(this.headers, {
        etag: this.res.getHeader('ETag'),
        'last-modified': this.res.getHeader('Last-Modified'),
      });
    }
    return false;
  }

  get xhr(): boolean {
    const val = this.get('X-Requested-With') || '';
    return val.toLowerCase() === 'xmlhttprequest';
  }

  header(name: string): any {
    name = name.toLowerCase();
    const headers = this.headers;
    switch (name) {
      case 'referer':
        return headers.referer || headers.referrer;
      case 'referrer':
        return headers.referrer || headers.referer;
      default:
        return headers[name];
    }
  }

  get(name: string): any {
    return this.header(name);
  }

  accepts(...types: any): any {
    const accept = accepts(this as any);
    return accept.types.call(accept, ...types);
  }

  acceptsCharsets(...charsets: any) {
    const accept = accepts(this as any);
    return accept.charsets.call(accept, ...charsets) as any;
  }

  acceptsEncodings(...encoding: any): any {
    const accept = accepts(this as any);
    // eslint-disable-next-line prefer-spread
    return accept.encodings.apply(accept, encoding);
  }

  acceptsLanguages(...lang: any): any {
    const accept = accepts(this as any);
    // eslint-disable-next-line prefer-spread
    return accept.languages.apply(accept, lang);
  }

  characterEncoding(): string | undefined {
    const contentType = this.header('content-type');
    return contentType ? ENCODING_PATTERN.exec(contentType)?.[1] : undefined;
  }

  is(type: string | string[], ...otherTypes: string[]): string | false | null {
    const types = Array.isArray(type) ? type : [type];
    if (otherTypes.length) types.push(...otherTypes);
    const contentType = this.header('content-type');
    return contentType ? typeIs.is(contentType as any, types) : null;
  }

  range(size: number, options?: ParseRangeOptions) {
    const range = this.header('range');
    if (!range) return;
    return parseRange(size, range, options);
  }

  async readBody(
    options: BodyReader.Options,
  ): Promise<string | Buffer | undefined> {
    if (this.body === undefined)
      this.body = await BodyReader.read(this, options);
    return this.body;
  }
}
