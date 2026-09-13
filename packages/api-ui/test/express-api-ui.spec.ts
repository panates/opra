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
