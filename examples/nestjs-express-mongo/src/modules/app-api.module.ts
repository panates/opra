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
          { name: 'Panates', email: 'info@panates.com', url: 'https://panates.com' },
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
      schemaIsPublic: true,
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
