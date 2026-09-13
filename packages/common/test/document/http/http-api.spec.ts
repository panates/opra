import { ApiDocument, HttpApi, HttpController, MQApi } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../_support/test-http-api/index.js';

describe('common:HttpApi', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should create HttpApi instance', async () => {
    const api = doc.api as HttpApi;
    expect(api).toBeDefined();
    expect(api.transport).toEqual('http');
    expect(api.description).toEqual('test service');
    expect(api.url).toEqual('/test');
    expect(api.servers).toStrictEqual([
      { url: 'https://api.example.com', description: 'Test server' },
    ]);
  });

  it('Should create controller instances', async () => {
    const api = doc.api as MQApi;
    expect(api.controllers.size).toBeGreaterThan(0);
    expect(Array.from(api.controllers.keys())).toStrictEqual([
      'Auth',
      'Countries',
      'Country',
      'Customers',
      'Customer',
    ]);
    expect(api.controllers.get('Customers')).toBeInstanceOf(HttpController);
  });
});
