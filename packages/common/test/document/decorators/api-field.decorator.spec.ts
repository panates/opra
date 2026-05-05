import { ApiField, ComplexType, DATATYPE_METADATA } from '@opra/common';
import { expect } from 'expect';

describe('common:ApiField() decorator', () => {
  it('Should define field metadata', async () => {
    @ComplexType()
    class Animal {
      @ApiField({
        type: 'integer',
        description: 'description',
        scopePattern: 'public',
      })
      declare id: number;
    }
    const metadata = Reflect.getMetadata(DATATYPE_METADATA, Animal);
    expect(metadata).toBeDefined();
    expect(metadata.fields).toMatchObject({
      id: {
        type: 'integer',
        description: 'description',
        scopePattern: 'public',
      },
    });
  });

  it('Should determine design type if "type" is not defined', async () => {
    class Country {
      @ApiField()
      declare id: number;
      @ApiField()
      declare name: string;
    }

    class Person {
      @ApiField()
      declare country: Country;
    }

    const metadata = Reflect.getMetadata(DATATYPE_METADATA, Person);
    expect(metadata).toBeDefined();
    expect(metadata.fields).toMatchObject({
      country: {
        type: Country,
      },
    });
  });

  it('Should validate if field name is string', async () => {
    const sym = Symbol('sym');

    class Person {}

    expect(() => ApiField({})(Person.prototype, sym)).toThrow("can't be used");
  });

  it('Should define override', async () => {
    class Animal {
      @(ApiField({
        type: 'integer',
        readonly: true,
      }).Override('db', {
        readonly: false,
      }))
      declare id: number;
    }

    const metadata = Reflect.getMetadata(DATATYPE_METADATA, Animal);
    expect(metadata).toBeDefined();
    expect(metadata.fields).toMatchObject({
      id: {
        type: 'integer',
        readonly: true,
        override: [
          {
            scopePattern: ['db'],
            readonly: false,
          },
        ],
      },
    });
  });
});
