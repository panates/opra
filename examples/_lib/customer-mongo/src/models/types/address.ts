import { ApiField, ComplexType } from '@opra/common';
import { AddressType } from '../enums/address-type.js';
import { Record } from './record.js';

@ComplexType({
  description: 'Address information',
})
export class Address extends Record {
  @ApiField({ description: 'Purpose of this address', type: AddressType })
  declare type: AddressType;

  @ApiField({ description: 'City name' })
  declare city: string;

  @ApiField({ description: 'ISO 3166-1 alpha-2 country code' })
  declare countryCode: string;

  @ApiField({ description: 'Street name and number' })
  declare street: string;

  @ApiField({ description: 'Postal / ZIP code' })
  declare zipCode: string;
}
