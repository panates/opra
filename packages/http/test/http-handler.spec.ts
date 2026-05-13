import { ApiDocument, HttpOperation } from '@opra/common';
import {
  ExpressAdapter,
  HttpContext,
  HttpIncoming,
  HttpOutgoing,
} from '@opra/http';
import cookieParser from 'cookie-parser';
import { expect } from 'expect';
import express, { type Express } from 'express';
import supertest from 'supertest';
import { createTestApi } from './_support/test-api/index.js';

describe('http:HttpHandler', () => {
  let document: ApiDocument;
  let app: Express;
  let adapter: ExpressAdapter;

  function createContext(operation: HttpOperation, request: HttpIncoming) {
    const response = HttpOutgoing.from({ req: request });
    return new HttpContext({
      __adapter: adapter,
      __oprDef: operation,
      __contDef: operation.owner,
      platform: 'express',
      request,
      response,
    });
  }

  before(async () => {
    document = await createTestApi();
    app = express();
    app.use(cookieParser());
    adapter = new ExpressAdapter(app, document);
  });

  after(async () => adapter.close());

  it('Should parse query parameters', async () => {
    const resource = document.getHttpApi().findController('Customers');
    const operation = resource!.operations.get('findMany')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        url: '/Customers?limit=5&xyz=1',
      }),
    );
    await adapter.handler.parseRequest(context);
    expect(context.queryParams.limit).toEqual(5);
    expect(context.queryParams.xyz).not.toBeDefined();
  });

  it('Should set default query parameters', async () => {
    const resource = document.getHttpApi().findController('Customers');
    const operation = resource!.operations.get('sendMessage')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        url: '/Customers?message=abcd',
      }),
    );
    await adapter.handler.parseRequest(context);
    expect(context.queryParams.message).toEqual('abcd');
    expect(context.queryParams.all).toEqual(true);
  });

  it('Should parse path parameters', async () => {
    const resource = document
      .getHttpApi()
      .findController('Customer/CustomerAddress');
    const operation = resource!.operations.get('get')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        params: { customerId: '123', addressId: '456' },
      }),
    );
    await adapter.handler.parseRequest(context);
    expect(context.pathParams.customerId).toEqual(123);
    expect(context.pathParams.addressId).toEqual(456);
  });

  it('Should parse cookie parameters', async () => {
    const resource = document.getHttpApi().findController('Customer');
    const operation = resource!.operations.get('get')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        params: { customerId: '123' },
        cookies: { accessToken: 'gWEGnjkwegew', cid: '123', other: 'xyz' },
      }),
    );
    await adapter.handler.parseRequest(context);
    expect(context.cookies.accessToken).toEqual('gWEGnjkwegew');
    expect(context.cookies.cid).toEqual(123);
    expect(context.cookies.other).not.toBeDefined();
  });

  it('Should parse header parameters', async () => {
    const resource = document.getHttpApi().findController('Customer');
    const operation = resource!.operations.get('get')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        headers: { accessToken: 'gWEGnjkwegew', cid: '123', other: 'xyz' },
      }),
    );
    context.request.params.customerId = 1;
    await adapter.handler.parseRequest(context);
    expect(context.headers.accessToken).toEqual('gWEGnjkwegew');
    expect(context.headers.cid).toEqual(123);
    expect(context.headers.other).not.toBeDefined();
  });

  it('Should validate parameters', async () => {
    const resource = document.getHttpApi().findController('Customers');
    const operation = resource!.operations.get('findMany')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        url: '/Customers?limit=abc',
      }),
    );
    await expect(() => adapter.handler.parseRequest(context)).rejects.toThrow(
      'Invalid parameter',
    );
  });

  it('Should parse content-type', async () => {
    const resource = document.getHttpApi().findController('Customers');
    const operation = resource!.operations.get('create')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
      }),
    );
    await adapter.handler.parseRequest(context);
    expect(context.mediaType).toBeDefined();
    expect(context.mediaType?.contentType).toEqual('application/json');
    expect(context.mediaType?.contentEncoding).toEqual('UTF-8');
  });

  it('Should throw if content-type does not matches', async () => {
    const resource = document.getHttpApi().findController('Customers');
    const operation = resource!.operations.get('create')!;
    const context = createContext(
      operation,
      HttpIncoming.from({
        method: 'GET',
        headers: { 'content-type': 'text/plain; charset=UTF-8' },
      }),
    );
    await expect(() => adapter.handler.parseRequest(context)).rejects.toThrow(
      'should be one of required content types',
    );
  });

  it('Should call interceptors', async () => {
    const x: any[] = [];
    adapter.interceptors = [
      async (ctx: HttpContext, next) => {
        x.push(1);
        return next();
      },
      async (ctx: HttpContext, next) => {
        x.push(2);
        await next();
        if (ctx.response.writableEnded) x.push(3);
        else x.push(0);
      },
    ];
    const resp = await supertest(app).get('/Customers');
    expect(resp.status).toStrictEqual(200);
    expect(x).toStrictEqual([1, 2, 3]);
    expect(resp.body).toBeDefined();
  });
});
