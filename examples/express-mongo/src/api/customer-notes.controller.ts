import {
  HttpController,
  HttpOperation,
  OmitType,
  OperationResult,
} from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { CustomerNotesService, Note } from 'example-customer-mongo';
import { Db } from 'mongodb';
import { type PartialDTO } from 'ts-gems';

@HttpController({
  description: `A customer's notes.

Every operation here is scoped to the parent **Customer** identified by \`customerId\` in the path — a note's \`_id\` is only unique within that customer, not across the whole API.`,
  path: 'Notes',
  name: 'Notes',
})
export class CustomerNotesController {
  service: CustomerNotesService;

  constructor(readonly db: Db) {
    this.service = new CustomerNotesService({ db });
  }

  @(HttpOperation.Entity.Get(Note, {
    title: 'Get a note',
    sections: ['Notes', 'Customers'],
    description: 'Returns a single note of the customer by id.',
  }).KeyParam('_id', { type: Number, description: 'Id of the note' }))
  async get(context: HttpContext): Promise<PartialDTO<Note> | undefined> {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return this.service
      .for(context)
      .findById(context.pathParams.customerId, key, options);
  }

  @(HttpOperation.Entity.Delete(Note, {
    description: 'Deletes a single note of the customer by id.',
  }).KeyParam('_id', { type: Number, description: 'Id of the note' }))
  async delete(context: HttpContext) {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return await this.service
      .for(context)
      .delete(context.pathParams.customerId, key, options);
  }

  @(HttpOperation.Entity.Update(Note, {
    description: `Updates a single note of the customer by id.

Only the fields present in the request body are changed.`,
  }).KeyParam('_id', { type: Number, description: 'Id of the note' }))
  async update(context: HttpContext) {
    const { key, data, options } = await MongoAdapter.parseRequest(context);
    return this.service
      .for(context)
      .update(context.pathParams.customerId, key, data, options);
  }

  @HttpOperation.Entity.Create(Note, {
    title: 'Create a note',
    sections: ['Notes'],
    description: `Creates a new note for the customer.

Accepts a \`Note\` payload without its \`_id\`, which is assigned by the server.`,
    requestBody: {
      type: OmitType(Note, ['_id']),
    },
  })
  async create(context: HttpContext): Promise<PartialDTO<Note>> {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service
      .for(context)
      .create(context.pathParams.customerId, data, options);
  }

  @(HttpOperation.Entity.FindMany(Note, {
    title: 'List notes',
    sections: ['Notes'],
    description: `Returns the customer's notes.

Filterable by \`_id\`, \`title\`, \`text\` and \`rank\`; sortable by \`_id\` or \`title\` (defaults to \`_id\`).

:::tip
Pass \`count=true\` to also get the total number of matches back — useful for building pagination.
:::`,
  })
    .SortFields('_id', 'title', 'title')
    .DefaultSort('_id')
    .Filter('_id')
    .Filter('title')
    .Filter('text')
    .Filter('rank'))
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
    return this.service
      .for(context)
      .findMany(context.pathParams.customerId, options);
  }

  @(HttpOperation.Entity.DeleteMany(Note, {
    description: `Deletes multiple of the customer's notes matching a filter.

Filterable by \`_id\` or \`rank\`.`,
  })
    .Filter('_id')
    .Filter('rank'))
  async deleteMany(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service
      .for(context)
      .deleteMany(context.pathParams.customerId, options);
  }

  @(HttpOperation.Entity.UpdateMany(Note, {
    description: `Updates multiple of the customer's notes matching a filter.

Filterable by \`_id\` or \`rank\` — every matching note receives the same update payload.`,
  })
    .Filter('_id')
    .Filter('rank'))
  async updateMany(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return await this.service
      .for(context)
      .updateMany(context.pathParams.customerId, data, options);
  }
}
