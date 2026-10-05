import { HttpController, HttpOperation, OmitType } from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { MyProfileService, Profile } from 'example-customer-mongo';
import type { CustomerApplication } from '../customer-application.js';

@(HttpController({}).Header('accessToken', {
  type: 'string',
}))
export class MyProfileController {
  protected _service?: MyProfileService;

  constructor(readonly app: CustomerApplication) {}

  get service() {
    if (!this._service)
      this._service = new MyProfileService({ db: this.app.db });
    return this._service;
  }

  @HttpOperation.Entity.Create(Profile, {
    sections: ['Account'],
    requestBody: {
      type: OmitType(Profile, ['_id']),
    },
  })
  async create(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).create(data, options);
  }

  @HttpOperation.Entity.Delete(Profile, {
    sections: ['Account'],
  })
  async delete(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(options);
  }

  @HttpOperation.Entity.Get(Profile, {
    sections: ['Account'],
  })
  async get(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).find(options);
  }

  @HttpOperation.Entity.Update(Profile, {
    sections: ['Account'],
  })
  async update(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).update(data, options);
  }
}
