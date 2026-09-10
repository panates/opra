import { ApiDocument, ApiDocumentFactory } from '@opra/common';
import { CustomerModelsDocument } from 'example-customer-mongo';
import { Db } from 'mongodb';
import { AuthController } from './api/auth.controller.js';
import { CustomerController } from './api/customer.controller.js';
import { CustomersController } from './api/customers-controller.js';

export namespace CustomerApiDocument {
  export async function create(db: Db): Promise<ApiDocument> {
    return ApiDocumentFactory.createDocument({
      info: {
        title: 'Customer Application',
        version: '1.0',
        description:
          'Sample Opra API demonstrating authentication, a user profile, and a customer/notes CRUD API backed by MongoDB',
      },
      references: {
        cm: () => CustomerModelsDocument.create(),
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
