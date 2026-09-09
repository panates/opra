import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  EnumType,
  MixinType,
  OpraSchema,
  PickType,
  UnionType,
} from '@opra/common';
import { expect } from 'expect';
import { OpenApiDocumentFactory } from '../src/index.js';

enum Color {
  black = 'black',
  white = 'white',
}
EnumType(Color, {
  name: 'Color',
  description: 'A color',
  meanings: { black: 'Black color', white: 'White color' },
});

@ComplexType({ description: 'An animal' })
class Animal {
  @ApiField({ required: true })
  declare name: string;

  @ApiField()
  declare color?: Color;
}

@ComplexType({ description: 'A dog' })
class Dog extends Animal {
  @ApiField()
  declare breed?: string;
}

@ComplexType()
class Cat extends Animal {
  @ApiField()
  declare indoor?: boolean;
}

const PetUnion = UnionType([Dog, Cat], { name: 'PetUnion' });
const AnimalPreview = PickType(Animal, ['name'], { name: 'AnimalPreview' });
const DogCatMixin = MixinType([Dog, Cat], { name: 'DogCatMixin' });

@ComplexType()
class Kennel {
  @ApiField({ type: Dog })
  declare dogs?: Dog[];

  @ApiField({ type: PetUnion })
  declare pet?: any;

  @ApiField({ type: AnimalPreview })
  declare preview?: any;

  @ApiField({ type: DogCatMixin })
  declare mixed?: any;
}

describe('openapi:data-type mapping', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      types: [
        Color,
        Animal,
        Dog,
        Cat,
        PetUnion,
        AnimalPreview,
        DogCatMixin,
        Kennel,
      ],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [],
      },
    });
  });

  it('Should map a ComplexType to {type:"object"} with required[] collected from fields', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const animalSchema = result.components!.schemas!.Animal;
    expect(animalSchema).toBeDefined();
    expect(animalSchema.type).toStrictEqual('object');
    expect(animalSchema.required).toStrictEqual(['name']);
    expect(animalSchema.properties!.name.type).toStrictEqual('string');
  });

  it('Should map EnumType to {type:"string", enum:[...]}', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    expect(result.components!.schemas!.Color).toStrictEqual({
      type: 'string',
      description: 'A color',
      enum: ['black', 'white'],
    });
  });

  it('Should flatten ComplexType inheritance (base fields included, not allOf)', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const dogSchema = result.components!.schemas!.Dog;
    expect(dogSchema.type).toStrictEqual('object');
    expect(dogSchema.properties!.name).toBeDefined();
    expect(dogSchema.properties!.color).toBeDefined();
    expect(dogSchema.properties!.breed).toBeDefined();
    expect(dogSchema.required).toStrictEqual(['name']);
  });

  it('Should map UnionType to oneOf', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const unionSchema = result.components!.schemas!.PetUnion;
    expect(unionSchema.oneOf).toStrictEqual([
      { $ref: '#/components/schemas/Dog' },
      { $ref: '#/components/schemas/Cat' },
    ]);
  });

  it('Should flatten MappedType (pick) into a concrete object schema', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const previewSchema = result.components!.schemas!.AnimalPreview;
    expect(previewSchema.type).toStrictEqual('object');
    expect(Object.keys(previewSchema.properties!)).toStrictEqual(['name']);
  });

  it('Should flatten MixinType into a concrete object schema', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const mixinSchema = result.components!.schemas!.DogCatMixin;
    expect(mixinSchema.type).toStrictEqual('object');
    expect(mixinSchema.properties!.breed).toBeDefined();
    expect(mixinSchema.properties!.indoor).toBeDefined();
    expect(mixinSchema.properties!.name).toBeDefined();
  });

  it('Should map ArrayType field to {type:"array", items:$ref}', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    const kennelSchema = result.components!.schemas!.Kennel;
    expect(kennelSchema.properties!.dogs).toStrictEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Dog' },
    });
  });

  it('Should reuse a single $ref for a type referenced multiple times', () => {
    const result = OpenApiDocumentFactory.generate(doc);
    // "Dog" is referenced from Kennel.dogs (array), PetUnion (oneOf) and
    // DogCatMixin (flattened, so no $ref there) — only one component exists.
    expect(result.components!.schemas!.Dog).toBeDefined();
    expect(Object.keys(result.components!.schemas!)).toEqual(
      expect.arrayContaining(['Dog', 'Cat']),
    );
  });
});
