import { EnumType, HttpController, HttpOperation } from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { Customer, CustomersService } from 'example-customer-mongo';
import { Db } from 'mongodb';
import { type PartialDTO } from 'ts-gems';
import { CustomerNotesController } from './customer-notes.controller.js';

@(HttpController({
  description: `A single customer, addressed by id.

Every operation here targets exactly one \`Customer\` record, identified by the \`customerId\` path parameter. The nested **Notes** controller manages that customer's own notes.`,
  path: 'Customers',
  controllers: [
    (parent: CustomerController) => new CustomerNotesController(parent.db),
  ],
}).KeyParam('customerId', {
  type: 'integer',
  description: 'Id of the customer',
}))
export class CustomerController {
  service: CustomersService;

  constructor(readonly db: Db) {
    this.service = new CustomersService({ db });
  }

  @(HttpOperation.Entity.Get(Customer, {
    description: 'Returns a single customer by id.',
  }).QueryParam('xId', { description: 'Example of an ad-hoc query parameter' }))
  async get(context: HttpContext): Promise<PartialDTO<Customer> | undefined> {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).findById(key, options);
  }

  @HttpOperation.Entity.Delete(Customer, {
    description: `Deletes a single customer by id.

For deactivating a customer without removing their record entirely, see \`setStatus\`.`,
  })
  async delete(context: HttpContext) {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(key, options);
  }

  @HttpOperation.Entity.Update(Customer, {
    description: `Updates a single customer by id.

Accepts a partial \`Customer\` payload — only the supplied fields are changed.`,
  })
  async update(context: HttpContext) {
    const { key, data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).update(key, data, options);
  }

  @(HttpOperation.GET({
    description: `Sets the active/hidden status of a customer.

An alternative to deletion:

- \`active\` — the customer is shown normally
- \`hidden\` — the customer is excluded from default listings, without deleting its data

:::note
This operation returns no response body — check the status code to confirm the change was accepted.
:::`,
  }).QueryParam('status', {
    description: 'New status to set',
    type: EnumType(['active', 'hidden']),
  }))
  async setStatus(context: HttpContext) {
    console.log(`Status set to "${context.queryParams.status}"`);
  }
}
