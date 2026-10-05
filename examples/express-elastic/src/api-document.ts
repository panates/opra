import { Client } from '@elastic/elasticsearch';
import { ApiDocument, ApiDocumentFactory } from '@opra/common';
import { CustomerModelsDocument } from 'example-customer-elastic';
import { AuthController } from './api/auth.controller.js';

export namespace CustomerApiDocument {
  export async function create(client: Client): Promise<ApiDocument> {
    return ApiDocumentFactory.createDocument({
      info: {
        title: 'Customer Application',
        version: '1.0',
        description:
          'Sample Opra API demonstrating authentication backed by Elasticsearch',
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
        cm: () => CustomerModelsDocument.create(),
      },
      api: {
        name: 'CustomerApi',
        transport: 'http',
        controllers: [new AuthController(client)],
      },
    });
  }
}
