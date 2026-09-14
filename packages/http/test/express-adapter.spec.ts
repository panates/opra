import { Readable } from 'node:stream';
import { ApiDocument, OpraSchema } from '@opra/common';
import { ExpressAdapter } from '@opra/http';
import cookieParser from 'cookie-parser';
import { expect } from 'expect';
import express, { type Express } from 'express';
import MultipartStream from 'multipart-stream';
import supertest from 'supertest';
import {
  createTestApi,
  CustomersController,
} from './_support/test-api/index.js';

describe('http:ExpressAdapter', () => {
  let document: ApiDocument;
  let app: Express;
  let adapter: ExpressAdapter;

  before(async () => {
    document = await createTestApi();
    app = express();
    app.use(cookieParser());
    adapter = new ExpressAdapter(app, document, { basePath: 'api' });
  });

  after(async () => adapter.close());

  it('Should init all routes', async () => {
    const routerStack = app.router.stack.find(x => x.name === 'router');
    expect(routerStack).toBeDefined();
    const paths = (routerStack!.handle as any).stack
      .filter(x => x.route)
      .map(
        x =>
          x.route.path +
          ' | ' +
          Object.keys(x.route.methods).join(',').toUpperCase(),
      );

    expect(paths).toEqual([
      '/\\$schema | GET',
      '/\\$bundle | POST',
      '/ping | GET',
      '/Auth/login | GET',
      '/Auth/logout | GET',
      '/Auth/getToken | GET',
      '/Auth/getRawToken | GET',
      '/Customers | POST',
      '/Customers | DELETE',
      '/Customers | PATCH',
      '/Customers | GET',
      '/Customers/sendMessage | GET',
      '/Customers@:customerId | GET',
      '/Customers@:customerId | DELETE',
      '/Customers@:customerId | PATCH',
      '/Customers@:customerId/sendMessage | GET',
      '/Customers@:customerId/Addresses | POST',
      '/Customers@:customerId/Addresses | GET',
      '/Customers@:customerId/Addresses@:addressId | GET',
      '/Files | POST',
      '/MyProfile | POST',
      '/MyProfile | DELETE',
      '/MyProfile | GET',
      '/MyProfile | PATCH',
    ]);
  });

  it('Should return 404 error if route not found', async () => {
    const resp = await supertest(app).get('/api/notexist?x=1');
    expect(resp.status).toStrictEqual(404);
    expect(resp.body).toEqual({
      errors: [
        {
          code: 'NOT_FOUND',
          message: 'No endpoint found at [GET]/api/notexist',
          severity: 'error',
          details: {
            method: 'GET',
            path: '/api/notexist',
          },
        },
      ],
    });
  });

  it('Should GET:/$schema return api schema ', async () => {
    const resp = await supertest(app).get('/api/$schema');
    expect(resp.status).toStrictEqual(200);
    expect(resp.body).toBeInstanceOf(Object);
    expect(resp.body.spec).toEqual(OpraSchema.SpecVersion);
  });

  it('Should POST:/$bundle send requests to controllers and return multipart response', async () => {
    const makeRawRequest = (method: string, path: string): Readable =>
      Readable.from([
        Buffer.from(
          `${method} ${path} HTTP/1.1\r\nHost: localhost\r\n\r\n`,
          'utf-8',
        ),
      ]);

    const requestStream = new MultipartStream();
    requestStream.addPart({
      headers: {
        'Content-Disposition': 'form-data; name="req"; filename="request"',
        'Content-Type': 'application/http',
        'X-Request-Id': '1',
      },
      body: makeRawRequest('GET', '/api/ping'),
    });
    requestStream.addPart({
      headers: {
        'Content-Disposition': 'form-data; name="req"; filename="request"',
        'Content-Type': 'application/http',
        'X-Request-Id': '2',
      },
      body: makeRawRequest('GET', '/api/Customers'),
    });

    const chunks: Buffer[] = [];
    for await (const chunk of requestStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
    }
    const body = Buffer.concat(chunks);

    const resp = await supertest(app)
      .post('/api/$bundle')
      .set(
        'Content-Type',
        `multipart/mixed; boundary=${requestStream.boundary}`,
      )
      .parse((res, callback) => {
        const _chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer | string) => {
          _chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => callback(null, Buffer.concat(_chunks)));
      })
      .send(body);

    const responseText = Buffer.isBuffer(resp.body)
      ? resp.body.toString('utf-8')
      : '';

    expect(resp.status).toStrictEqual(200);
    expect(resp.headers['content-type']).toMatch(/multipart\/mixed/);

    const responseBoundary =
      resp.headers['content-type'].match(/boundary=([^\s;]+)/)?.[1];
    expect(responseBoundary).toBeDefined();

    const parts = responseText
      .split(`--${responseBoundary}`)
      .filter(p => p && p !== '--\r\n' && p.trim() !== '--');
    expect(parts.length).toBe(2);

    expect(parts[0]).toMatch(/Content-Type:\s*application\/http/i);
    expect(parts[0]).toMatch(/X-Request-Id:\s*1/i);
    expect(parts[0]).toMatch(/HTTP\/1\.1\s+\d{3}/);

    expect(parts[1]).toMatch(/Content-Type:\s*application\/http/i);
    expect(parts[1]).toMatch(/X-Request-Id:\s*2/i);
    expect(parts[1]).toMatch(/HTTP\/1\.1\s+\d{3}/);
  });

  it('Should call HttpController onShutdown method on close', async () => {
    const instance =
      adapter.getControllerInstance<CustomersController>('/Customers');
    await adapter.close();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(CustomersController);
  });
});

