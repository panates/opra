import {
  HttpController,
  HttpOperation,
  OmitType,
  OperationResult,
} from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { CustomerNotesService, Note } from 'example-customer-mongo';
import { type PartialDTO } from 'ts-gems';
import type { CustomerApplication } from '../customer-application.js';

@HttpController({
  path: 'Notes',
  name: 'Notes',
})
export class CustomerNotesController {
  protected _service?: CustomerNotesService;

  constructor(readonly app: CustomerApplication) {}

  get service() {
    if (!this._service)
      this._service = new CustomerNotesService({ db: this.app.db });
    return this._service;
  }

  @(HttpOperation.Entity.Get(Note, {
    sections: ['Notes', 'Customers'],
  }).KeyParam('_id', { type: Number }))
  async get(context: HttpContext): Promise<PartialDTO<Note> | undefined> {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return this.service
      .for(context)
      .findById(context.pathParams.customerId, key, options);
  }

  @(HttpOperation.Entity.Delete(Note, { sections: ['Notes'] }).KeyParam('_id', {
    type: Number,
  }))
  async delete(context: HttpContext) {
    const { key, options } = await MongoAdapter.parseRequest(context);
    return await this.service
      .for(context)
      .delete(context.pathParams.customerId, key, options);
  }

  @(HttpOperation.Entity.Update(Note, { sections: ['Notes'] }).KeyParam('_id', {
    type: Number,
  }))
  async update(context: HttpContext) {
    const { key, data, options } = await MongoAdapter.parseRequest(context);
    return this.service
      .for(context)
      .update(context.pathParams.customerId, key, data, options);
  }

  @HttpOperation.Entity.Create(Note, {
    sections: ['Notes'],
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
    sections: ['Notes'],
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

  @(HttpOperation.Entity.DeleteMany(Note, { sections: ['Notes'] })
    .Filter('_id')
    .Filter('rank'))
  async deleteMany(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service
      .for(context)
      .deleteMany(context.pathParams.customerId, options);
  }

  @(HttpOperation.Entity.UpdateMany(Note, { sections: ['Notes'] })
    .Filter('_id')
    .Filter('rank'))
  async updateMany(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return await this.service
      .for(context)
      .updateMany(context.pathParams.customerId, data, options);
  }
}
