import { HttpController, HttpOperation } from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { Customer, CustomersService } from 'example-customer-mongo';
import { Db } from 'mongodb';
import { type PartialDTO } from 'ts-gems';
import { CustomerNotesController } from './customer-notes.controller.js';

@HttpController({
  path: 'Customers',
  controllers: [CustomerNotesController],
  sections: ['Customers'],
})
export class CustomerController {
  service: CustomersService;

  constructor(readonly db: Db) {
    this.service = new CustomersService({ db });
  }

  @(HttpOperation.Entity.Get(Customer).KeyParam('_id', Number))
  async get(context: HttpContext): Promise<PartialDTO<Customer> | undefined> {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).findById(key, options);
  }

  @(HttpOperation.Entity.Delete(Customer).KeyParam('_id', Number))
  async delete(context: HttpContext) {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(key, options);
  }

  @(HttpOperation.Entity.Update(Customer).KeyParam('_id', Number))
  async update(context: HttpContext) {
    const { key, data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).update(key, data, options);
  }
}
