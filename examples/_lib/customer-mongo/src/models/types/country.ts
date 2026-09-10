import { ApiField, ComplexType } from '@opra/common';

@ComplexType({
  description: 'Country information',
})
export class Country {
  @ApiField({ description: 'ISO 3166-1 alpha-2 country code' })
  declare code: string;

  @ApiField({ description: 'Country name' })
  declare name: string;

  @ApiField({ description: 'International calling code' })
  declare phoneCode?: string;
}
