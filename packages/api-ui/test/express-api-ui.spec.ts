import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  OpraSchema,
} from '@opra/common';
import { expect } from 'expect';
import express from 'express';
import supertest from 'supertest';
import { expressApiUi } from '../src/express/express-api-ui.js';

@ComplexType({ description: 'A customer' })
class Customer {
  @ApiField({ required: true })
  declare id: string;
}

describe('api-ui:expressApiUi', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [],
      },
    });
  });

  it('Should serve the rendered API reference page as text/html', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('window.__OPRA_DOCS__');
  });

  it('Should reuse the cached HTML across requests instead of re-rendering', async () => {
    const app = express();
    const handler = expressApiUi(doc, { pageTitle: 'Cached' });
    app.use('/reference', handler);
    const first = await supertest(app).get('/reference');
    const second = await supertest(app).get('/reference');
    expect(first.text).toStrictEqual(second.text);
  });

  it('Should serve the native Opra schema as JSON at /schema/root.json', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const res = await supertest(app).get('/reference/schema/root.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.info.title).toStrictEqual('TestApi');
    expect(res.body.api.transport).toStrictEqual('http');
  });

  it('Should map the document to OpenAPI as JSON at /openapi/root.json', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const res = await supertest(app).get('/reference/openapi/root.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toStrictEqual('3.0.3');
    expect(res.body.info.title).toStrictEqual('TestApi');
  });

  it('Should respond 404 for an unknown document key on either export route', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const schemaRes = await supertest(app).get('/reference/schema/nope.json');
    const openapiRes = await supertest(app).get('/reference/openapi/nope.json');
    expect(schemaRes.status).toBe(404);
    expect(openapiRes.status).toBe(404);
  });

  it('Should respond 400 mapping a non-HTTP document to OpenAPI', async () => {
    const typesOnlyDoc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TypesOnly', version: 'v1' },
      types: [Customer],
    });
    const app = express();
    app.use('/reference', expressApiUi(typesOnlyDoc));
    const res = await supertest(app).get('/reference/openapi/root.json');
    expect(res.status).toBe(400);
  });
});

@ComplexType({ description: 'A record with a db-only field' })
class ScopedRecord {
  @ApiField({ required: true })
  declare id: string;

  // Only visible when exported/rendered under the "db" scope — the same
  // `scopePattern` mechanism `examples/_lib/customer-mongo`'s own models
  // use for their real db-only fields.
  @ApiField({ scopePattern: 'db' })
  declare secret?: string;
}

describe('api-ui:expressApiUi (scopes)', () => {
  let scopedDoc: ApiDocument;

  before(async () => {
    scopedDoc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'ScopedApi', version: 'v1' },
      types: [ScopedRecord],
      api: { transport: 'http', name: 'ScopedApi', controllers: [] },
    });
  });

  it('Should 301-redirect a bare mount root to the given default scope', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(301);
    expect(res.headers.location).toStrictEqual('/reference/api');
  });

  it('Should fall back to scopes[0] when no default scope is given', async () => {
    const app = express();
    app.use('/reference', expressApiUi(scopedDoc, { scopes: ['db', 'api'] }));
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(301);
    expect(res.headers.location).toStrictEqual('/reference/db');
  });

  it('Should respond 404 for an unrecognized scope segment', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const res = await supertest(app).get('/reference/nope');
    expect(res.status).toBe(404);
  });

  it('Should embed the requested scope (not just the default) in window.__OPRA_UI__', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const res = await supertest(app).get('/reference/db');
    expect(res.status).toBe(200);
    expect(res.text).toContain('"scope":"db"');
    expect(res.text).toContain('"scopes":["api","db"]');
    expect(res.text).toContain('"basePath":"/reference"');
  });

  it('Should not embed a "scopes" list at all when only one scope is configured', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api'] }),
    );
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('"scopes"');
  });

  it('Should filter fields by the URL scope segment, not just the configured default', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );

    const apiRes = await supertest(app).get('/reference/api/schema/root.json');
    expect(apiRes.body.types.ScopedRecord.fields.secret).toBeUndefined();

    const dbRes = await supertest(app).get('/reference/db/schema/root.json');
    expect(dbRes.body.types.ScopedRecord.fields.secret).toBeDefined();
  });

  it('Should cache rendered HTML separately per scope', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const apiRes = await supertest(app).get('/reference/api');
    const dbRes = await supertest(app).get('/reference/db');
    expect(apiRes.text).not.toStrictEqual(dbRes.text);
    expect(apiRes.text).toContain('"scope":"api"');
    expect(dbRes.text).toContain('"scope":"db"');
  });
});
