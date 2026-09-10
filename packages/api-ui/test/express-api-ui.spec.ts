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
});
