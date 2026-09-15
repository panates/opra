import path from 'node:path';
import {
  ApiDocument,
  ApiDocumentFactory,
  TranslationFileStore,
} from '@opra/common';
import { CustomerModelsDocument } from 'example-customer-mongo';
import { AuthController } from './api/auth.controller.js';
import { CustomerController } from './api/customer.controller.js';
import {
  CustomerCreateInput,
  CustomersController,
} from './api/customers-controller.js';
import type { CustomerApplication } from './customer-application.js';

export namespace CustomerApiDocument {
  export async function create(app: CustomerApplication): Promise<ApiDocument> {
    const doc = await ApiDocumentFactory.createDocument({
      info: {
        title: 'Customer Application',
        version: '1.0',
        contact: [
          {
            name: 'Eren Aydın',
            email: 'eren.aydin@panates.com',
            url: 'https://panates.com',
          },
          {
            name: 'Naz Demir',
            email: 'naz.demir@panates.com',
            url: 'https://panates.com/team/naz-demir',
          },
        ],
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      types: [CustomerCreateInput],
      // Every human-readable text this API publishes — descriptions,
      // operation titles, the terms of service, even the license text —
      // lives in `docs/<lang>.json`, keyed by the same tree the schema
      // itself has, rather than inline in the declarations below. Requests
      // pick one with `?lang=` (`GET $schema?lang=tr`, `/ui?lang=tr`);
      // `oprimp docs:extract` keeps the files in sync with this document.
      translationStore: new TranslationFileStore(
        path.join(import.meta.dirname, '../docs'),
      ),
      references: {
        cm: () => CustomerModelsDocument.create(),
      },
      api: {
        name: 'CustomerApi',
        transport: 'http',
        servers: [
          // `docKey` because the url itself is environment-dependent and
          // would make a moving documentation key.
          { url: 'http://localhost:3001', docKey: 'local' },
        ],
        sections: [
          { name: 'Account', icon: '👤' },
          { name: 'Customers', icon: '🧾' },
          { name: 'Notes', icon: '📝' },
        ],
        controllers: [
          new AuthController(app),
          new CustomerController(app),
          new CustomersController(app),
        ],
      },
    });
    return doc;
  }
}
