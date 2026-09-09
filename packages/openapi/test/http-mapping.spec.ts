import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  HttpController,
  HttpOperation,
  OpraSchema,
} from '@opra/common';
import { expect } from 'expect';
import { OpenApiDocumentFactory } from '../src/index.js';

@ComplexType({ description: 'A customer' })
class Customer {
  @ApiField({ required: true })
  declare id: string;

  @ApiField()
  declare givenName?: string;
}

@(HttpController({ path: 'Customers@:customerId' }).PathParam(
  'customerId',
  'uuid',
))
class CustomerController {
  @HttpOperation.Entity.Get({ type: Customer })
  get() {
    //
  }
}

@HttpController({ description: 'Customers collection' })
class CustomersController {
  @(HttpOperation.Entity.FindMany({ type: Customer })
    .SortFields('id', 'givenName')
    .Filter('givenName', ['=', 'like']))
  findMany() {
    //
  }

  @HttpOperation.Entity.Create({ type: Customer })
  create() {
    //
  }
}

describe('openapi:HTTP mapping', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: {
        transport: 'http',
        name: 'TestApi',
        url: '/test',
        controllers: [CustomerController, CustomersController],
      },
    });
  });

  it('Should build top-level document info and version string', () => {
    const result = OpenApiDocumentFactory.generate(doc, { version: '3.0' });
    expect(result.openapi).toStrictEqual('3.0.3');
    expect(result.info.title).toStrictEqual('TestApi');
    expect(result.info.version).toStrictEqual('v1');
  });

  it('Should use "3.1.0" as the version string for OpenAPI 3.1', () => {
    const result = OpenApiDocumentFactory.generate(doc, { version: '3.1' });
    expect(result.openapi).toStrictEqual('3.1.0');
  });

  it('Should set servers[0].url from HttpApi#url', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    expect(result.servers).toStrictEqual([{ url: '/test' }]);
  });

  it('Should convert ":param" path templates to "{param}"', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    expect(Object.keys(result.paths)).toContain('/Customers@{customerId}');
  });

  it('Should map the collection GET (findMany) operation with its filter/sort query params', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const pathItem = result.paths['/Customers'];
    expect(pathItem).toBeDefined();
    expect(pathItem.get).toBeDefined();
    const paramNames = pathItem.get!.parameters!.map(p => p.name);
    expect(paramNames).toContain('filter');
    expect(paramNames).toContain('sort');
  });

  it('Should map the collection POST (create) operation with a request body', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const pathItem = result.paths['/Customers'];
    expect(pathItem.post).toBeDefined();
    expect(pathItem.post!.requestBody).toBeDefined();
    expect(
      pathItem.post!.requestBody!.content['application/json'],
    ).toBeDefined();
  });

  it('Should mark a path parameter as required with a "uuid"-derived schema', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const pathItem = result.paths['/Customers@{customerId}'];
    expect(pathItem.get).toBeDefined();
    const param = pathItem.get!.parameters!.find(
      p => p.name === 'customerId' && p.in === 'path',
    );
    expect(param).toBeDefined();
    expect(param!.required).toBe(true);
    expect(param!.schema!.type).toStrictEqual('string');
    expect(param!.schema!.format).toStrictEqual('uuid');
  });

  it('Should include at least one response for every mapped operation', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    for (const pathItem of Object.values(result.paths)) {
      for (const op of Object.values(pathItem)) {
        expect(Object.keys(op!.responses).length).toBeGreaterThan(0);
      }
    }
  });
});
