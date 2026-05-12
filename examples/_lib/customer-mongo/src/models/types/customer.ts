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

  @ApiField()
  declare uid?: string;

  @ApiField()
  declare active: boolean;

  @ApiField()
  declare countryCode: string;

  @ApiField({
    default: 1,
  })
  declare rate: number;

  @ApiField({ exclusive: true })
  declare address?: Address;

  @ApiField({ type: Note, exclusive: true, isNestedEntity: true })
  declare notes?: Note[];

  @ApiField({ type: PhoneNumber, exclusive: true })
  declare phoneNumbers?: PhoneNumber[];

  @ApiField({ exclusive: true, readonly: true })
  declare readonly country?: Country;

  @ApiField({
    type: ArrayType(String),
  })
  declare tags?: string[];

  @ApiField({
    scopePattern: 'db',
  })
  dbField?: string;

  @ApiField({
    type: UnionType([Boolean, Number]),
  })
  declare hasBranch: boolean | number;
}
