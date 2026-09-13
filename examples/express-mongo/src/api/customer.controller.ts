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
import { Db } from 'mongodb';
import { type PartialDTO } from 'ts-gems';
import { CustomerNotesController } from './customer-notes.controller.js';

@ComplexType({
  description:
    'Sets a customer avatar by pointing at an already-hosted image, instead of uploading a file directly',
})
class AvatarUrlInput {
  @ApiField({
    description: 'Publicly accessible URL of the image',
    examples: ['https://example.com/avatars/42.png'],
  })
  declare url: string;
}

@(HttpController({
  description: `A single customer, addressed by id.

Every operation here targets exactly one \`Customer\` record, identified by the \`customerId\` path parameter. The nested **Notes** controller manages that customer's own notes.`,
  path: 'Customers',
  controllers: [
    (parent: CustomerController) => new CustomerNotesController(parent.db),
  ],
})
  .KeyParam('customerId', {
    type: 'integer',
    description: 'Id of the customer',
  })
  .UseType(AvatarUrlInput))
export class CustomerController {
  service: CustomersService;

  constructor(readonly db: Db) {
    this.service = new CustomersService({ db });
  }

  @(HttpOperation.Entity.Get(Customer, {
    title: 'Get a customer',
    groups: ['Customers'],
    description: 'Returns a single customer by id.',
  }).QueryParam('xId', { description: 'Example of an ad-hoc query parameter' }))
  async get(context: HttpContext): Promise<PartialDTO<Customer> | undefined> {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).findById(key, options);
  }

  @HttpOperation.Entity.Delete(Customer, {
    title: 'Delete a customer',
    groups: ['Customers'],
    description: `Deletes a single customer by id.

For deactivating a customer without removing their record entirely, see \`setStatus\`.`,
  })
  async delete(context: HttpContext) {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(key, options);
  }

  @HttpOperation.Entity.Update(Customer, {
    title: 'Update a customer',
    groups: ['Customers'],
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

  @(HttpOperation.PATCH({
    title: 'Update avatar',
    groups: ['Customers'],
    description: `Updates the customer's avatar — either by pointing at an already-hosted image (\`application/json\`) or by uploading the image file directly (\`multipart/form-data\`).

:::tip
This operation exists mainly to demonstrate a request body with more than one alternative representation — open the tabs above **Request body** below to compare them.
:::`,
    path: 'avatar',
    requestBody: {
      description:
        'The new avatar — provide it as a URL reference or an uploaded file; pick whichever alternative representation fits your client.',
      required: true,
    },
  })
    .RequestContent({
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      type: AvatarUrlInput,
      description: 'Set the avatar by URL, without uploading a file.',
      example: '{"url":"https://example.com/avatars/99.png"}',
    })
    .MultipartContent(
      {
        description: 'Upload the avatar image directly.',
        maxParts: 2,
        maxTotalSize: 6 * 1024 * 1024,
      },
      content => {
        content.File('image', {
          contentType: 'image/png, image/jpeg, image/webp',
          required: true,
          description: 'The image file itself.',
          maxPartSize: 5 * 1024 * 1024,
        });
        content.Field('caption', {
          type: 'string',
          description: 'Optional caption shown under the avatar.',
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
