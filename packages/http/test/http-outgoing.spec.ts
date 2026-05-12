import { HttpOutgoing, NodeOutgoingMessage } from '@opra/http';
import { expect } from 'expect';

describe('http:HttpOutgoing', () => {
  it('Should wrap HttpOutgoingMessage', async () => {
    const msg = HttpOutgoing.from(
      NodeOutgoingMessage.from({
        req: {} as any,
        statusCode: 200,
        statusMessage: 'OK',
      }),
    );
    expect(msg.statusCode).toStrictEqual(200);
    expect(msg.statusMessage).toStrictEqual('OK');
  });

  it('Should create with HttpOutgoingMessage initiator', async () => {
    const msg = HttpOutgoing.from({
      req: {} as any,
      statusCode: 200,
      statusMessage: 'OK',
    });
    expect(msg.statusCode).toStrictEqual(200);
    expect(msg.statusMessage).toStrictEqual('OK');
  });

  it('Should create using init object', async () => {
    const msg = HttpOutgoing.from({
      req: {} as any,
      statusCode: 200,
      statusMessage: 'OK',
      headers: ['Accept', 'text/html'],
    });
    expect(msg.statusCode).toStrictEqual(200);
    expect(msg.statusMessage).toStrictEqual('OK');
    expect(msg.getHeaders()).toEqual({ accept: 'text/html' });
  });

  it('Should attachment(name) set Content-Disposition header', async () => {
    const msg = HttpOutgoing.from({ req: {} as any });
    msg.attachment('path/to/logo.png');
    expect(msg.getHeader('Content-Disposition')).toStrictEqual(
      'attachment; filename=logo.png',
    );
  });

  it('Should cookie() set Set-Cookie header', async () => {
    const msg = HttpOutgoing.from({ req: {} as any });
    msg.cookie('c1', 'x', { path: '/api' });
    expect(msg.getHeader('Set-Cookie')).toStrictEqual('c1=x; Path=/api');
  });

  it('Should clearCookie() delete Set-Cookie header', async () => {
    const msg = HttpOutgoing.from({ req: {} as any });
    msg.cookie('c1', 'x', { path: '/api' });
    expect(msg.getHeader('Set-Cookie')).toStrictEqual('c1=x; Path=/api');
    msg.clearCookie('c1');
    expect(String(msg.getHeader('Set-Cookie'))).toMatch(/Expires/);
  });

  it('Should contentType(type) or type(type) set Content-Type header', async () => {
    const msg = HttpOutgoing.from({ req: {} as any });
    msg.contentType('text/xml');
    expect(msg.getHeader('Content-Type')).toStrictEqual(
      'text/xml; charset=utf-8',
    );
    msg.contentType('text/html');
    expect(msg.getHeader('Content-Type')).toStrictEqual(
      'text/html; charset=utf-8',
    );
  });

  it('Should links() set Link header', async () => {
    const msg = HttpOutgoing.from({ req: {} as any });
    msg.links({ next: '/next', prior: '/prior' });
    expect(msg.getHeader('Link')).toStrictEqual(
      '</next>; rel="next", </prior>; rel="prior"',
    );
  });

  it('Should redirect() set Location and statusCode', async () => {
    const msg = HttpOutgoing.from({ req: {} as any });
    msg.redirect('www.newuri.org');
    expect(msg.getHeader('Location')).toStrictEqual('www.newuri.org');
    expect(msg.statusCode).toStrictEqual(302);
  });

  it('Should status() set status code', async () => {
    const msg = HttpOutgoing.from({
      req: {} as any,
      statusCode: 200,
    });
    expect(msg.statusCode).toStrictEqual(200);
    msg.status(400);
    expect(msg.statusCode).toStrictEqual(400);
  });

  it('Should sendStatus() set status code and body as status message', async () => {
    const msg = HttpOutgoing.from({
      req: {} as any,
      statusCode: 200,
    });
    expect(msg.statusCode).toStrictEqual(200);
    msg.sendStatus(400);
    expect(msg.statusCode).toStrictEqual(400);
  });
});
