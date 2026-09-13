import { ApiDocument, OpraSchema } from '@opra/common';
import { expect } from 'expect';
import { MyProfileController } from '../../_support/test-http-api/api/my-profile.controller.js';
import { TestHttpApiDocument } from '../../_support/test-http-api/index.js';

describe('common:HttpController', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should findController(name) return undefined if controller not a found', async () => {
    expect(
      doc.getHttpApi().findController('unknownResource'),
    ).not.toBeDefined();
  });

  it('Should findController(name) return HttpController instance', async () => {
    const res = doc.getHttpApi().findController('auth/MyProfile');
    expect(res).toBeDefined();
    expect(res!.name).toStrictEqual('MyProfile');
  });

  it('Should findController(Type) return HttpController instance', async () => {
    const res = doc.getHttpApi().findController(MyProfileController);
    expect(res).toBeDefined();
    expect(res!.name).toStrictEqual('MyProfile');
  });

  it('Should toString() return string enumeration', async () => {
    const res = doc.getHttpApi().findController('auth/MyProfile');
    expect(res!.toString()).toStrictEqual('[HttpController MyProfile]');
  });

  it('Should toJSON() return Controller schema', async () => {
    const res = doc.getHttpApi().findController('Customer')!;
    const sch = res.toJSON();
    expect(sch).toEqual({
      kind: OpraSchema.HttpController.Kind,
      description: 'Customer resource',
      path: 'Customers@:customerId',
      parameters: [
        {
          location: 'path',
          name: 'customerId',
          type: 'uuid',
          required: true,
        },
      ],
      operations: expect.any(Object),
    });
    expect(sch.operations).toBeDefined();
    expect(sch.operations?.delete).toEqual({
      kind: 'HttpOperation',
      method: 'DELETE',
      composition: 'Entity.Delete',
      responses: [
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
        {
          statusCode: 422,
          contentType: 'application/opra.response+json',
          description: expect.any(String),
          contentEncoding: 'utf-8',
        },
      ],
    });
    expect(sch.operations?.get).toEqual({
      kind: 'HttpOperation',
      title: 'Get a customer',
      sections: ['Customers'],
      composition: 'Entity.Get',
      method: 'GET',
      parameters: [
        {
          location: 'query',
          name: 'projection',
          description: 'Determines fields projection',
          type: {
            base: 'fieldpath',
            kind: 'SimpleType',
            properties: {
              allowSigns: 'each',
              dataType: 'ns1:Customer',
            },
          },
          isArray: true,
          arraySeparator: ',',
        },
      ],
      responses: [
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: 'ns1:Customer',
          partial: 'deep',
        },
        {
          statusCode: 204,
          description: expect.any(String),
        },
        {
          statusCode: 422,
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          description: expect.any(String),
        },
      ],
    });
  });
});
