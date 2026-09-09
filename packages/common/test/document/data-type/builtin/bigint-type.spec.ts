import { ApiDocument, BigintType } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../../_support/test-http-api/index.js';

describe('common:Builtin type: bigint', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should decode', async () => {
    const dt = doc.node.getSimpleType('bigint');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode');
    expect(decode('123')).toStrictEqual(BigInt(123));
    expect(decode(1)).toStrictEqual(BigInt(1));
  });

  it('Should encode', async () => {
    const dt = doc.node.getSimpleType('bigint');
    const encode = dt.generateCodec('decode');
    expect(encode(123)).toStrictEqual(BigInt(123));
  });

  it('Should validate "minValue"', async () => {
    const dt = doc.node.getSimpleType('bigint');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec<BigintType>('decode', null, {
      minValue: 10,
    });
    expect(() => decode(9)).toThrow(
      'Value must be greater than or equal to 10',
    );
  });

  it('Should validate "maxValue"', async () => {
    const dt = doc.node.getSimpleType('bigint');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode', null, { maxValue: 10 });
    expect(() => decode(11)).toThrow('Value must be lower than or equal to 10');
  });
});
