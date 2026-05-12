import { ApiDocument } from '@opra/common';
import { ExpressAdapter } from '@opra/http';
import { OpraTestClient } from '@opra/testing';
import { expect } from 'expect';
import express, { type Express } from 'express';
import supertest from 'supertest';
import { createTestApi } from '../_support/test-api/index.js';

describe('http:e2e:HttpOperation.Entity endpoints', () => {
  let document: ApiDocument;
  let app: Express;
  let adapter: ExpressAdapter;
  const testArgs: any = {};

  before(async () => {
    document = await createTestApi();
    app = express();
    adapter = new ExpressAdapter(app, document);
    testArgs.app = app;
    testArgs.client = new OpraTestClient(app, { document });
  });

  after(async () => adapter.close());

  it('Should execute "create" endpoint', async () => {
    const resp = await supertest(adapter.app).post('/Customers').send({
      givenName: 'abcd',
      familyName: 'efgh',
      active: true,
    });
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(201);
    expect(resp.body).toEqual({
      type: 'Customer',
      affected: 1,
      payload: {
        _id: 1001,
        active: true,
        familyName: 'efgh',
        givenName: 'abcd',
        rate: 1,
      },
    });
  });

  it('Should execute "get" endpoint', async () => {
    const resp = await supertest(adapter.app).get('/Customers@1');
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body).toEqual({
      type: 'Customer',
      payload: expect.any(Object),
    });
    expect(resp.body.payload._id).toEqual(1);
  });

  it('Should "get" endpoint return 204 if no resource found', async () => {
    const resp = await supertest(adapter.app).get('/Customers@12345');
    expect(resp.body).toEqual({});
    expect(Object.keys(resp.body).length).toEqual(0);
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(204);
  });

  it('Should execute "findMany" endpoint', async () => {
    const resp = await supertest(adapter.app).get('/Customers');
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body).toEqual({
      type: 'Customer',
      totalMatches: expect.any(Number),
      payload: expect.any(Object),
    });
    expect(resp.body.totalMatches).toBeGreaterThanOrEqual(1000);
    expect(Array.isArray(resp.body.payload)).toBeTruthy();
    expect(resp.body.payload[0]).toMatchObject({
      _id: /\d+/,
      givenName: /.+/,
      familyName: /.+/,
    });
  });

  it('Should execute "update" endpoint', async () => {
    const d = new Date();
    const resp = await supertest(adapter.app).patch('/Customers@1').send({
      birthDate: d.toISOString(),
      fillerDate: d.toISOString(),
      active: 'f',
    });
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body).toEqual({
      type: 'Customer',
      affected: 1,
      payload: expect.any(Object),
    });
  });

  it('Should execute "updateMany" endpoint', async () => {
    const resp = await supertest(adapter.app).patch('/Customers').send({
      birthDate: new Date().toISOString(),
    });
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body).toEqual({
      affected: expect.any(Number),
    });
    expect(resp.body.affected).toBeGreaterThan(1);
  });

  it('Should execute "delete" endpoint', async () => {
    const resp = await supertest(adapter.app).delete('/Customers@10');
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body).toEqual({
      affected: 1,
    });
  });

  it('Should execute "deleteMany" endpoint', async () => {
    const resp = await supertest(adapter.app).delete('/Customers');
    expect(resp.type).toStrictEqual('application/opra.response+json');
    expect(resp.body).toBeDefined();
    expect(resp.body.errors).not.toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body).toEqual({
      affected: expect.any(Number),
    });
    expect(resp.body.affected).toBeGreaterThan(1);
  });
});
