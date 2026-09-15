import {
  ApiField,
  ComplexType,
  EnumType,
  HttpController,
  HttpOperation,
  OperationResult,
} from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { Customer, CustomersService } from 'example-customer-mongo';
import { type PartialDTO } from 'ts-gems';
import type { CustomerApplication } from '../customer-application.js';
import { CustomerNotesController } from './customer-notes.controller.js';

@ComplexType({})
class AvatarUrlInput {
  @ApiField({
    examples: ['https://example.com/avatars/42.png'],
  })
  declare url: string;
}

@(HttpController({
  path: 'Customers',
  controllers: [
    (parent: CustomerController) => new CustomerNotesController(parent.app),
  ],
})
  .KeyParam('customerId', {
    type: 'integer',
  })
  .UseType(AvatarUrlInput))
export class CustomerController {
  protected _service?: CustomersService;

  constructor(readonly app: CustomerApplication) {}

  get service() {
    if (!this._service)
      this._service = new CustomersService({ db: this.app.db });
    return this._service;
  }

  @(HttpOperation.Entity.Get(Customer, {
    sections: ['Customers'],
  }).QueryParam('xId'))
  async get(context: HttpContext): Promise<PartialDTO<Customer> | undefined> {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).findById(key, options);
  }

  @HttpOperation.Entity.Delete(Customer, {
    sections: ['Customers'],
  })
  async delete(context: HttpContext) {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(key, options);
  }

  @HttpOperation.Entity.Update(Customer, {
    sections: ['Customers'],
  })
  async update(context: HttpContext) {
    const { key, data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).update(key, data, options);
  }

  // Needs a path of its own: without one it registers on the controller's
  // own route, where `get` above already answers GET — leaving this
  // operation documented but unreachable.
  @(HttpOperation.GET({
    sections: ['Customers'],
    path: 'setStatus',
  }).QueryParam('status', {
    type: EnumType(['active', 'hidden']),
  }))
  async setStatus(context: HttpContext) {
    console.log(`Status set to "${context.queryParams.status}"`);
  }

  @(HttpOperation.PATCH({
    sections: ['Customers'],
    path: 'avatar',
    requestBody: {
      required: true,
    },
  })
    .RequestContent({
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      type: AvatarUrlInput,
      example: '{"url":"https://example.com/avatars/99.png"}',
    })
    .MultipartContent(
      {
        maxParts: 2,
        maxTotalSize: 6 * 1024 * 1024,
      },
      content => {
        content.File('image', {
          contentType: 'image/png, image/jpeg, image/webp',
          required: true,
          maxPartSize: 5 * 1024 * 1024,
        });
        content.Field('caption', {
          type: 'string',
          example: 'Summer 2024',
          maxFieldSize: 200,
        });
      },
    )
    .Response(200, { type: OperationResult }))
  async updateAvatar(context: HttpContext) {
    console.log('Avatar update requested', context.pathParams.customerId);
    return new OperationResult({ message: 'Avatar updated' });
  }
}
