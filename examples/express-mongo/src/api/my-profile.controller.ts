import { HttpController, HttpOperation, OmitType } from '@opra/common';
import { HttpContext } from '@opra/http';
import { MongoAdapter } from '@opra/mongodb';
import { MyProfileService, Profile } from 'example-customer-mongo';
import { Db } from 'mongodb';

@(HttpController({
  description: `The signed-in user's own profile.

Unlike **Customer**, this resource has no id in its path — every operation here requires an \`accessToken\` header instead.

- \`get\` — reads the current profile
- \`create\` — provisions a new profile
- \`update\` — partially updates the profile
- \`delete\` — removes the profile`,
}).Header('accessToken', {
  type: 'string',
  description: 'Access token of the signed-in user',
}))
export class MyProfileController {
  service: MyProfileService;

  constructor(readonly db: Db) {
    this.service = new MyProfileService({ db });
  }

  @HttpOperation.Entity.Create(Profile, {
    description: `Creates the profile of the signed-in user.

Accepts a \`Profile\` payload without its \`_id\`, which is assigned by the server.`,
    requestBody: {
      type: OmitType(Profile, ['_id']),
    },
  })
  async create(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).create(data, options);
  }

  @HttpOperation.Entity.Delete(Profile, {
    description: 'Deletes the profile of the signed-in user.',
  })
  async delete(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return await this.service.for(context).delete(options);
  }

  @HttpOperation.Entity.Get(Profile, {
    description: 'Returns the profile of the signed-in user.',
  })
  async get(context: HttpContext) {
    const { options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).find(options);
  }

  @HttpOperation.Entity.Update(Profile, {
    description: `Updates the profile of the signed-in user.

Only the fields present in the request body are changed; omitted fields keep their current value.`,
  })
  async update(context: HttpContext) {
    const { data, options } = await MongoAdapter.parseRequest(context);
    return this.service.for(context).update(data, options);
  }
}
