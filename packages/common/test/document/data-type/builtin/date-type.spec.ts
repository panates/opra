import { ApiDocument } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../../_support/test-http-api/index.js';

describe('common:Builtin type: date', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should generate decoder', async () => {
    const dt = doc.node.getSimpleType('date');
    const decode = dt.generateCodec('decode');

    expect(decode(new Date('2020-01-02'))).toStrictEqual('2020-01-02');
    expect(decode(new Date('2020-01-02 12:43'))).toStrictEqual('2020-01-02');
  });

  it('Should generate decoder with convertToNative=true', async () => {
    const dt = doc.node.getSimpleType('date');
    const decode = dt.generateCodec('decode', null, {
      designType: Date,
    });
    expect(decode('2020-01-02T10:30:00', { coerce: true })).toStrictEqual(
      new Date('2020-01-02T00:00:00'),
    );
    expect(decode('2020-01-02 10:30:00', { coerce: true })).toStrictEqual(
      new Date('2020-01-02T00:00:00'),
    );
    expect(decode('2020-01-02 10:30', { coerce: true })).toStrictEqual(
      new Date('2020-01-02T00:00:00'),
    );
    expect(decode('2020-01-02', { coerce: true })).toStrictEqual(
      new Date('2020-01-02T00:00:00'),
    );
  });

  it('Should generate encoder with convertToNative=true', async () => {
    const dt = doc.node.getSimpleType('date');
    const decode = dt.generateCodec('encode');
    expect(decode('2020-01-02T10:30:00', { coerce: true })).toStrictEqual(
      '2020-01-02',
    );
    expect(decode('2020-01-02 10:30:00', { coerce: true })).toStrictEqual(
      '2020-01-02',
    );
    expect(decode('2020-01-02 10:30', { coerce: true })).toStrictEqual(
      '2020-01-02',
    );
    expect(decode('2020-01-02', { coerce: true })).toStrictEqual('2020-01-02');
  });

  it('Should validate "minValue"', async () => {
    const dt = doc.node.getSimpleType('date');
    const decode = dt.generateCodec('decode', null, {
      minValue: '2021-02-10',
    });
    expect(() => decode('2020-01-02', { coerce: true })).toThrow(
      'Value must be greater than or equal to',
    );
  });

  it('Should validate "maxValue"', async () => {
    const dt = doc.node.getSimpleType('date');
    const decode = dt.generateCodec('decode', null, {
      maxValue: '2020-02-10',
    });
    expect(() => decode('2020-02-12', { coerce: true })).toThrow(
      'Value must be lower than or equal to',
    );
  });
});
