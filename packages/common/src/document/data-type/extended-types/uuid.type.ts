import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'uuid',
  description: 'A Universal Unique Identifier (UUID) value',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('123e4567-e89b-12d3-a456-426614174000'))
export class UuidType {
  constructor(attributes?: Partial<UuidType>) {
    if (attributes) Object.assign(this, attributes);
  }

  @SimpleType.Attribute({
    description: 'Version of the UUID',
  })
  version?: vg.isUUID.UUIDVersion;

  protected [DECODER](properties?: Partial<this>): Validator {
    return vg.isUUID(properties?.version || 'all', { coerce: true });
  }

  protected [ENCODER](properties?: Partial<this>): Validator {
    return vg.isUUID(properties?.version || 'all', { coerce: true });
  }
}
