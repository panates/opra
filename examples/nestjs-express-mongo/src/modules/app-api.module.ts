import * as process from 'node:process';
import { Logger, Module } from '@nestjs/common';
import { OpraHttpModule, OpraHttpNestjsAdapter } from '@opra/nestjs-http';
import { CustomerModelsDocument } from 'example-customer-mongo';
import { AuthController } from '../api/auth.controller.js';
import { CustomerController } from '../api/customer.controller.js';
import { CustomerNotesController } from '../api/customer-notes.controller.js';
import { CustomersController } from '../api/customers-controller.js';
import { AppDbModule } from './app-db.module.js';

@Module({
  imports: [
    AppDbModule,
    OpraHttpModule.forRoot({
      name: 'CustomerApi',
      info: {
        title: 'Customer Application',
        version: '1.0',
        description:
          'Sample Opra API demonstrating a NestJS integration with authentication and a customer/notes CRUD API backed by MongoDB',
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
      controllers: [
        AuthController,
        CustomerController,
        CustomersController,
        CustomerNotesController,
      ],
      // The same three this application's Express twin declares (see
      // `examples/express-mongo/src/api-document.ts`) - the operations
      // already name them, the module just had no way to say what they are.
      sections: [
        { name: 'Account', icon: '👤' },
        { name: 'Customers', icon: '🧾' },
        { name: 'Notes', icon: '📝' },
      ],
      servers: [
        // `docKey` because the url itself is environment-dependent and would
        // make a moving documentation key.
        { url: 'http://localhost:3012', docKey: 'local' },
      ],
      schemaIsPublic: true,
      openapi: true,
      apiUi: {
        pageTitle: 'Customer Application',
        // Same two scopes `examples/express-mongo`'s own Express wiring
        // publishes — see its `customer-application.ts` for what "db"
        // actually reveals (soft-delete/audit fields, `Config`, etc.).
        scopes: ['api', 'db'],
      },
    }),
  ],
})
export class AppApiModule {
  readonly logger: Logger;

  constructor(readonly opraAdapter: OpraHttpNestjsAdapter) {
    this.logger = new Logger(opraAdapter.document.api!.name!);
    opraAdapter.on('request', context => {
      if (process.env.NODE_ENV !== 'test') {
        const { request } = context;
        this.logger.verbose(
          `Request from: ${request.ip} | ${request.method} | ${request.url}`,
        );
      }
    });
    opraAdapter.on('error', context => {
      if (process.env.NODE_ENV !== 'test') {
        const { request, response, errors } = context;
        errors.forEach(error =>
          this.logger.error(`${response.statusCode}|${request.ip}|${error}`),
        );
      }
    });
  }
}
