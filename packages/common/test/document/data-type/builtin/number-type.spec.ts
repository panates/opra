import { ApiDocument } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../../_support/test-http-api/index.js';

describe('common:Builtin type: number', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should decode', async () => {
    const dt = doc.node.getSimpleType('number');
    const decode = dt.generateCodec('decode');
    expect(decode('123.12')).toStrictEqual(123.12);
    expect(decode(123.12)).toStrictEqual(123.12);
  });

  it('Should encode', async () => {
    const dt = doc.node.getSimpleType('number');
    const encode = dt.generateCodec('encode');
    expect(encode('123.12')).toStrictEqual(123.12);
    expect(encode(123.12)).toStrictEqual(123.12);
  });

  it('Should validate "minValue"', async () => {
    const dt = doc.node.getSimpleType('number');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode', null, { minValue: 10 });
    expect(() => decode(9)).toThrow(
      'Value must be greater than or equal to 10',
    );
  });

  it('Should validate "maxValue"', async () => {
    const dt = doc.node.getSimpleType('number');
    expect(dt).toBeDefined();
    const decode = dt.generateCodec('decode', null, { maxValue: 10 });
    expect(() => decode(11)).toThrow('Value must be lower than or equal to 10');
  });
});
