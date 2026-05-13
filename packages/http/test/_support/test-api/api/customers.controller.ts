import { merge } from '@jsopen/objects';
import { HttpController, HttpOperation, OperationResult } from '@opra/common';
import { HttpContext } from '@opra/http';
import { Customer } from 'example-customer-mongo/models';
import { Data } from '../../../../../../examples/_lib/data/customers-data.js';

@HttpController({
  description: 'Customer resource',
})
export class CustomersController {
  @HttpOperation.Entity.Create(Customer)
  async create(context: HttpContext) {
    const body = await context.getBody<Customer>();
    const customer: Customer = { ...body, _id: ++Data.idGen };
    Data.customers.push(customer);
    return customer;
  }

  @(HttpOperation.Entity.DeleteMany(Customer)
    .Filter('_id', ['=', '>', '<', '>=', '<='])
    .Filter('gender', ['='])
    .Filter('address.countryCode', ['=']))
  async deleteMany() {
    // It is hard to produce a filtering operation. We delete 10 records instead of this
    const oldLen = Data.customers.length;
    Data.customers = Data.customers.slice(0, oldLen - 10);
    return oldLen - Data.customers.length;
  }

  @(HttpOperation.Entity.UpdateMany(Customer)
    .Filter('_id', ['=', '>', '<', '>=', '<='])
    .Filter('gender')
    .Filter('address.countryCode', ['=']))
  async updateMany(context: HttpContext) {
    // It is hard to produce a filtering operation. We update 5 records instead of this
    const body = await context.getBody<Customer>();
    for (let i = Data.customers.length - 5; i < Data.customers.length; i++) {
      merge(Data.customers[i], body);
    }
    return 5;
  }

  @(HttpOperation.Entity.FindMany(Customer)
    .SortFields(
      '_id',
      'givenName',
      'familyName',
      'gender',
      'address.countryCode',
    )
    .DefaultSort('givenName')
    .Filter('_id', ['=', '>', '<', '>=', '<='])
    .Filter('givenName', ['=', 'like', '!like'])
    .Filter('familyName', ['=', 'like', '!like'])
    .Filter('gender', ['='])
    .Filter('address.countryCode', ['=']))
  async findMany(ctx: HttpContext) {
    const { queryParams } = ctx;
    const skip = queryParams.skip || 0;
    const limit = queryParams.limit || 10;
    return new OperationResult({
      totalMatches: Data.customers.length,
      payload: Data.customers.slice(skip, skip + limit),
    });
  }

  @(HttpOperation({ path: '/sendMessage' })
    .QueryParam('message', String)
    .QueryParam('all', {
      type: Boolean,
      default: true,
    }))
  async sendMessage(context: HttpContext) {
    return { sent: 10, message: context.queryParams.message };
  }
}
