import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { expect } from 'expect';
import { OpraTestClient } from '../src/index.js';

/** Answers 401 under `/secret` and 200 everywhere else, echoing back
 *  whatever body it was given so a test can check the body survived. */
function listener(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const received = Buffer.concat(chunks).toString('utf-8');
    const status = req.url?.startsWith('/secret') ? 401 : 200;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status === 401 ? { errors: [] } : { received }));
  });
}

describe('testing:TestBackend', () => {
  describe('a request with a body', () => {
    it('Should return the 401 rather than failing the fetch', async () => {
      // undici replays a 401 with credentials, and the body used to be
      // handed over as the `Request`'s own one-shot stream - which cannot
      // be replayed, so the replay died with "expected non-null body
      // source" and the caller saw `TypeError: fetch failed` instead of
      // the status it was asserting on.
      const client = new OpraTestClient(listener);
      const response = await client.post('secret', { key: 'x' }).getResponse();
      expect(response.status).toStrictEqual(401);
    });

    it('Should still deliver the body', async () => {
      const client = new OpraTestClient(listener);
      const response = await client.post('echo', { key: 'x' }).getResponse();
      expect(response.status).toStrictEqual(200);
      expect(JSON.parse(response.body.received)).toEqual({ key: 'x' });
    });
  });

  describe('server lifetime', () => {
    it('Should leave a server it did not start alone', async () => {
      // A test that listens itself goes on using that server afterwards -
      // including with something other than this client.
      const server = createServer(listener);
      await new Promise<void>(resolve => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      const port = (server.address() as any).port;
      try {
        const client = new OpraTestClient(server);
        await client.get('ok').getResponse();
        expect(server.listening).toStrictEqual(true);
        // Reachable by anything, not just by this client.
        const direct = await fetch(`http://127.0.0.1:${port}/ok`);
        expect(direct.status).toStrictEqual(200);
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    });

    it('Should close a server it started itself', async () => {
      const server = createServer(listener);
      const client = new OpraTestClient(server);
      await client.get('ok').getResponse();
      expect(server.listening).toStrictEqual(false);
    });
  });
});
