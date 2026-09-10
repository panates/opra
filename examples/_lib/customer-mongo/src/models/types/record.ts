import { ApiField, ComplexType } from '@opra/common';
import { type PartialDTO } from 'ts-gems';

@ComplexType({
  abstract: true,
  description:
    'Base schema shared by every persisted entity — the storage key and soft-delete/audit timestamps',
  keyField: '_id',
})
export class Record {
  constructor(init?: PartialDTO<Record>) {
    Object.assign(this, init);
  }

  @(ApiField({
    description: 'Unique identifier of the record',
    readonly: true,
  }).Override('db', {
    readonly: false,
  }))
  declare _id: number;

  @(ApiField({
    description: 'Whether the record has been soft-deleted',
    readonly: true,
  }).Override('db', {
    readonly: false,
  }))
  declare deleted?: boolean;

  @(ApiField({
    description: 'Date and time the record was created',
    readonly: true,
  }).Override('db', {
    readonly: false,
  }))
  declare createdAt: Date;

  @(ApiField({
    description: 'Date and time the record was last updated',
    readonly: true,
  }).Override('db', {
    readonly: false,
  }))
  declare updatedAt?: Date;
}
