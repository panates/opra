import {
  ApiField,
  ArrayType,
  ComplexType,
  MixinType,
  UnionType,
} from '@opra/common';
import { type PartialDTO } from 'ts-gems';
import { Address } from './address.js';
import { Country } from './country.js';
import { Note } from './note.js';
import { Person } from './person.js';
import { PhoneNumber } from './phone-number.js';
import { Record } from './record.js';

@ComplexType({
  description: 'Customer information',
})
export class Customer extends MixinType([Record, Person]) {
  constructor(init?: PartialDTO<Customer>) {
    super(init);
  }

  @ApiField({ description: 'External/user-facing unique identifier' })
  declare uid?: string;

  @ApiField({ description: 'Whether the customer account is active' })
  declare active: boolean;

  @ApiField({ description: 'ISO 3166-1 alpha-2 country code of the customer' })
  declare countryCode: string;

  @ApiField({
    description: 'Loyalty/pricing rate applied to the customer',
    default: 1,
  })
  declare rate: number;

  @ApiField({
    description: 'Postal address of the customer',
    exclusive: true,
  })
  declare address?: Address;

  @ApiField({
    description: 'Notes attached to the customer',
    type: Note,
    exclusive: true,
    isNestedEntity: true,
  })
  declare notes?: Note[];

  @ApiField({
    description: 'Phone numbers of the customer',
    type: PhoneNumber,
    exclusive: true,
  })
  declare phoneNumbers?: PhoneNumber[];

  @ApiField({
    description: 'Country of the customer, resolved from countryCode',
    exclusive: true,
    readonly: true,
  })
  declare readonly country?: Country;

  @ApiField({
    description: 'Free-form labels attached to the customer',
    type: ArrayType(String),
  })
  declare tags?: string[];

  @ApiField({
    description: 'Internal field only visible in the "db" scope',
    scopePattern: 'db',
  })
  dbField?: string;

  @ApiField({
    description:
      'Whether the customer has a branch — either a flag or a branch count',
    type: UnionType([Boolean, Number]),
  })
  declare hasBranch: boolean | number;
}
