import {
  ComplexType,
  HttpController,
  HttpOperation,
  OmitType,
  OperationResult,
} from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { Customer, CustomersService } from 'example-customer-mongo';
import { type PartialDTO } from 'ts-gems';
import type { CustomerApplication } from '../customer-application.js';

// `Customer` minus its server-generated `_id`, used as the create
// operation's request body. Naming it (rather than passing
// `OmitType(Customer, ['_id'])` inline) gives it its own page in the API
// reference, reachable like any other model — this `@ComplexType() class
// ... extends OmitType(...)` shape is OPRA's own pattern for a *named*
// mapped type (a bare `OmitType(...)` result only carries a name when
// wrapped this way; its `base` is the underlying (anonymous) MappedType).
@ComplexType()
export class CustomerCreateInput extends OmitType(Customer, ['_id']) {}

@HttpController({
  path: 'Customers',
  sections: ['Customers'],
})
export class CustomersController {
  protected _service?: CustomersService;

  constructor(readonly app: CustomerApplication) {}

  get service() {
    if (!this._service)
      this._service = new CustomersService({ db: this.app.db });
    return this._service;
  }

  @HttpOperation.Entity.Create(Customer, {
    requestBody: {
      type: CustomerCreateInput,
    },
  })
  async create(context: HttpContext): Promise<PartialDTO<Customer>> {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).create(data, options);
  }

  @(HttpOperation.Entity.FindMany(Customer)
    // The operators say what you may *write*; `notes` says what the field
    // means. The reference page prints it under each rule.
    .Filter('_id', {
      operators: ['=', '!=', '<', '>', '>=', '<=', 'in', '!in'],
      notes: 'Customer id',
    })
    .Filter('givenName', {
      operators: ['=', '!=', 'like', '!like', 'ilike', '!ilike'],
      notes: 'First name. `ilike` ignores case',
    })
    .Filter('familyName', {
      operators: ['=', '!=', 'like', '!like'],
      notes: 'Last name. Case-sensitive, unlike `givenName`',
    })
    .Filter('gender', { notes: 'One of the `Gender` values' })
    .Filter('uid', { notes: 'External identifier, unique per customer' })
    .Filter('address.countryCode', {
      notes: 'ISO 3166-1 alpha-2 code of the postal address',
    })
    .Filter('deleted', { notes: 'Soft-delete flag' })
    .Filter('active', { notes: 'Active or not' })
    .Filter('birthDate', { notes: 'Date of birth' })
    .Filter('rate', {
      operators: ['=', '!=', '<', '>', '>=', '<=', 'in', '!in'],
      notes: 'Pricing/loyalty multiplier',
    })
    .SortFields(
      '_id',
      'givenName',
      'familyName',
      'gender',
      'address.countryCode',
    )
    .DefaultSort('givenName'))
  async findMany(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    if (options.count) {
      const { items, count } = await this.service
        .for(context)
        .findManyWithCount(options);
      return new OperationResult({
        payload: items,
        totalMatches: count,
      });
    }
    return this.service.for(context).findMany(options);
  }

  @(HttpOperation.Entity.DeleteMany(Customer).Filter(
    '_id',
    '=, !=, <, >, >=, <=, in, !in',
  ))
  async deleteMany(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).deleteMany(options);
  }

  @(HttpOperation.Entity.UpdateMany(Customer).Filter(
    '_id',
    '=, !=, <, >, >=, <=, in, !in',
  ))
  async updateMany(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).updateMany(data, options);
  }
}
