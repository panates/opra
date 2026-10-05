import { ApiField, ComplexType, MixinType } from '@opra/common';
import { Address } from './address.js';
import { Person } from './person.js';
import { Record } from './record.js';

@ComplexType({
  description: "The signed-in user's own profile",
})
export class Profile extends MixinType([Record, Person]) {
  @ApiField({ description: 'Postal address of the profile owner' })
  declare address?: Address;
}
