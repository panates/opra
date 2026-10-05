import '@opra/sqb';
import { ApiField, ArrayType, ComplexType, MixinType } from '@opra/common';
import { Column, Entity, Link } from '@sqb/connect';
import { type PartialDTO } from 'ts-gems';
import { Address } from './address.js';
import { Country } from './country.js';
import { Note } from './note.js';
import { Person } from './person.js';
import { Record } from './record.js';

@ComplexType({
  description: 'Customer information',
})
@Entity('customers')
export class Customer extends MixinType([Record, Person]) {
  constructor(init?: PartialDTO<Customer>) {
    super(init);
  }

  @ApiField()
  @Column()
  declare uid?: string;

  @ApiField()
  @Column()
  declare active: boolean;

  @ApiField()
  @Column()
  declare countryCode: string;

  @ApiField()
  @Column()
  declare rate: number;

  @ApiField({ exclusive: true })
  @Column({ type: Address, exclusive: true })
  declare address?: Address;

  @ApiField({ type: ArrayType(Note), exclusive: true })
  @Column({ type: Note, exclusive: true })
  declare notes?: Note[];

  @ApiField({ exclusive: true })
  @(Link({ exclusive: true }).toOne(Country, {
    sourceKey: 'countryCode',
    targetKey: 'code',
  }))
  declare readonly country?: Country;
}
