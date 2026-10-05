import { ApiField, ComplexType, SimpleType, StringType } from '@opra/common';

@(SimpleType({
  embedded: true,
  description: 'An international calling code, e.g. "+1"',
})
  .Example('+1', 'United States / Canada')
  .Example('+90', 'Türkiye'))
class CallingCodeType extends StringType {
  constructor() {
    super({ pattern: /^\+[1-9]\d{0,3}$/ });
  }
}

@(SimpleType({ embedded: true, description: 'A numeric area code' })
  .Example('415', 'San Francisco, US')
  .Example('212', 'Manhattan, US'))
class AreaCodeType extends StringType {
  constructor() {
    super({ pattern: /^\d{1,5}$/ });
  }
}

@(SimpleType({
  name: 'PhoneNumberValue',
  description: `
The **subscriber (local) part** of a phone number — the digits dialed
*after* the country and area codes.

For example, in \`+1 (415) 555-2671\`:

1. \`+1\` is the *international calling code* (see \`countryCode\`)
2. \`415\` is the *area code* (see \`areaCode\`)
3. \`5552671\` is **this** value

Digits only — no spaces, dashes, or parentheses; formatting is a display
concern, not part of the stored value. Length is restricted to a
reasonable range (4–12 digits) to catch obviously malformed input, without
hard-coding any single country's exact numbering plan.

:::tip
Store \`countryCode\`, \`areaCode\`, and this value separately rather than
one combined string — it's what lets you validate, sort, and query each
part on its own.
:::
`,
}).Example('5552671'))
export class PhoneNumberType extends StringType {
  constructor() {
    super({ pattern: /^\d+$/, minLength: 4, maxLength: 12 });
  }
}

@ComplexType({
  description: 'Phone number information',
})
export class PhoneNumber {
  @ApiField({
    description: 'International calling code',
    type: CallingCodeType,
  })
  declare countryCode: string;

  @ApiField({ description: 'Area code', type: AreaCodeType })
  declare areaCode: string;

  @ApiField({ description: 'Local phone number', type: PhoneNumberType })
  declare phoneNumber: string;
}
