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
import { Db } from 'mongodb';
import { type PartialDTO } from 'ts-gems';

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
  description: 'The customers collection',
  path: 'Customers',
})
export class CustomersController {
  service: CustomersService;

  constructor(readonly db: Db) {
    this.service = new CustomersService({ db });
  }

  @HttpOperation.Entity.Create(Customer, {
    description: 'Creates a new customer',
    requestBody: {
      type: CustomerCreateInput,
    },
  })
  async create(context: HttpContext): Promise<PartialDTO<Customer>> {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).create(data, options);
  }

  @(HttpOperation.Entity.FindMany(Customer, {
    description: 'Returns customers matching the given filter',
  })
    .Filter('_id', ['=', '!=', '<', '>', '>=', '<=', 'in', '!in'])
    .Filter('givenName', ['=', '!=', 'like', '!like', 'ilike', '!ilike'])
    .Filter('familyName', ['=', '!=', 'like', '!like'])
    .Filter('gender')
    .Filter('uid')
    .Filter('address.countryCode')
    .Filter('deleted')
    .Filter('active')
    .Filter('birthDate')
    .Filter('rate', ['=', '!=', '<', '>', '>=', '<=', 'in', '!in'])
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

  @(HttpOperation.Entity.DeleteMany(Customer, {
    description: 'Deletes multiple customers matching a filter',
  }).Filter('_id', '=, !=, <, >, >=, <=, in, !in'))
  async deleteMany(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).deleteMany(options);
  }

  @(HttpOperation.Entity.UpdateMany(Customer, {
    description: 'Updates multiple customers matching a filter',
  }).Filter('_id', '=, !=, <, >, >=, <=, in, !in'))
  async updateMany(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).updateMany(data, options);
  }
}