describe('http:ExpressAdapter ($schema/$openapi/apiUi options)', () => {
  let document: ApiDocument;

  before(async () => {
    document = await createTestApi();
  });

  it('Should publish $schema by default', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document);
    try {
      const resp = await supertest(app).get('/$schema');
      expect(resp.status).toStrictEqual(200);
    } finally {
      await adapter.close();
    }
  });

  it('Should not publish $schema when schema:false', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document, { schema: false });
    try {
      const resp = await supertest(app).get('/$schema');
      expect(resp.status).toStrictEqual(404);
    } finally {
      await adapter.close();
    }
  });

  it('Should not publish $openapi by default', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document);
    try {
      const resp = await supertest(app).get('/$openapi');
      expect(resp.status).toStrictEqual(404);
    } finally {
      await adapter.close();
    }
  });

  it('Should publish $openapi when openapi:true', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document, { openapi: true });
    try {
      const resp = await supertest(app).get('/$openapi');
      expect(resp.status).toStrictEqual(200);
      expect(resp.body.openapi).toStrictEqual('3.0.3');
      expect(resp.body.paths).toBeInstanceOf(Object);
    } finally {
      await adapter.close();
    }
  });

  it('Should not mount the api-ui page by default', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document);
    try {
      const resp = await supertest(app).get('/$ui');
      expect(resp.status).toStrictEqual(404);
    } finally {
      await adapter.close();
    }
  });

  it('Should mount the api-ui page at the default path ($ui) when apiUi:true', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document, { apiUi: true });
    try {
      const resp = await supertest(app).get('/$ui');
      expect(resp.status).toStrictEqual(200);
      expect(resp.headers['content-type']).toMatch(/text\/html/);
    } finally {
      await adapter.close();
    }
  });

  it('Should mount the api-ui page at a custom path', async () => {
    const app = express();
    const adapter = new ExpressAdapter(app, document, {
      apiUi: { path: '/ui', pageTitle: 'Custom Title' },
    });
    try {
      const resp = await supertest(app).get('/ui');
      expect(resp.status).toStrictEqual(200);
      expect(resp.text).toContain('<title>Custom Title</title>');
    } finally {
      await adapter.close();
    }
  });
});
