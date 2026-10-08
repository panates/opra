import { UseGuards } from '@nestjs/common';
import { HttpController, HttpOperation, OmitType } from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { MyProfileService, Profile } from 'example-customer-mongo';
import { Db } from 'mongodb';
import { AppAuthGuard } from '../guards/app-auth.guard.js';
import { AvatarController } from './avatar.controller.js';

@HttpController({
  controllers: [AvatarController],
})
@UseGuards(AppAuthGuard)
export class MyProfileController {
  service: MyProfileService;

  constructor(readonly db: Db) {
    this.service = new MyProfileService({ db });
  }

  @HttpOperation.Entity.Create(Profile, {
    requestBody: {
      type: OmitType(Profile, ['_id']),
    },
  })
  async create(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).create(data, options);
  }

  @HttpOperation.Entity.Delete(Profile)
  async delete(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(options);
  }

  @HttpOperation.Entity.Get(Profile)
  async get(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).find(options);
  }

  @HttpOperation.Entity.Update(Profile)
  async update(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).update(data, options);
  }
}
