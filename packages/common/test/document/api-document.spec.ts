import { ApiDocument, OpraSchema } from '@opra/common';
import { Gender } from 'example-customer-mongo/models';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../_support/test-http-api/index.js';

describe('common:ApiDocument', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should include built-in types by default', async () => {
    const ref = doc.references.get('opra');
    expect(ref).toBeDefined();
    expect(ref?.node.getDataType('any')).toBeDefined();
    expect(ref?.node.getDataType('any').kind).toStrictEqual('SimpleType');
    expect(ref?.node.getDataType(Object)).toBeDefined();
    expect(ref?.node.getDataType(Object).name).toStrictEqual('any');

    expect(ref?.node.getDataType('bigint')).toBeDefined();
    expect(ref?.node.getDataType(BigInt)).toBeDefined();
    expect(ref?.node.getDataType(BigInt).name).toStrictEqual('bigint');

    expect(ref?.node.getDataType('boolean')).toBeDefined();
    expect(ref?.node.getDataType(Boolean)).toBeDefined();
    expect(ref?.node.getDataType(Boolean).name).toStrictEqual('boolean');

    expect(ref?.node.getDataType('integer')).toBeDefined();

    expect(ref?.node.getDataType('number')).toBeDefined();
    expect(ref?.node.getDataType(Number)).toBeDefined();
    expect(ref?.node.getDataType(Number).name).toStrictEqual('number');

    expect(ref?.node.getDataType('object')).toBeDefined();

    expect(ref?.node.getDataType('string')).toBeDefined();
    expect(ref?.node.getDataType(String)).toBeDefined();
    expect(ref?.node.getDataType(String).name).toStrictEqual('string');

    expect(ref?.node.getDataType('time')).toBeDefined();
    expect(ref?.node.getDataType('datetime')).toBeDefined();
  });

  it('Should getDataTypeNs() return namespace of DataType', async () => {
    expect(doc.getDataTypeNs(Gender)).toStrictEqual('ns1');
    expect(doc.getDataTypeNs(String)).toStrictEqual('');
    expect(doc.getDataTypeNs('string')).toStrictEqual('');
  });

  it('Should export() return document schema', async () => {
    const sch = doc.references.get('ns1')!.export();
    expect(sch.spec).toStrictEqual(OpraSchema.SpecVersion);
    expect(sch.info).toBeDefined();
    expect(sch.id).toBeDefined();
    expect(sch.types).toBeDefined();
    expect(Object.keys(sch.types!)).toEqual([
      'AddressType',
      'Gender',
      'Address',
      'Record',
      'Country',
      'CountryCode',
      'Customer',
      'Person',
      'PersonName',
      'Note',
      'PhoneNumber',
      'PhoneNumberValue',
      'Passport',
      'DriversLicense',
      'NationalId',
      'Profile',
    ]);
  });

  it('Should export(scope) return document schema for scope', async () => {
    const sch = doc.references.get('ns1')!.export({ scope: 'db' });
    expect(sch.spec).toStrictEqual(OpraSchema.SpecVersion);
    expect(sch.info).toBeDefined();
    expect(sch.id).toBeDefined();
    expect(sch.types).toBeDefined();
    expect(Object.keys(sch.types!)).toEqual([
      'AddressType',
      'Gender',
      'Address',
      'Record',
      'Config',
      'Country',
      'CountryCode',
      'Customer',
      'Person',
      'PersonName',
      'Note',
      'PhoneNumber',
      'PhoneNumberValue',
      'Passport',
      'DriversLicense',
      'NationalId',
      'Profile',
    ]);
  });
});
