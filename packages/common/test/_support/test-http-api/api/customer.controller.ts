import { HttpController, HttpOperation } from '@opra/common';
import { Customer } from 'example-customer-mongo/models';

@(HttpController({
  description: 'Customer resource',
  path: 'Customers@:customerId',
}).PathParam('customerId', 'uuid'))
export class CustomerController {
  @HttpOperation.Entity.Get({
    type: Customer,
    title: 'Get a customer',
    sections: ['Customers'],
  })
  get() {
    //
  }

  @HttpOperation.Entity.Delete({ type: Customer })
  delete() {
    //
  }
}
