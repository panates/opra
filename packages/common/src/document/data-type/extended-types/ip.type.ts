import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'ip',
  description: 'An IP address',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('192.168.1.1'))
export class IpType {
  constructor(attributes?: Partial<IpType>) {
    if (attributes) Object.assign(this, attributes);
  }

  @SimpleType.Attribute({
    description: 'IP version to use for validation',
  })
  version?: vg.isIP.IPVersion;

  protected [DECODER](properties?: Partial<this>): Validator {
    return properties?.version
      ? vg.isIP(properties?.version, { coerce: true })
      : vg.oneOf([
          vg.isIP('4', { coerce: true }),
          vg.isIP('6', { coerce: true }),
        ]);
  }

  protected [ENCODER](properties?: Partial<this>): Validator {
    return properties?.version
      ? vg.isIP(properties?.version, { coerce: true })
      : vg.oneOf([
          vg.isIP('4', { coerce: true }),
          vg.isIP('6', { coerce: true }),
        ]);
  }
}
