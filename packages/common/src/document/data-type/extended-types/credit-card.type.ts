import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'creditcard',
  description: 'A Credit Card value',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('4111111111111111', 'A Visa test card number'))
export class CreditCardType {
  constructor(attributes?: Partial<CreditCardType>) {
    if (attributes) Object.assign(this, attributes);
  }

  @SimpleType.Attribute({
    description: 'Locale to use for validation',
  })
  provider?: vg.isCreditCard.Provider;

  protected [DECODER](properties?: Partial<this>): Validator {
    return vg.isCreditCard({ coerce: true, provider: properties?.provider });
  }

  protected [ENCODER](properties?: Partial<this>): Validator {
    return vg.isCreditCard({ coerce: true, provider: properties?.provider });
  }
}
