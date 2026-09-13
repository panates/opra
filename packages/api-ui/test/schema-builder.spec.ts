import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ArrayType,
  ComplexType,
  HttpController,
  HttpOperation,
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

@ComplexType({ description: 'A puppy' })
class Puppy extends Dog {
  @ApiField()
  declare birthDate?: Date;
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
      types: [Dog, Cat, Puppy, Kennel],
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

  it('Should describe a plain `extends` as "extends" naming the base type', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.types.Puppy.inherits).toStrictEqual({
      kind: 'extends',
      types: ['Dog'],
    });
  });

  it('Should mark an inherited field with "from" naming the base type', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.types.Puppy.fields.name.from).toStrictEqual('Dog');
    expect(schema.types.Puppy.fields.birthDate.from).toBeUndefined();
  });
});

describe('api-ui:ApiUiSchemaBuilder (sections/title)', () => {
  @HttpController({ path: 'Dogs' })
  class DogsController {
    @HttpOperation.GET({ title: 'List dogs', sections: ['Pets'] })
    findMany() {
      //
    }
  }

  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      api: {
        transport: 'http',
        name: 'TestApi',
        sections: [{ name: 'Pets', description: 'Pet management', icon: '🐶' }],
        controllers: [DogsController],
      },
    });
  });

  it('Should expose HttpApi#sections under "api.sections"', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.api.sections).toStrictEqual([
      { name: 'Pets', description: 'Pet management', icon: '🐶' },
    ]);
  });

  it("Should expose an operation's #title and #sections", () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    const op = schema.api.controllers.Dogs.operations.findMany;
    expect(op.title).toStrictEqual('List dogs');
    expect(op.sections).toStrictEqual(['Pets']);
  });
});
