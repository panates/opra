import { ApiField, ComplexType, SimpleType, StringType } from '@opra/common';
import { Gender } from '../enums/gender.js';

@(SimpleType({
  name: 'PersonName',
  description: 'A person name, at least 3 characters long',
})
  .Example('John')
  .Example('Ayşe'))
export class PersonNameType extends StringType {
  constructor() {
    super({ minLength: 3 });
  }
}

@ComplexType({
  description: 'Person information',
})
export class Person {
  @ApiField({
    description: 'Given (first) name',
    type: PersonNameType,
    examples: ['John', 'Ayşe'],
  })
  declare givenName: string;

  @ApiField({
    description: 'Family (last) name',
    type: PersonNameType,
    examples: ['Smith', 'Yılmaz'],
  })
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
