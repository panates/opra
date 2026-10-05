import {
  ApiDocumentFactory,
  ComplexType,
  HttpApi,
  HttpController,
  HttpOperation,
  HttpStatusRange,
  MimeTypes,
} from '@opra/common';
import { Country, CountryCodeType } from 'example-customer-mongo/models';
import { expect } from 'expect';

describe('common:HttpApiFactory - HttpOperation (Class)', () => {
  it('Should import resource class', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @HttpOperation.GET({
        description: 'Returns single country',
        path: ':id',
      })
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr?.method).toEqual('GET');
    expect(opr?.description).toEqual('Returns single country');
    expect(opr?.path).toEqual(':id');
  });

  it('Should import cookie parameters', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @(HttpOperation.GET({
        description: 'Returns single country',
      }).Cookie('access-token', { type: 'uuid', required: true }))
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr!.parameters.map(x => x.name)).toEqual(['access-token']);
    expect(opr!.findParameter('access-token')?.location).toEqual('cookie');
    expect(opr!.findParameter('access-token')?.required).toEqual(true);
  });

  it('Should import headers', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @(HttpOperation.GET({
        description: 'Returns single country',
      }).Header('access-token', { type: 'uuid', required: true }))
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr!.parameters.map(x => x.name)).toEqual(['access-token']);
    expect(opr!.findParameter('access-token')?.location).toEqual('header');
    expect(opr!.findParameter('access-token')?.required).toEqual(true);
  });

  it('Should import query parameters', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @(HttpOperation.GET({
        description: 'Returns single country',
      }).QueryParam('access-token', { type: 'uuid', required: true }))
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr!.parameters.map(x => x.name)).toEqual(['access-token']);
    expect(opr!.findParameter('access-token')?.location).toEqual('query');
    expect(opr!.findParameter('access-token')?.required).toEqual(true);
  });

  it('Should import url parameters', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @(HttpOperation.GET({
        description: 'Returns single country',
      }).PathParam('access-token', { type: 'uuid', required: true }))
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr!.parameters.map(x => x.name)).toEqual(['access-token']);
    expect(opr!.findParameter('access-token')?.location).toEqual('path');
    expect(opr!.findParameter('access-token')?.required).toEqual(true);
  });

  it('Should import responses', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @(HttpOperation.GET({
        description: 'Returns single country',
      })
        .Response(200)
        .Response([400, 401], {
          type: 'object',
          contentType: 'application/json',
          contentEncoding: 'utf-8',
          description: 'xyz',
        })
        .Response('400-401', { type: 'object' }))
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr?.responses.length).toEqual(3);
    expect(opr?.responses[0].toJSON()).toEqual({
      statusCode: 200,
    });
    expect(opr?.responses[1].toJSON()).toEqual({
      statusCode: [400, 401],
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      description: 'xyz',
      type: 'object',
    });
    expect(opr?.responses[2].toJSON()).toEqual({
      statusCode: [new HttpStatusRange(400, 401)],
      contentEncoding: 'utf-8',
      contentType: 'application/json',
      type: 'object',
    });
  });

  it('Should import request body', async () => {
    @HttpController({
      description: 'Country collection',
    })
    class CountriesController {
      @(HttpOperation.POST({}).RequestContent(Country))
      findOne() {}
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Country, CountryCodeType],
      api: {
        transport: 'http',
        name: 'TestService',
        controllers: [CountriesController],
      },
    });
    expect(doc).toBeDefined();
    expect(doc.api).toBeDefined();
    const r = (doc.api as HttpApi).findController('countries');
    expect(r).toBeDefined();
    expect(r!.ctor).toBe(CountriesController);
    const opr = r!.operations.get('findOne');
    expect(opr).toBeDefined();
    expect(opr?.requestBody).toBeDefined();
    expect(opr?.requestBody?.required).toStrictEqual(true);
    expect(opr?.requestBody?.content).toBeDefined();
    expect(opr?.requestBody?.content.length).toEqual(1);
    expect(opr?.requestBody?.content[0]).toEqual({
      id: expect.any(String),
      contentType: [
        MimeTypes.json,
        MimeTypes.yaml,
        MimeTypes.yaml2,
        MimeTypes.toml,
        MimeTypes.toml2,
      ],
      contentEncoding: 'utf-8',
      type: expect.any(ComplexType),
      designType: Country,
      multipartFields: [],
    });
  });
});
