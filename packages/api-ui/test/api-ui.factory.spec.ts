import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  EnumType,
  HttpController,
  HttpOperation,
  MixinType,
  OpraSchema,
} from '@opra/common';
import { expect } from 'expect';
import { ApiUiFactory } from '../src/api-ui.factory.js';

enum BaseStatus {
  active = 'active',
}
EnumType(BaseStatus, {
  name: 'BaseStatus',
  meanings: { active: 'Is active' },
});

enum ExtraStatus {
  pending = 'pending',
}
EnumType(ExtraStatus, {
  name: 'CustomerStatus',
  base: BaseStatus,
  meanings: { pending: 'Is pending' },
});

@ComplexType({ description: 'A record' })
class Record {
  @ApiField({ required: true })
  declare id: string;
}

@ComplexType({ description: 'A person' })
class Person {
  @ApiField()
  declare name?: string;
}

@ComplexType({ description: 'A customer' })
class Customer extends MixinType([Record, Person]) {
  @ApiField({ type: ExtraStatus })
  declare status?: any;
}

@HttpController({ description: 'Customers collection' })
class CustomersController {
  @HttpOperation.Entity.FindMany({ type: Customer })
  findMany() {
    //
  }
}

describe('api-ui:ApiUiFactory', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [BaseStatus, ExtraStatus, Record, Person, Customer],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [CustomersController],
      },
    });
  });

  it('Should render an HTML page embedding the flattened native Opra schema (not OpenAPI)', () => {
    const html = ApiUiFactory.render(doc);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('window.__OPRA_DOCS__');
    expect(html).toContain('"Customers"');
    expect(html).toContain('"Customer"');
    expect(html).not.toContain('"openapi"');
  });

  it('Should flatten fields mixed in via MixinType from the runtime graph instead of shipping a base reference', () => {
    const html = ApiUiFactory.render(doc);
    const match = /window\.__OPRA_DOCS__\s*=\s*(\{.*?\});/s.exec(html);
    expect(match).toBeDefined();
    const docs = JSON.parse(match![1]);
    const customerType = docs.root.types.Customer;
    // `class Customer extends MixinType([Record, Person])`, decorated with
    // @ComplexType, is itself a ComplexType — MixinType only describes how
    // its fields were assembled, which is exactly what gets flattened away.
    expect(customerType.kind).toStrictEqual('ComplexType');
    expect(Object.keys(customerType.fields)).toEqual(
      expect.arrayContaining(['id', 'name', 'status']),
    );
    expect(customerType.base).toBeUndefined();
  });

  it('Should merge an EnumType with its base into a single flat "values" map', () => {
    const html = ApiUiFactory.render(doc);
    const match = /window\.__OPRA_DOCS__\s*=\s*(\{.*?\});/s.exec(html);
    const docs = JSON.parse(match![1]);
    const statusType = docs.root.types.CustomerStatus;
    expect(statusType.kind).toStrictEqual('EnumType');
    expect(Object.keys(statusType.values)).toEqual(
      expect.arrayContaining(['active', 'pending']),
    );
    expect(statusType.values.active.description).toStrictEqual('Is active');
    expect(statusType.values.pending.description).toStrictEqual('Is pending');
    expect(statusType.values.active.alias).toBeUndefined();
    expect(statusType.base).toBeUndefined();
  });

  it('Should default the page title to the ApiDocument info.title', () => {
    expect(ApiUiFactory.render(doc)).toContain('<title>TestApi</title>');
  });

  it('Should let an explicit pageTitle override the document title', () => {
    expect(ApiUiFactory.render(doc, { pageTitle: 'Custom Title' })).toContain(
      '<title>Custom Title</title>',
    );
  });
});
