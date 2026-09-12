import { ApiField, ArrayType, ComplexType, MixinType } from '@opra/common';
import { type PartialDTO } from 'ts-gems';
import { Address } from './address.js';
import { Country } from './country.js';
import { Note } from './note.js';
import { Person } from './person.js';
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

  @ApiField()
  declare rate: number;

  @ApiField({ exclusive: true })
  declare address?: Address;

  @ApiField({ type: ArrayType(Note), exclusive: true })
  declare notes?: Note[];

  @ApiField({ exclusive: true })
  declare readonly country?: Country;
}
