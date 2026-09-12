import { ApiField, ComplexType } from '@opra/common';
import { type PartialDTO } from 'ts-gems';
import { Record } from './record.js';

@ComplexType({
  description: 'A note attached to a customer',
  additionalFields: true,
})
export class Note extends Record {
  constructor(init?: PartialDTO<Note>) {
    super(init);
  }

  @ApiField({ description: 'Short title of the note' })
  declare title: string;

  @ApiField({ description: 'Body text of the note' })
  declare text: string;

  @ApiField({ description: 'Display order of the note', default: 1 })
  declare rank: number;

  @ApiField({
    description: 'Large content only returned when explicitly requested',
    exclusive: true,
  })
  declare largeContent: string;
}
