import { expect } from 'expect';
import { FilesController } from '../../http/test/_support/test-api/index.js';
import { ClientError, HttpResponse, OpraHttpClient } from '../src/index.js';
import type { MockServer } from './_support/create-mock-server.js';
import { createMockServer } from './_support/create-mock-server.js';

describe('client:OpraClient:bundle', () => {
  let app: MockServer;
  let client: OpraHttpClient;

  after(() => app.server.close());

  before(async () => {
    app = await createMockServer();
    client = new OpraHttpClient(app.baseUrl, { document: app.api });
  });

  it('Should send bundled requests as a single multipart POST', async () => {
    const requestCountBefore = app.requestCount;
    const r1 = client.get('Customers@1');
    const r2 = client.request('auth/login', { params: { user: 'john' } });

    const responses = await client.bundle([r1, r2]).getResponses();

    expect(responses.length).toBe(2);
    expect(responses[0]).toBeInstanceOf(HttpResponse);
    expect(responses[0].status).toBe(200);
    expect(responses[0].body.payload._id).toBe(1);
    expect(responses[1].status).toBe(200);
    expect(responses[1].body).toEqual({ user: 'john', token: '123456' });

    // Only the single POST /$bundle hit the server as a real connection — the
    // other 2 counts are the sub-requests dispatched internally through the
    // same Express instance by handleBundle(), not separate client calls
    expect(app.requestCount - requestCountBefore).toBe(3);
  });

  it('Should send a FormData body in a bundled request', async () => {
    // What an upload from a browser actually looks like. Every check in
    // `serializeHttpRequest` used to miss both `FormData` and `Blob`, so
    // the body fell through to the plain-object branch and was sent as
    // the JSON string "{}" - no error anywhere, just an empty request.
    const form = new FormData();
    form.append('notes', 'Joe Blow');
    form.append(
      'file1',
      new Blob(['... contents of file1.txt ...'], { type: 'text/plain' }),
      'file1.txt',
    );
    const r1 = client.post('Files', form);

    const [response] = await client.bundle([r1]).getResponses();

    expect(response.status).toBe(200);
    const parts = FilesController.lastPost;
    expect(parts.map((p: any) => p.field)).toEqual(['notes', 'file1']);
    expect(parts[0].value).toStrictEqual('Joe Blow');
  });

  it('Should finalize individual requests after the bundle completes (subscribe after send)', async () => {
    const requestCountBefore = app.requestCount;
    const r1 = client.get('Customers@1');
    const r2 = client.request('auth/login', { params: { user: 'john' } });

    await client.bundle([r1, r2]).getResponses();

    const [body1, body2] = await Promise.all([r1.getBody(), r2.getBody()]);
    expect(body1.payload._id).toBe(1);
    expect(body2).toEqual({ user: 'john', token: '123456' });

    // Reading the already-finalized requests must not trigger new network calls
    expect(app.requestCount - requestCountBefore).toBe(3);
  });

  it('Should finalize individual requests subscribed before the bundle sends', async () => {
    const requestCountBefore = app.requestCount;
    const r1 = client.get('Customers@1');
    const r2 = client.request('auth/login', { params: { user: 'john' } });

    // Binding happens when the bundle is constructed — start listening right
    // after that, but before the bundle is actually sent (.getResponses())
    const bundle = client.bundle([r1, r2]);
    const p1 = r1.getBody();
    const p2 = r2.getBody();

    const [responses, body1, body2] = await Promise.all([
      bundle.getResponses(),
      p1,
      p2,
    ]);

    expect(body1.payload._id).toBe(1);
    expect(body2).toEqual({ user: 'john', token: '123456' });
    expect(responses[0].body).toEqual(body1);
    expect(responses[1].body).toEqual(body2);

    // A single POST /$bundle — the early getBody() calls must not have fired
    // their own requests
    expect(app.requestCount - requestCountBefore).toBe(3);
  });

  it('Should resolve getResponse() of a bundled request with the matching HttpResponse', async () => {
    const r1 = client.get('Customers@1');
    await client.bundle([r1]).getResponses();

    const resp = await r1.getResponse();
    expect(resp).toBeInstanceOf(HttpResponse);
    expect(resp.status).toBe(200);
    expect(resp.body.payload._id).toBe(1);
  });

  it('Should reject only the specific request whose sub-response is an error', async () => {
    const ok = client.get('Customers@1');
    const notFound = client.request('non-existing-path');

    const bundle = client.bundle([ok, notFound]);
    const okBody = ok.getBody();
    const notFoundBody = notFound.getBody().catch(e => e);

    const responses = await bundle.getResponses();
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(404);

    expect((await okBody).payload._id).toBe(1);
    const error = await notFoundBody;
    expect(error).toBeInstanceOf(ClientError);
    expect((error as ClientError).status).toBe(404);
  });

  it('Should reject all bundled requests when the bundle request fails at the network level', async () => {
    const xClient = new OpraHttpClient('http://127.0.0.1:1001');
    const r1 = xClient.get('Customers@1');
    const r2 = xClient.get('Customers@2');

    const bundle = xClient.bundle([r1, r2]);
    const p1 = r1.getBody().catch(e => e);
    const p2 = r2.getBody().catch(e => e);

    await expect(() => bundle.getResponses()).rejects.toThrow();

    const [e1, e2] = await Promise.all([p1, p2]);
    expect(e1).toBeInstanceOf(Error);
    expect(e2).toBeInstanceOf(Error);
  });

  it('Should return an empty array when bundling zero requests', async () => {
    const responses = await client.bundle([]).getResponses();
    expect(responses).toEqual([]);
  });
});
