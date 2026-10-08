import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import * as path from 'node:path';
import { FetchBackend, HttpResponse } from '@opra/client';
import { ApiExpect } from './api-expect/api-expect.js';
import type { OpraTestClient } from './test-client.js';

declare type RequestListener = (
  req: IncomingMessage,
  res: ServerResponse,
) => void;

export type ResponseExt = { expect: ApiExpect };

/**
 * Test specific implementation of {@link FetchBackend} for API testing.
 *
 * @class TestBackend
 */
export class TestBackend extends FetchBackend {
  protected _server: Server;

  /**
   * Creates a new instance of TestBackend.
   *
   * @param app The server or request listener to test.
   * @param options Configuration options.
   */
  constructor(app: Server | RequestListener, options?: OpraTestClient.Options) {
    super(
      options?.basePath
        ? path.posix.join('http://tempuri.org', options.basePath)
        : 'http://tempuri.org',
      options,
    );
    this._server = app instanceof Server ? app : createServer(app);
  }

  /**
   * Sends the actual HTTP request by starting the server if necessary.
   *
   * @param req The request to send.
   * @returns A promise that resolves to the response.
   * @protected
   */
  protected async send(req: Request): Promise<Response> {
    const url = new URL(req.url);
    // Set protocol to HTTP
    url.protocol = 'http';

    // Apply original host to request header
    if (url.host !== 'opra.test' && req.headers.get('host') == null)
      req.headers.set('host', url.host);

    /* Only a server this backend started is one it may close. A test that
       listens itself (`app.listen(0)`) goes on using that server after the
       request - closing it left every later call, including ones made with
       something other than this client, with ECONNREFUSED. */
    let startedHere = false;
    if (!this._server.listening) {
      startedHere = true;
      await new Promise<void>(resolve => {
        this._server.listen(0, '127.0.0.1', () => resolve());
      });
    }

    try {
      const address = this._server.address() as AddressInfo;
      url.host = '127.0.0.1';
      url.port = address.port.toString();
      /* Read into a byte array rather than handing `fetch` the `Request`
         itself, whose `body` is a one-shot stream. On a 401 undici replays
         the request with credentials (httpNetworkOrCacheFetch) and a stream
         body cannot be replayed: the retry fails with "expected non-null
         body source", which surfaces as `TypeError: fetch failed` instead
         of the 401 the test is asserting on. A GET or any other bodyless
         request never reached that path, which is why only requests with a
         body were affected. */
      const body = req.body ? new Uint8Array(await req.arrayBuffer()) : null;
      return await fetch(url.toString(), {
        method: req.method,
        headers: req.headers,
        body,
        redirect: req.redirect,
        signal: req.signal,
      });
    } finally {
      if (startedHere && this._server.listening) {
        await new Promise<void>(resolve => {
          this._server.once('close', () => resolve());
          this._server.close();
          this._server.unref();
        });
      }
    }
  }

  /**
   * Creates a {@link HttpResponse} instance with an added `expect` property.
   *
   * @param init The response initiator parameters.
   * @returns A new HttpResponse instance with ApiExpect.
   * @protected
   */
  protected createResponse(init: HttpResponse.Initiator) {
    const response = new HttpResponse(init) as HttpResponse & ResponseExt;
    response.expect = new ApiExpect(response);
    return response;
  }
}

/**
 * Namespace for {@link TestBackend} related types and interfaces.
 *
 * @namespace TestBackend
 */
export namespace TestBackend {
  /** Configuration options for TestBackend */
  export interface Options extends FetchBackend.Options {}
}
