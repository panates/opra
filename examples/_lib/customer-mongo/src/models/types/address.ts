import { ApiField, ComplexType } from '@opra/common';
import { AddressType } from '../enums/address-type.js';
import { Record } from './record.js';

@ComplexType({ embedded: true })
class GeoAccuracy {
  @ApiField({
    description: 'Estimated accuracy radius of the coordinate, in meters',
    examples: [5, 50],
  })
  declare radiusMeters: number;

  @ApiField({
    description: 'Where the coordinate came from',
    examples: ['gps', 'ip-geolocation'],
  })
  declare source: string;
}

@ComplexType({ embedded: true })
class AddressLocation {
  @ApiField({ description: 'Latitude in decimal degrees', examples: [40.7128] })
  declare latitude: number;

  @ApiField({
    description: 'Longitude in decimal degrees',
    examples: [-74.006],
  })
  declare longitude: number;

  @ApiField({
    description:
      'Accuracy of this coordinate — an embedded type nested inside another embedded type',
  })
  declare accuracy?: GeoAccuracy;
}

@ComplexType({
  description: 'Address information',
})
export class Address extends Record {
  @ApiField({ description: 'Purpose of this address', type: AddressType })
  declare type: AddressType;

  @ApiField({ description: 'City name', examples: ['New York', 'Istanbul'] })
  declare city: string;

  @ApiField({
    description: 'ISO 3166-1 alpha-2 country code',
    examples: ['US', 'TR'],
  })
  declare countryCode: string;

  @ApiField({
    description: 'Street name and number',
    examples: ['5th Avenue 350', 'Bağdat Caddesi 120'],
  })
  declare street: string;

  @ApiField({ description: 'Postal / ZIP code', examples: ['10001', '34710'] })
  declare zipCode: string;

  @ApiField({ description: 'Location information' })
  declare location: AddressLocation;
}
