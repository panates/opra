import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'iban',
  description: 'An IBAN (International Bank Account Number)',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('DE89370400440532013000'))
export class IbanType {
  constructor(attributes?: Partial<IbanType>) {
    if (attributes) Object.assign(this, attributes);
  }

  protected [DECODER](): Validator {
    return vg.isIBAN({ coerce: true });
  }

  protected [ENCODER](): Validator {
    return vg.isIBAN({ coerce: true });
  }
}
