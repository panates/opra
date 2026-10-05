import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'mobilephone',
  description: 'A Mobile Phone Number value',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('+12025550143'))
export class MobilePhoneType {
  constructor(attributes?: Partial<MobilePhoneType>) {
    if (attributes) Object.assign(this, attributes);
  }

  @SimpleType.Attribute({
    description: 'Locale to use for validation',
  })
  locale?: vg.isMobilePhone.MobilePhoneLocale;

  @SimpleType.Attribute({
    description:
      'If this is set to true, the mobile phone number must be supplied with the country code and therefore must start with +. Locale number',
  })
  strictMode?: boolean;

  protected [DECODER](properties?: Partial<this>): Validator {
    return vg.isMobilePhone({
      coerce: true,
      locale: properties?.locale || 'any',
      strictMode: properties?.strictMode ?? true,
    });
  }

  protected [ENCODER](properties?: Partial<this>): Validator {
    return vg.isMobilePhone({
      coerce: true,
      locale: properties?.locale || 'any',
      strictMode: properties?.strictMode ?? true,
    });
  }
}
