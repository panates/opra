import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ArrayType,
  ComplexType,
  EnumType,
  OpraSchema,
  SimpleType,
} from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../_support/test-http-api/index.js';

describe('common:ArrayType', () => {
  let doc: ApiDocument;

  before(async () => {
    const baseDoc = await TestHttpApiDocument.create();
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      references: {
        base: baseDoc,
      },
      types: [
        Cat,
        Color,
        ArrayType(String, { name: 'ArrayType1' }),
        ArrayType(Cat, { name: 'ArrayType2' }),
        ArrayType(Color, { name: 'ArrayType3' }),
        ArrayType(ArrayType(Number), { name: 'ArrayType4' }),
        ArrayType(String, { name: 'ArrayType5', minOccurs: 1, maxOccurs: 10 }),
      ],
    });
  });

  it('Should create ArrayType for SimpleType', async () => {
    const dt = doc.node.getArrayType('ArrayType1');
    expect(dt).toBeDefined();
    expect(dt.name).toEqual('ArrayType1');
    expect(dt.type).toBeDefined();
    expect(dt.type).toBeInstanceOf(SimpleType);
    expect(dt.type.name).toEqual('string');
  });

  it('Should create ArrayType for ComplexType', async () => {
    const dt = doc.node.getArrayType('ArrayType2');
    expect(dt).toBeDefined();
    expect(dt.name).toEqual('ArrayType2');
    expect(dt.type).toBeDefined();
    expect(dt.type).toBeInstanceOf(ComplexType);
    expect(dt.type.name).toEqual('Cat');
  });

  it('Should create ArrayType for EnumType', async () => {
    const dt = doc.node.getArrayType('ArrayType3');
    expect(dt).toBeDefined();
    expect(dt.name).toEqual('ArrayType3');
    expect(dt.type).toBeDefined();
    expect(dt.type).toBeInstanceOf(EnumType);
    expect(dt.type.name).toEqual('Color');
  });

  it('Should create ArrayType for ArrayType', async () => {
    const dt = doc.node.getArrayType('ArrayType4');
    expect(dt).toBeDefined();
    expect(dt.type).toBeDefined();
    expect(dt.type).toBeInstanceOf(ArrayType);
    expect(dt.name).toEqual('ArrayType4');
  });

  it('Should keep minOccurs/maxOccurs given to ArrayType()', async () => {
    const dt = doc.node.getArrayType('ArrayType5');
    expect(dt).toBeDefined();
    expect(dt.minOccurs).toStrictEqual(1);
    expect(dt.maxOccurs).toStrictEqual(10);
  });

  it('Should generateCodec() return ValGen validator', async () => {
    let dt = doc.node.getArrayType('ArrayType1');
    let decode = dt.generateCodec('decode', {});
    let v = decode(['x', 'y', 2]);
    expect(Array.isArray(v)).toBeTruthy();
    expect(v.length).toEqual(3);
    expect(v).toEqual(['x', 'y', '2']);
    dt = doc.node.getArrayType('ArrayType2');
    decode = dt.generateCodec('decode', {});
    v = decode([{ kind: 'cat', name: 'Daisy' }]);
    expect(Array.isArray(v)).toBeTruthy();
    expect(v.length).toEqual(1);
    expect(v[0]).toBeInstanceOf(Cat);
  });
});

@ComplexType({
  discriminatorField: 'kind',
  discriminatorValue: 'cat',
})
class Cat {
  @ApiField()
  declare kind: string;
  @ApiField()
  declare name: string;
}

enum Color {
  black = 'black',
  white = 'white',
  gray = 'gray',
  brown = 'brown',
}

EnumType(Color, { name: 'Color' });
