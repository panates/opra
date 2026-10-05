import { ApiField, ComplexType, SimpleType, StringType } from '@opra/common';

@(SimpleType({
  name: 'CountryCode',
  description: `
An **ISO 3166-1 alpha-2** country code — a two-letter code identifying a
country, such as \`US\`, \`TR\`, or \`DE\`.

These codes are maintained by the ISO 3166 Maintenance Agency and are the
most widely used country identifier in software systems, forming the basis
of:

- Domain suffixes (\`.de\`, \`.fr\`)
- SIM card / telecom numbering plans
- Locale codes, combined with a language code (e.g. \`en-US\`)

Always **uppercase**, exactly two letters — lowercase or three-letter
(alpha-3, e.g. \`USA\`) codes are not accepted.
`,
})
  .Example('US', 'United States')
  .Example('TR', 'Türkiye')
  .Example('DE', 'Germany'))
export class CountryCodeType extends StringType {
  constructor() {
    super({ pattern: /^[A-Z]{2}$/ });
  }
}

@ComplexType({
  description: 'Country information',
})
export class Country {
  @ApiField({
    description: 'ISO 3166-1 alpha-2 country code',
    type: CountryCodeType,
  })
  declare code: string;

  @ApiField({
    description: 'Country name',
    examples: ['United States', 'Türkiye', 'Germany'],
  })
  declare name: string;

  @ApiField({
    description: 'International calling code',
    examples: ['+1', '+90', '+49'],
  })
  declare phoneCode?: string;
}
