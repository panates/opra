import { ApiDocument, OpraSchema } from '@opra/common';
import { ExpressAdapter } from '@opra/http';
import cookieParser from 'cookie-parser';
import { expect } from 'expect';
import express, { type Express } from 'express';
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

  it('Should call HttpController onShutdown method on close', async () => {
    const instance =
      adapter.getControllerInstance<CustomersController>('/Customers');
    await adapter.close();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(CustomersController);
  });
});
