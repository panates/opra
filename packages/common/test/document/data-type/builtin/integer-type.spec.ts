import { ApiDocument } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../../_support/test-http-api/index.js';

describe('common:Builtin type: integer', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should decode', async () => {
    const dt = doc.node.getSimpleType('integer');
    const decode = dt.generateCodec('decode');
    expect(decode('123')).toStrictEqual(123);
    expect(decode(123)).toStrictEqual(123);
  });

  it('Should encode', async () => {
    const dt = doc.node.getSimpleType('integer');
    const encode = dt.generateCodec('encode');
    expect(encode('123')).toStrictEqual(123);
    expect(encode(123)).toStrictEqual(123);
  });

  it('Should validate value', async () => {
    const dt = doc.node.getSimpleType('integer');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode');
    expect(() => decode('abc')).toThrow('must be a valid integer value');
    expect(() => decode('abc')).toThrow('must be a valid integer value');
  });

  it('Should validate "minValue"', async () => {
    const dt = doc.node.getSimpleType('integer');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode', null, { minValue: 10 });
    expect(() => decode(9)).toThrow(
      'Value must be greater than or equal to 10',
    );
  });

  it('Should validate "maxValue"', async () => {
    const dt = doc.node.getSimpleType('integer');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode', null, { maxValue: 10 });
    expect(() => decode(11)).toThrow('Value must be lower than or equal to 10');
  });
});
