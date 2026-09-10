import { ApiField, ComplexType } from '@opra/common';
import { Gender } from '../enums/gender.js';

@ComplexType({
  description: 'Person information',
})
export class Person {
  @ApiField({ description: 'Given (first) name' })
  declare givenName: string;

  @ApiField({ description: 'Family (last) name' })
  declare familyName: string;

  @ApiField({ description: 'Gender of the person', type: Gender })
  declare gender: Gender;

  @ApiField({
    description: 'Date of birth',
    type: 'date',
  })
  declare birthDate?: Date;

  @ApiField({ description: 'Secondary date field used for testing purposes' })
  declare date2?: string;
}
