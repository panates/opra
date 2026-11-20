import { HttpRequest } from '@opra/http';
import { expect } from 'expect';

describe('http:HttpIncoming', () => {
  it('Should wrap HttpIncomingMessage', async () => {
    const msg = HttpRequest.create({
      method: 'get',
    });
    expect(msg.method).toStrictEqual('GET');
  });

  it('Should create with HttpIncomingMessage initiator', async () => {
    const msg = HttpRequest.create({ method: 'get' });
    expect(msg.method).toStrictEqual('GET');
  });

  it('Should return protocol', async () => {
    const msg = HttpRequest.create({ method: 'get' });
    expect(msg.protocol).toStrictEqual('http');
    expect(msg.secure).toStrictEqual(false);
    msg.headers['x-forwarded-proto'] = 'https';
    expect(msg.protocol).toStrictEqual('https');
    expect(msg.secure).toStrictEqual(true);
  });

  it('Should return hostname', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Host', 'tempuri.org'],
    });
    expect(msg.hostname).toStrictEqual('tempuri.org');
    msg.headers['x-forwarded-host'] = 'anyuri.org';
    expect(msg.hostname).toStrictEqual('anyuri.org');
    msg.headers['x-forwarded-host'] = 'anyuri.org,otheruri.org';
    expect(msg.hostname).toStrictEqual('anyuri.org');
  });

  it('Should accepts() check if the given type(s) is acceptable', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Accept', 'text/*, application/json'],
    });
    expect(msg.accepts('html')).toStrictEqual('html');
    expect(msg.accepts('application/json')).toStrictEqual('application/json');
    expect(msg.accepts('json')).toStrictEqual('json');
    expect(msg.accepts('jpeg')).toStrictEqual(false);
  });

  it('Should acceptsCharsets() check if given charset is acceptable', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Accept-Charset', 'utf-8, ascii'],
    });
    expect(msg.acceptsCharsets('utf-8')).toStrictEqual('utf-8');
    expect(msg.acceptsCharsets('ascii')).toStrictEqual('ascii');
    expect(msg.acceptsCharsets('utf-16')).toStrictEqual(false);
  });

  it('Should acceptsEncodings() check given encoding is acceptable', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Accept-Encoding', 'gzip, compress;q=0.2'],
    });
    expect(msg.acceptsEncodings('gzip')).toStrictEqual('gzip');
    expect(msg.acceptsEncodings('compress')).toStrictEqual('compress');
    expect(msg.acceptsEncodings('deflate')).toStrictEqual(false);
  });

  it('Should acceptsLanguages() check given language is acceptable', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Accept-Language', 'en;q=0.8, es, pt'],
    });
    expect(msg.acceptsLanguages('en')).toStrictEqual('en');
    expect(msg.acceptsLanguages('pt')).toStrictEqual('pt');
    expect(msg.acceptsEncodings('fr')).toStrictEqual(false);
  });

  it('Should is() check content-type matches given value', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Content-Type', 'text/html'],
    });
    expect(msg.is('html')).toStrictEqual('html');
    expect(msg.is('text', 'html')).toStrictEqual('html');
    expect(msg.is(['text', 'html'])).toStrictEqual('html');
    expect(msg.is('text')).toStrictEqual(false);
    expect(msg.is('text/*')).toStrictEqual('text/html');
    expect(msg.is('json')).toStrictEqual(false);
  });

  it('Should range() return parsed "Range" header', async () => {
    const msg = HttpRequest.create({
      method: 'get',
      headers: ['Range', 'bytes=50-55,0-10,5-10,56-60'],
    });
    const result: any = msg.range(100);
    expect(Array.isArray(result)).toStrictEqual(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toEqual({ start: 50, end: 55 });
  });

  describe('range()', () => {
    const range = (header: string | undefined, size = 100, options?: any) =>
      HttpRequest.create({
        method: 'get',
        headers: header === undefined ? [] : ['Range', header],
      }).range(size, options);

    it('Should return undefined when there is no "Range" header', () => {
      expect(range(undefined)).toBeUndefined();
    });

    it('Should return the ranges in the order given, with their type', () => {
      const result: any = range('bytes=50-55,0-10,-20,90-');
      expect([...result]).toStrictEqual([
        { start: 50, end: 55 },
        { start: 0, end: 10 },
        { start: 80, end: 99 },
        { start: 90, end: 99 },
      ]);
      expect(result.type).toStrictEqual('bytes');
    });

    it('Should combine overlapping and adjacent ranges', () => {
      const result: any = range('bytes=50-55,0-10,5-10,56-60', 100, {
        combine: true,
      });
      expect([...result]).toStrictEqual([
        { start: 50, end: 60 },
        { start: 0, end: 10 },
      ]);
      expect(result.type).toStrictEqual('bytes');
    });

    it('Should cap the end position to the size', () => {
      expect([...(range('bytes=0-200') as any)]).toStrictEqual([
        { start: 0, end: 99 },
      ]);
    });

    it('Should skip unsatisfiable ranges', () => {
      expect([...(range('bytes=0-10,200-') as any)]).toStrictEqual([
        { start: 0, end: 10 },
      ]);
    });

    it('Should return -1 when no range is satisfiable', () => {
      expect(range('bytes=200-300')).toStrictEqual(-1);
      expect(range('bytes=0-', 0)).toStrictEqual(-1);
    });

    it('Should return -2 when the header is malformed', () => {
      expect(range('bytes')).toStrictEqual(-2);
      expect(range('bytes=x-')).toStrictEqual(-2);
      expect(range('bytes=0-10,x-')).toStrictEqual(-2);
      expect(range('bytes=50-20')).toStrictEqual(-2);
    });

    it('Should return -1 for an invalid size instead of throwing', () => {
      expect(range('bytes=0-1', -1)).toStrictEqual(-1);
      expect(range('bytes=0-1', NaN)).toStrictEqual(-1);
    });

    it('Should floor a fractional size', () => {
      expect([...(range('bytes=-1', 100.5) as any)]).toStrictEqual([
        { start: 99, end: 99 },
      ]);
    });
  });
});
