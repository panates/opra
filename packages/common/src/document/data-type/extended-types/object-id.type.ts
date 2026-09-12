import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'ObjectId',
  description: 'A MongoDB ObjectID value',
  nameMappings: {
    js: 'object',
    json: 'string',
  },
}).Example('507f1f77bcf86cd799439011'))
export class ObjectIdType {
  constructor(attributes?: Partial<ObjectIdType>) {
    if (attributes) Object.assign(this, attributes);
  }

  protected [DECODER](): Validator {
    return vg.isObjectId({ coerce: true });
  }

  protected [ENCODER](): Validator {
    return vg.isObjectId({ coerce: true });
  }
}
