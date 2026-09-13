import { ApiDocumentFactory, OpraSchema } from '@opra/common';
import { CustomerModelsDocument } from 'example-customer-mongo/models';
import { AuthController } from './api/auth.controller.js';
import { CountriesController } from './api/countries.controller.js';
import { CountryController } from './api/country.controller.js';
import { CustomerController } from './api/customer.controller.js';
import { CustomersController } from './api/customers.controller.js';

export namespace TestHttpApiDocument {
  export async function create() {
    const customerDoc = await CustomerModelsDocument.init();
    return ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: {
        title: 'TestHttpApi',
        version: 'v1',
        description: 'Document description',
      },
      references: {
        ns1: customerDoc,
      },
      api: {
        transport: 'http',
        name: 'TestService',
        description: 'test service',
        url: '/test',
        servers: [
          { url: 'https://api.example.com', description: 'Test server' },
        ],
        groups: [
          { name: 'Customers', description: 'Customer management', icon: '👤' },
        ],
        controllers: [
          AuthController,
          CountriesController,
          CountryController,
          CustomersController,
          CustomerController,
        ],
      },
    });
  }
}
