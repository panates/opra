import { ApiField, ComplexType } from '@opra/common';
import { CountryCodeType } from './country.js';

@ComplexType({
  description: `A passport used as an identity document.

Passports are issued by national governments and are internationally recognized as travel and identity documents.`,
})
export class Passport {
  @ApiField({
    description: 'Passport number',
    examples: ['X1234567'],
  })
  declare number: string;

  @ApiField({
    description: 'Country that issued the passport',
    type: CountryCodeType,
  })
  declare issuingCountry: string;

  @ApiField({
    description: 'Date the passport expires',
    type: 'date',
    examples: ['2030-06-15'],
  })
  declare expiryDate: Date;
}

@ComplexType({
  description: `A driver's license used as an identity document.

Unlike a passport, a driver's license is issued by a state/province-level authority rather than a national one, so it carries \`issuingState\` instead of a country code.`,
})
export class DriversLicense {
  @ApiField({
    description: 'License number',
    examples: ['D1234-5678-9012'],
  })
  declare number: string;

  @ApiField({
    description: 'State or province that issued the license',
    examples: ['California', 'Ontario'],
  })
  declare issuingState: string;

  @ApiField({
    description:
      'License class — what the holder is permitted to drive, e.g. "B" for a standard passenger car',
    examples: ['B'],
  })
  declare licenseClass: string;
}

@ComplexType({
  description: `A national identity card.

The most common identity document for domestic use — issued by a country to its own residents, distinct from a passport (meant for international travel).`,
})
export class NationalId {
  @ApiField({
    description: 'National identity number',
    examples: ['123456789'],
  })
  declare number: string;

  @ApiField({
    description: 'Country that issued the identity card',
    type: CountryCodeType,
  })
  declare issuingCountry: string;
}
