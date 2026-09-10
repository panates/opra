import { ApiField, ComplexType } from '@opra/common';

@ComplexType({
  description: 'Phone number information',
})
export class PhoneNumber {
  @ApiField({ description: 'International calling code' })
  declare countryCode: string;

  @ApiField({ description: 'Area code' })
  declare areaCode: string;

  @ApiField({ description: 'Local phone number' })
  declare phoneNumber: string;
}
