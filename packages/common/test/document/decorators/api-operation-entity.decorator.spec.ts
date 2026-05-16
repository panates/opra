import 'reflect-metadata';
import {
  FieldPathType,
  FilterType,
  HTTP_CONTROLLER_METADATA,
  HttpOperation,
  IntegerType,
  MimeTypes,
} from '@opra/common';
import { Customer } from 'example-customer-mongo/models';
import { expect } from 'expect';

describe('common:HttpOperation.Entity.* decorators', () => {
  const queryParams = {
    limit: {
      location: 'query',
      name: 'limit',
      description: expect.any(String),
      type: new IntegerType({
        minValue: 1,
      }),
    },
    skip: {
      location: 'query',
      name: 'skip',
      description: expect.any(String),
      type: new IntegerType({
        minValue: 1,
      }),
    },
    count: {
      location: 'query',
      name: 'count',
      description: expect.any(String),
      type: Boolean,
      designType: Boolean,
    },
    projection: {
      location: 'query',
      name: 'projection',
      description: expect.any(String),
      isArray: true,
      type: expect.any(FieldPathType),
      arraySeparator: ',',
    },
    filter: {
      location: 'query',
      description: 'Determines filter fields',
      name: 'filter',
      type: {
        dataType: Customer,
        rules: {},
      },
    },
    sort: {
      location: 'query',
      name: 'sort',
      description: 'Determines sort fields',
      isArray: true,
      arraySeparator: ',',
      type: expect.any(Object),
      parser: expect.any(Function),
    },
  };

  /* ***************************************************** */
  describe('common:"Create" decorator', () => {
    it('Should define Create operation metadata', async () => {
      class CustomerResource {
        @HttpOperation.Entity.Create({
          type: Customer,
          description: 'operation description',
          requestBody: {
            maxContentSize: 1000,
          },
        })
        create() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.create;
      expect(opr).toBeDefined();
      expect({
        ...opr,
        parameters: undefined,
        responses: undefined,
        requestBody: undefined,
      }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'POST',
        composition: 'Entity.Create',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual(['projection']);
      expect(opr.parameters.find(prm => prm.name === 'projection')).toEqual({
        location: 'query',
        name: 'projection',
        description: expect.any(String),
        isArray: true,
        arraySeparator: ',',
        type: expect.any(FieldPathType),
      });
      expect(opr.requestBody).toEqual({
        content: [
          {
            contentType: [
              MimeTypes.json,
              MimeTypes.yaml,
              MimeTypes.yaml2,
              MimeTypes.toml,
              MimeTypes.toml2,
            ],
            contentEncoding: 'utf-8',
            type: Customer,
            designType: Customer,
          },
        ],
        maxContentSize: 1000,
        required: true,
        immediateFetch: true,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 201,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          designType: Customer,
          partial: 'deep',
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });
  });

  /* ***************************************************** */
  describe('common:"Delete" decorator', () => {
    it('Should define Delete operation metadata', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.Delete({
          type: Customer,
          description: 'operation description',
        }).KeyParam('id', 'number'))
        delete() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.delete;
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'DELETE',
        path: '@:id',
        mergePath: true,
        composition: 'Entity.Delete',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual(['id']);
      expect(opr.parameters.find(prm => prm.name === 'id')).toEqual({
        location: 'path',
        name: 'id',
        type: 'number',
        keyParam: true,
      });
      expect(opr.responses).toEqual([
        {
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          statusCode: 200,
        },
        {
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          statusCode: 422,
        },
      ]);
    });
  });

  /* ***************************************************** */
  describe('common:"DeleteMany" decorator', () => {
    it('Should define DeleteMany operation metadata', async () => {
      class CustomerResource {
        @HttpOperation.Entity.DeleteMany({
          type: Customer,
          description: 'operation description',
        })
        deleteMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.deleteMany;
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'DELETE',
        composition: 'Entity.DeleteMany',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });

    it('Should Filter() define filter parameter', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.DeleteMany({ type: Customer })
          .Filter('_id', ['=', '!='])
          .Filter('name', {
            operators: ['=', '!=', 'like'],
          }))
        deleteMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.deleteMany;
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        method: 'DELETE',
        composition: 'Entity.DeleteMany',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual(['filter']);
      expect(opr.parameters.find(prm => prm.name === 'filter')).toEqual({
        location: 'query',
        name: 'filter',
        description: 'Determines filter fields',
        type: {
          dataType: Customer,
          rules: {
            _id: {
              operators: ['=', '!='],
            },
            name: {
              operators: ['=', '!=', 'like'],
            },
          },
        },
      });
    });
  });

  /* ***************************************************** */
  describe('common:"FindMany" decorator', () => {
    it('Should define FindMany operation metadata', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.FindMany({
          type: Customer,
          description: 'operation description',
        })
          .Filter('_id', ['=', '!='])
          .SortFields('givenName', 'familyName'))
        findMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.findMany;
      expect(opr).toBeDefined();
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'GET',
        composition: 'Entity.FindMany',
        compositionOptions: {
          type: 'Customer',
          sortFields: {
            familyName: 'familyName',
            givenName: 'givenName',
          },
        },
        type: Customer,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual([
        'limit',
        'skip',
        'count',
        'projection',
        'filter',
        'sort',
      ]);
      expect(opr.parameters.find(prm => prm.name === 'limit')).toEqual(
        queryParams.limit,
      );
      expect(opr.parameters.find(prm => prm.name === 'skip')).toEqual(
        queryParams.skip,
      );
      expect(opr.parameters.find(prm => prm.name === 'count')).toEqual(
        queryParams.count,
      );
      expect(opr.parameters.find(prm => prm.name === 'projection')).toEqual(
        queryParams.projection,
      );
      expect(opr.parameters.find(prm => prm.name === 'filter')).toMatchObject(
        queryParams.filter,
      );
      expect(opr.parameters.find(prm => prm.name === 'sort')).toEqual(
        queryParams.sort,
      );
      expect(opr.responses).toEqual([
        {
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          statusCode: 200,
          type: expect.any(Function),
          designType: Customer,
          partial: 'deep',
          isArray: true,
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });

    it('Should Filter() define metadata value', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.FindMany({ type: Customer })
          .Filter('_id', ['=', '!='])
          .Filter('givenName', ['=', '!=', 'like']))
        findMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.findMany;
      expect(opr).toBeDefined();
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        method: 'GET',
        composition: 'Entity.FindMany',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.parameters.find(prm => prm.name === 'filter')).toEqual({
        location: 'query',
        description: 'Determines filter fields',
        name: 'filter',
        type: {
          dataType: Customer,
          rules: {
            _id: {
              operators: ['=', '!='],
            },
            givenName: {
              operators: ['=', '!=', 'like'],
            },
          },
        },
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          partial: 'deep',
          isArray: true,
          designType: Customer,
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });

    it('Should SortFields() define metadata value', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.FindMany({ type: Customer }).SortFields(
          '_id',
          'givenName',
        ))
        findMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.findMany;
      expect(opr).toBeDefined();
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        method: 'GET',
        composition: 'Entity.FindMany',
        compositionOptions: {
          type: 'Customer',
          sortFields: { _id: '_id', givenName: 'givenName' },
        },
        type: Customer,
      });
      expect(opr.parameters.find(prm => prm.name === 'sort')).toEqual(
        queryParams.sort,
      );
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          designType: Customer,
          partial: 'deep',
          isArray: true,
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });

    it('Should DefaultSort() define metadata value', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.FindMany({ type: Customer }).DefaultSort(
          'givenName',
        ))
        findMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.findMany;
      expect(opr).toBeDefined();
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        method: 'GET',
        composition: 'Entity.FindMany',
        compositionOptions: {
          type: 'Customer',
          defaultSort: ['givenName'],
        },
        type: Customer,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          designType: Customer,
          partial: 'deep',
          isArray: true,
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });
  });

  /* ***************************************************** */
  describe('common:"Get" decorator', () => {
    it('Should define Get operation metadata', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.Get({
          type: Customer,
          description: 'operation description',
        }).KeyParam('id'))
        get() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.get;
      expect(opr).toBeDefined();
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'GET',
        path: '@:id',
        mergePath: true,
        composition: 'Entity.Get',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
        parameters: undefined,
        responses: undefined,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual([
        'projection',
        'id',
      ]);
      expect(opr.parameters.find(prm => prm.name === 'projection')).toEqual({
        location: 'query',
        name: 'projection',
        description: expect.any(String),
        isArray: true,
        arraySeparator: ',',
        type: expect.any(FieldPathType),
      });
      expect(opr.parameters.find(prm => prm.name === 'id')).toEqual({
        location: 'path',
        name: 'id',
        keyParam: true,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          designType: Customer,
          partial: 'deep',
        },
        {
          statusCode: 204,
          description: expect.any(String),
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });
  });

  /* ***************************************************** */
  describe('common:"Replace" decorator', () => {
    it('Should define Replace operation metadata', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.Replace({
          type: Customer,
          description: 'operation description',
        }).KeyParam('id'))
        get() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.get;
      expect(opr).toBeDefined();
      expect({ ...opr, parameters: undefined, responses: undefined }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'POST',
        path: '@:id',
        mergePath: true,
        composition: 'Entity.Replace',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
        parameters: undefined,
        responses: undefined,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual([
        'projection',
        'id',
      ]);
      expect(opr.parameters.find(prm => prm.name === 'projection')).toEqual({
        location: 'query',
        name: 'projection',
        description: expect.any(String),
        isArray: true,
        arraySeparator: ',',
        type: expect.any(FieldPathType),
      });
      expect(opr.parameters.find(prm => prm.name === 'id')).toEqual({
        location: 'path',
        name: 'id',
        keyParam: true,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          partial: 'deep',
          designType: Customer,
        },
        {
          statusCode: 204,
          description: expect.any(String),
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });
  });

  /* ***************************************************** */
  describe('common:"UpdateMany" decorator', () => {
    it('Should define UpdateMany operation metadata', async () => {
      class CustomerResource {
        @HttpOperation.Entity.UpdateMany({
          type: Customer,
          description: 'operation description',
          requestBody: {
            maxContentSize: 1000,
          },
        })
        updateMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.updateMany;
      expect(opr).toBeDefined();
      expect({
        ...opr,
        parameters: undefined,
        responses: undefined,
        requestBody: undefined,
      }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'PATCH',
        composition: 'Entity.UpdateMany',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.requestBody).toEqual({
        content: [
          {
            contentType: [
              MimeTypes.json,
              MimeTypes.yaml,
              MimeTypes.yaml2,
              MimeTypes.toml,
              MimeTypes.toml2,
            ],
            contentEncoding: 'utf-8',
            type: Customer,
            designType: Customer,
          },
        ],
        maxContentSize: 1000,
        required: true,
        immediateFetch: true,
        partial: 'deep',
        allowNullOptionals: true,
        allowPatchOperators: true,
        keepKeyFields: true,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });

    it('Should Filter() define metadata value', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.UpdateMany({ type: Customer })
          .Filter('_id', ['=', '!='])
          .Filter('givenName', ['=', '!=', 'like']))
        updateMany() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.updateMany;
      expect(opr).toBeDefined();
      expect(opr.method).toEqual('PATCH');
      expect(opr.compositionOptions).toEqual({
        type: 'Customer',
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual(['filter']);
      expect(opr.parameters.find(prm => prm.name === 'filter')).toEqual({
        location: 'query',
        name: 'filter',
        description: 'Determines filter fields',
        type: {
          dataType: Customer,
          rules: {
            _id: {
              operators: ['=', '!='],
            },
            givenName: {
              operators: ['=', '!=', 'like'],
            },
          },
        },
      });
    });
  });

  /* ***************************************************** */
  describe('common:"Update" decorator', () => {
    it('Should define Update operation metadata', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.Update({
          type: Customer,
          description: 'operation description',
          requestBody: {
            maxContentSize: 1000,
          },
        })
          .KeyParam('id', 'number')
          .Filter('gender', ['=', '!=']))
        updateOne() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.updateOne;
      expect(opr).toBeDefined();
      expect({
        ...opr,
        parameters: undefined,
        responses: undefined,
        requestBody: undefined,
      }).toEqual({
        kind: 'HttpOperation',
        description: 'operation description',
        method: 'PATCH',
        path: '@:id',
        mergePath: true,
        composition: 'Entity.Update',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.parameters.map(prm => prm.name)).toStrictEqual([
        'projection',
        'id',
        'filter',
      ]);
      expect(opr.parameters.find(prm => prm.name === 'projection')).toEqual({
        location: 'query',
        name: 'projection',
        description: expect.any(String),
        isArray: true,
        arraySeparator: ',',
        type: expect.any(FieldPathType),
      });
      expect(opr.parameters.find(prm => prm.name === 'filter')).toEqual({
        description: expect.any(String),
        location: 'query',
        name: 'filter',
        type: expect.any(FilterType),
      });
      expect(opr.parameters.find(prm => prm.name === 'id')).toEqual({
        location: 'path',
        name: 'id',
        type: 'number',
        keyParam: true,
      });
      expect(opr.requestBody).toEqual({
        content: [
          {
            contentType: [
              MimeTypes.json,
              MimeTypes.yaml,
              MimeTypes.yaml2,
              MimeTypes.toml,
              MimeTypes.toml2,
            ],
            contentEncoding: 'utf-8',
            type: Customer,
            designType: Customer,
          },
        ],
        maxContentSize: 1000,
        required: true,
        immediateFetch: true,
        partial: 'deep',
        allowNullOptionals: true,
        allowPatchOperators: true,
        keepKeyFields: true,
      });
      expect(opr.responses).toEqual([
        {
          statusCode: 200,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
          type: expect.any(Function),
          designType: Customer,
          partial: 'deep',
        },
        {
          description: expect.any(String),
          statusCode: 204,
        },
        {
          statusCode: 422,
          description: expect.any(String),
          contentType: 'application/opra.response+json',
          contentEncoding: 'utf-8',
        },
      ]);
    });

    it('Should Filter() define metadata value', async () => {
      class CustomerResource {
        @(HttpOperation.Entity.Update({
          type: Customer,
        })
          .KeyParam('id', 'number')
          .Filter('_id', ['=', '!='])
          .Filter('givenName', ['=', '!=', 'like']))
        updateOne() {}
      }

      const metadata = Reflect.getMetadata(
        HTTP_CONTROLLER_METADATA,
        CustomerResource,
      );
      const opr = metadata.operations?.updateOne;
      expect(opr).toBeDefined();
      expect({
        ...opr,
        parameters: undefined,
        responses: undefined,
        requestBody: undefined,
      }).toEqual({
        kind: 'HttpOperation',
        method: 'PATCH',
        path: '@:id',
        mergePath: true,
        composition: 'Entity.Update',
        compositionOptions: {
          type: 'Customer',
        },
        type: Customer,
      });
      expect(opr.parameters.find(prm => prm.name === 'filter')).toEqual({
        location: 'query',
        name: 'filter',
        description: expect.any(String),
        type: {
          dataType: Customer,
          rules: {
            _id: {
              operators: ['=', '!='],
            },
            givenName: {
              operators: ['=', '!=', 'like'],
            },
          },
        },
      });
    });
  });
});
