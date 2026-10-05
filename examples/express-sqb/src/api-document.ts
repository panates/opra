import { ApiDocument, ApiDocumentFactory } from '@opra/common';
import { SqbClient } from '@sqb/connect';
import { CustomerModelsDocument } from 'example-customer-sqb';
import { AuthController } from './api/auth.controller.js';
import { CustomerController } from './api/customer-controller.js';
import { CustomersController } from './api/customers-controller.js';

export namespace CustomerApiDocument {
  export async function create(db: SqbClient): Promise<ApiDocument> {
    return ApiDocumentFactory.createDocument({
      info: {
        title: 'Customer Application',
        version: '1.0',
        description:
          'Sample Opra API demonstrating authentication and a customer/notes CRUD API backed by a SQL database via SQB',
        termsOfService: 'https://panates.com/terms-of-service',
        contact: [
          {
            name: 'Panates',
            email: 'info@panates.com',
            url: 'https://panates.com',
          },
        ],
        license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
      },
      references: {
        cm: await CustomerModelsDocument.create(),
      },
      api: {
        name: 'CustomerApi',
        transport: 'http',
        controllers: [
          new AuthController(db),
          new CustomerController(db),
          new CustomersController(db),
        ],
      },
    });
  }
}
