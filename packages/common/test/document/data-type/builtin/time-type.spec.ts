import { ApiDocument } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../../_support/test-http-api/index.js';

describe('common:Builtin type: time', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should decode', async () => {
    const dt = doc.node.getSimpleType('time');
    const decode = dt.generateCodec('decode');
    expect(decode('10:30:45')).toStrictEqual('10:30:45');
    expect(decode('10:30')).toStrictEqual('10:30');
  });

  it('Should encode', async () => {
    const dt = doc.node.getSimpleType('time');
    const encode = dt.generateCodec('encode');
    expect(encode('10:30:45')).toStrictEqual('10:30:45');
    expect(encode('10:30:00')).toStrictEqual('10:30:00');
  });

  it('Should validate "minValue"', async () => {
    const dt = doc.node.getSimpleType('time');
    const decode = dt.generateCodec('decode', null, { minValue: '10:00:00' });
    expect(decode('10:30:45')).toStrictEqual('10:30:45');
    expect(() => decode('09:30:45')).toThrow(
      'Value must be greater than or equal to',
    );
  });

  it('Should validate "maxValue"', async () => {
    const dt = doc.node.getSimpleType('time');
    const decode = dt.generateCodec('decode', null, { maxValue: '10:00:00' });
    expect(decode('09:30:45')).toStrictEqual('09:30:45');
    expect(() => decode('10:30:45')).toThrow(
      'Value must be lower than or equal to',
    );
  });
});
