import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ArrayType,
  ComplexType,
  OpraSchema,
  UnionType,
} from '@opra/common';
import { expect } from 'expect';
import { ApiUiSchemaBuilder } from '../src/schema-builder.js';

@ComplexType({ description: 'A dog' })
class Dog {
  @ApiField({ required: true })
  declare name: string;
}

@ComplexType({ description: 'A cat' })
class Cat {
  @ApiField({ required: true })
  declare name: string;
}

@ComplexType({ description: 'A kennel' })
class Kennel {
  // Explicit ArrayType wrapper — as opposed to `@ApiField({ type: Dog })`
  // with a `Dog[]` TS annotation, which sets the deprecated `isArray` flag
  // instead and is deliberately NOT treated as an array by this package.
  @ApiField({ type: ArrayType(Dog) })
  declare dogs?: Dog[];

  @ApiField({ type: UnionType([Dog, Cat]) })
  declare pet?: any;
}

describe('api-ui:ApiUiSchemaBuilder', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Dog, Cat, Kennel],
      api: { transport: 'http', name: 'TestApi', controllers: [] },
    });
  });

  it('Should register every reachable named type under "types"', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.types.Dog).toBeDefined();
    expect(schema.types.Cat).toBeDefined();
    expect(schema.types.Kennel).toBeDefined();
  });

  it("Should reference an ArrayType field's item type by name, not inline", () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    const dogsField = schema.types.Kennel.fields.dogs;
    expect(dogsField.type.kind).toStrictEqual('ArrayType');
    expect(dogsField.type.type).toStrictEqual('Dog');
  });

  it('Should map a UnionType field to a "types" array of named references', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    const petField = schema.types.Kennel.fields.pet;
    expect(petField.type.kind).toStrictEqual('UnionType');
    expect(petField.type.types).toEqual(expect.arrayContaining(['Dog', 'Cat']));
  });
});
