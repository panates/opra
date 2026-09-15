import assert from 'node:assert';
import {
  MongoCollectionService,
  MongoNestedService,
  MongoService,
} from '@opra/mongodb';
import { Customer, Note } from '../models/index.js';

export class CustomerNotesService extends MongoNestedService<Note> {
  static idGen = 1000;

  constructor(options?: MongoCollectionService.Options) {
    // The type here is the *document* that owns the array field, not the
    // element type — `MongoNestedService` reads `Customer.notes` to work out
    // what an element is (see its own `dataType` getter). The element type is
    // the generic argument above.
    super(Customer, 'notes', {
      collectionName: 'Customers',
      interceptor: (callback: () => any, info: MongoService.CommandInfo) => {
        if (info.crud === 'create')
          info.input!._id = ++CustomerNotesService.idGen;
        return callback();
      },
      ...options,
    });
    assert.ok(options?.db, 'You must provide "db" argument');
  }
}
