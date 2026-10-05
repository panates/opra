import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'ean',
  description: 'An EAN (European Article Number)',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('4006381333931'))
export class EanType {
  constructor(attributes?: Partial<EanType>) {
    if (attributes) Object.assign(this, attributes);
  }

  protected [DECODER](): Validator {
    return vg.isEAN({ coerce: true });
  }

  protected [ENCODER](): Validator {
    return vg.isEAN({ coerce: true });
  }
}
