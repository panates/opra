import { omit } from '@jsopen/objects';
import { InternalServerError } from '@opra/common';
import mongodb, { type UpdateFilter } from 'mongodb';
import type { PartialDTO, StrictOmit, Type } from 'ts-gems';
import { isNotNullish } from 'valgen';
import { MongoAdapter } from '../adapter/mongo-adapter.js';
import { MongoPatchGenerator } from '../adapter/mongo-patch-generator.js';
import type { MongoPatchDTO } from '../types.js';
import { MongoService } from './mongo-service.js';

/**
 * Options for MongoEntityService.
 */
export namespace MongoEntityService {
  /**
   * Configuration options for MongoEntityService.
   */
  export interface Options extends MongoService.Options {}

  /**
   * Information about the command being executed.
   */
  export interface CommandInfo extends MongoService.CommandInfo {}

  /* Options for the `create` operation. */
  export interface CreateOptions extends MongoService.CreateOptions {}

  /**
   * Options for the `count` operation.
   *
   * @template T - The type of the document.
   */
  export interface CountOptions<T> extends MongoService.CountOptions<T> {}

  /**
   * Options for the `delete` operation.
   *
   * @template T - The type of the document.
   */
  export interface DeleteOptions<T> extends MongoService.DeleteOptions<T> {}

  /**
   * Options for the `deleteMany` operation.
   *
   * @template T - The type of the document.
   */
  export interface DeleteManyOptions<
    T,
  > extends MongoService.DeleteManyOptions<T> {}

  /**
   * Options for the `distinct` operation.
   *
   * @template T - The type of the document.
   */
  export interface DistinctOptions<T> extends MongoService.DistinctOptions<T> {}

  /**
   * Options for the `exists` operation.
   *
   * @template T - The type of the document.
   */
  export interface ExistsOptions<T> extends MongoService.ExistsOptions<T> {}

  /**
   * Options for the `findOne` / `findById` operations.
   *
   * @template T - The type of the document.
   */
  export interface FindOneOptions<T> extends MongoService.FindOneOptions<T> {}

  /**
   * Options for the `findMany` operation.
   *
   * @template T - The type of the document.
   */
  export interface FindManyOptions<T> extends MongoService.FindManyOptions<T> {
    /* Whether to skip decoding of the result items. */
    noDecode?: boolean;
  }

  /**
   * Options for the `replace` operation.
   *
   * @template T - The type of the document.
   */
  export interface ReplaceOptions<T> extends MongoService.ReplaceOptions<T> {}

  /**
   * Options for the `update` / `updateOnly` operations.
   *
   * @template T - The type of the document.
   */
  export interface UpdateOneOptions<
    T,
  > extends MongoService.UpdateOneOptions<T> {
    /* Array fields to initialize if they don't exist. */
    initArrayFields?: string[];
  }

  /**
   * Options for the `updateMany` operation.
   *
   * @template T - The type of the document.
   */
  export interface UpdateManyOptions<
    T,
  > extends MongoService.UpdateManyOptions<T> {
    /* Array fields to initialize if they don't exist. */
    initArrayFields?: string[];
  }

  /* Command interface for the `create` operation. */
  export interface CreateCommand<T> extends StrictOmit<
    CommandInfo,
    'documentId' | 'nestedId' | 'input'
  > {
    crud: 'create';
    input: PartialDTO<T>;
    options?: CreateOptions;
  }

  /* Command interface for the `count` operation. */
  export interface CountCommand<T> extends StrictOmit<
    CommandInfo,
    'documentId' | 'nestedId' | 'input'
  > {
    crud: 'read';
    options?: CountOptions<T>;
  }

  export interface DeleteCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId' | 'input'
  > {
    crud: 'delete';
    options?: DeleteOptions<T>;
  }

  export interface DistinctCommand<T> extends StrictOmit<
    CommandInfo,
    'documentId' | 'nestedId' | 'input'
  > {
    crud: 'read';
    field: string;
    options?: DistinctOptions<T>;
  }

  export interface ExistsCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId' | 'input'
  > {
    crud: 'read';
    options?: ExistsOptions<T>;
  }

  export interface FindOneCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId' | 'input'
  > {
    crud: 'read';
    options?: FindOneOptions<T>;
  }

  export interface FindManyCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId' | 'input'
  > {
    crud: 'read';
    options?: FindManyOptions<T>;
  }

  export interface UpdateOneCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId'
  > {
    crud: 'update';
    input?: MongoPatchDTO<T>;
    inputRaw?: mongodb.UpdateFilter<T>;
    options?: UpdateOneOptions<T>;
  }

  export interface UpdateManyCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId'
  > {
    crud: 'update';
    input?: MongoPatchDTO<T>;
    inputRaw?: mongodb.UpdateFilter<T>;
    options?: UpdateManyOptions<T>;
  }

  export interface ReplaceCommand<T> extends StrictOmit<
    CommandInfo,
    'nestedId'
  > {
    crud: 'replace';
    input: PartialDTO<T>;
    options?: ReplaceOptions<T>;
  }
}

/**
 * @class MongoEntityService
 * @template T - The type of the documents in the collection
 */
export class MongoEntityService<
  T extends mongodb.Document,
> extends MongoService<T> {
  /**
   * Constructs a new instance.
   *
   * @param dataType - The data type of the managed entities.
   * @param options - The options for the entity service.
   */
  constructor(dataType: Type | string, options?: MongoEntityService.Options) {
    super(dataType, options);
  }

  /**
   * Creates a new document in the MongoDB collection
   *
   * @param command - The command information.
   * @protected
   */
  protected async _create(
    command: MongoEntityService.CreateCommand<T>,
  ): Promise<T> {
    const input: any = command.input;
    isNotNullish(input, { label: 'input' });
    isNotNullish(input._id, { label: 'input._id' });
    const inputCodec = this._getInputCodec('create');
    const document: any = inputCodec(input);
    document._id = input._id;
    const { options } = command;
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    const r = await collection.insertOne(document, {
      ...options,
      session: options?.session ?? this.getSession(),
    });
    /* istanbul ignore next */
    if (!r.insertedId) {
      throw new InternalServerError(
        `Unknown error while creating document for "${this.getResourceName()}"`,
      );
    }
    return document;
  }

  /**
   * Returns the count of documents in the collection based on the provided options.
   *
   * @param command - The command information.
   * @protected
   */
  protected async _count(
    command: MongoEntityService.CountCommand<T>,
  ): Promise<number> {
    const { options } = command;
    const filter = MongoAdapter.prepareFilter(options?.filter);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    return (
      (await collection.countDocuments(filter || {}, {
        ...options,
        limit: undefined,
        session: options?.session ?? this.getSession(),
      })) || 0
    );
  }

  /**
   * Deletes a document from the collection
   *
   * @param command - The command information.
   * @protected
   */
  protected async _delete(
    command: MongoEntityService.DeleteCommand<T>,
  ): Promise<number> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const { options } = command;
    const filter = MongoAdapter.prepareFilter([
      MongoAdapter.prepareKeyValues(command.documentId, ['_id']),
      options?.filter,
    ]);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    const session = options?.session ?? this.getSession();
    return (
      await collection.deleteOne(filter || {}, {
        ...options,
        session,
      })
    ).deletedCount;
  }

  /**
   * Deletes multiple documents from the collection that meet the specified filter criteria.
   *
   * @param command - The command information.
   * @protected
   */
  protected async _deleteMany(
    command: MongoEntityService.DeleteCommand<T>,
  ): Promise<number> {
    const { options } = command;
    const filter = MongoAdapter.prepareFilter(options?.filter);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    return (
      await collection.deleteMany(filter || {}, {
        ...options,
        session: options?.session ?? this.getSession(),
      })
    ).deletedCount;
  }

  /**
   * The distinct command returns a list of distinct values for the given key across a collection
   *
   * @param command - The command information.
   * @protected
   */
  protected async _distinct(
    command: MongoEntityService.DistinctCommand<T>,
  ): Promise<any[]> {
    const { options, field } = command;
    const filter = MongoAdapter.prepareFilter(options?.filter);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    return await collection.distinct(field, filter || {}, {
      ...options,
      session: options?.session ?? this.getSession(),
    });
  }

  /**
   * Finds a document by its ID.
   *
   * @param command - The command information.
   */
  protected async _findById(
    command: MongoEntityService.FindOneCommand<T>,
  ): Promise<PartialDTO<T> | undefined> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const filter = MongoAdapter.prepareFilter([
      MongoAdapter.prepareKeyValues(command.documentId, ['_id']),
      command.options?.filter,
    ]);
    const { options } = command;
    const findManyCommand: MongoEntityService.FindManyCommand<T> = {
      ...command,
      options: {
        ...options,
        filter,
        limit: 1,
        skip: undefined,
      },
    };
    const rows = await this._findMany(findManyCommand);
    return rows?.[0];
  }

  /**
   * Finds a document in the collection that matches the specified options.
   *
   * @param command - The command information.
   */
  protected async _findOne(
    command: MongoEntityService.FindOneCommand<T>,
  ): Promise<PartialDTO<T> | undefined> {
    const { options } = command;
    const findManyCommand: MongoEntityService.FindManyCommand<T> = {
      ...command,
      options: {
        ...options,
        limit: 1,
      },
    };
    const rows = await this._findMany(findManyCommand);
    return rows?.[0];
  }

  /**
   * Finds multiple documents in the MongoDB collection
   *
   * @param command - The command information.
   */
  protected async _findMany(
    command: MongoEntityService.FindManyCommand<T>,
  ): Promise<PartialDTO<T>[]> {
    const { options } = command;
    const stages: mongodb.Document[] = [];
    /* Pre-Stages */
    if (options?.preStages) stages.push(...options.preStages);
    /* "Filter" stage */
    let filter: mongodb.Filter<T> | undefined;
    if (options?.filter)
      filter = MongoAdapter.prepareFilter<T>(options?.filter);
    if (filter) stages.push({ $match: filter });
    /* "Sort" stage - before "Skip", so skip counts records in the requested order */
    if (options?.sort) {
      const sort = MongoAdapter.prepareSort(options.sort);
      if (sort) stages.push({ $sort: sort });
    }
    /* "Skip" stage */
    if (options?.skip) stages.push({ $skip: options.skip });
    /* "Limit" stage */
    if (options?.limit) stages.push({ $limit: options.limit });
    /* Post-Stages */
    if (options?.postStages) stages.push(...options.postStages);

    const dataType = this.dataType;
    const projection = MongoAdapter.prepareProjection(
      dataType,
      options?.projection,
      this._dataTypeScope,
    );
    if (projection) stages.push({ $project: projection });
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    const cursor = collection.aggregate<T>(stages, {
      ...omit(options!, ['projection', 'sort', 'skip', 'limit', 'filter']),
      session: options?.session ?? this.getSession(),
    });
    /* Execute db command */
    try {
      /* Fetch the cursor */
      if (options?.noDecode) return cursor.toArray();
      /* Decode result objects */
      const outputCodec = this._getOutputCodec('find');
      return (await cursor.toArray()).map((r: any) => outputCodec(r));
    } finally {
      if (!cursor.closed) await cursor.close();
    }
  }

  /**
   * Finds multiple documents in the collection and returns both records (max limit)
   * and total count that matched the given criteria
   *
   * @param command - The command information.
   */
  protected async _findManyWithCount(
    command: MongoEntityService.FindManyCommand<T>,
  ): Promise<{
    count: number;
    items: PartialDTO<T>[];
  }> {
    const { options } = command;
    let filter: mongodb.Filter<T> | undefined;
    if (options?.filter)
      filter = MongoAdapter.prepareFilter<T>(options?.filter);

    const dataStages: mongodb.Document[] = [];
    const countStages: any[] = [];
    const stages: mongodb.Document[] = [
      {
        $facet: {
          data: dataStages,
          count: countStages,
        },
      },
    ];

    /* Pre-Stages */
    if (options?.preStages) dataStages.push(...options.preStages);

    /* Filter */
    if (filter) {
      countStages.push({ $match: filter });
      dataStages.push({ $match: filter });
    }
    countStages.push({ $count: 'totalMatches' });

    /* Sort */
    if (options?.sort) {
      const sort = MongoAdapter.prepareSort(options.sort);
      if (sort) dataStages.push({ $sort: sort });
    }
    /* Skip */
    if (options?.skip) dataStages.push({ $skip: options.skip });
    /* Limit */
    if (options?.limit) dataStages.push({ $limit: options.limit });

    const dataType = this.dataType;
    const projection = MongoAdapter.prepareProjection(
      dataType,
      options?.projection,
      this._dataTypeScope,
    );
    if (projection) dataStages.push({ $project: projection });
    const outputCodec = this._getOutputCodec('find');
    /* Execute db command */
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    const cursor = collection.aggregate<T>(stages, {
      ...omit(options!, ['projection', 'sort', 'skip', 'limit', 'filter']),
      session: options?.session ?? this.getSession(),
    });
    /* Fetch the cursor and decode the result objects */
    try {
      const facetResult = await cursor.toArray();
      return {
        count: facetResult[0].count[0]?.totalMatches || 0,
        items: options?.noDecode
          ? facetResult[0].data
          : facetResult[0].data?.map((r: any) => outputCodec(r)),
      };
    } finally {
      if (!cursor.closed) await cursor.close();
    }
  }

  /**
   * Updates a document with the given id in the collection
   *
   * @param command - The command information.
   */
  protected async _update(
    command: MongoEntityService.UpdateOneCommand<T>,
  ): Promise<PartialDTO<T> | undefined> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const { input, inputRaw } = command;
    isNotNullish(input || inputRaw, { label: 'input' });
    if (input && inputRaw) {
      throw new TypeError(
        'You must pass one of MongoDB UpdateFilter or a partial document, not both',
      );
    }
    const update = this._prepareUpdate(command);
    const options = command.options;
    const filter = MongoAdapter.prepareFilter([
      MongoAdapter.prepareKeyValues(command.documentId!, ['_id']),
      options?.filter,
    ]);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    const out = await collection.findOneAndUpdate(filter || {}, update, {
      upsert: undefined,
      ...options,
      returnDocument: 'after',
      includeResultMetadata: false,
      session: options?.session ?? this.getSession(),
      projection: MongoAdapter.prepareProjection(
        this.dataType,
        options?.projection,
        this._dataTypeScope,
      ),
    });
    const outputCodec = this._getOutputCodec('update');
    if (out) return outputCodec(out);
  }

  /**
   * Updates a document in the collection with the specified ID.
   *
   * @param command - The command information.
   */
  protected async _updateOnly(
    command: MongoEntityService.UpdateOneCommand<T>,
  ): Promise<number> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const { input, inputRaw } = command;
    isNotNullish(input || inputRaw, { label: 'input' });
    if (input && inputRaw) {
      throw new TypeError(
        'You must pass one of MongoDB UpdateFilter or a partial document, not both',
      );
    }
    const update = this._prepareUpdate(command);
    const options = command.options;
    const filter = MongoAdapter.prepareFilter([
      MongoAdapter.prepareKeyValues(command.documentId, ['_id']),
      options?.filter,
    ]);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    /* Create array fields if not exists */
    if (options?.initArrayFields) {
      const $set = options.initArrayFields.reduce((a, k) => {
        a[k] = { $ifNull: ['$' + k, []] };
        return a;
      }, {} as any);
      await collection.updateOne(filter || {}, [{ $set }], {
        ...options,
        session: options?.session ?? this.getSession(),
        arrayFilters: undefined,
        upsert: false,
      });
      delete options.initArrayFields;
    }
    /* Execute update operation */
    return (
      await collection.updateOne(filter || {}, update, {
        ...options,
        session: options?.session ?? this.getSession(),
        upsert: undefined,
      })
    ).matchedCount;
  }

  /**
   * Updates multiple documents in the collection based on the specified input and options.
   *
   * @param command - The command information.
   */
  protected async _updateMany(
    command: MongoEntityService.UpdateManyCommand<T>,
  ): Promise<number> {
    isNotNullish(command.input, { label: 'input' });
    const { input, inputRaw } = command;
    isNotNullish(input || inputRaw, { label: 'input' });
    if (input && inputRaw) {
      throw new TypeError(
        'You must pass one of MongoDB UpdateFilter or a partial document, not both',
      );
    }
    const update = this._prepareUpdate(command);
    const options = command.options;
    const filter = MongoAdapter.prepareFilter(options?.filter);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    /* Create array fields if not exists */
    if (options?.initArrayFields) {
      const $set = options.initArrayFields.reduce((a, k) => {
        a[k] = { $ifNull: ['$' + k, []] };
        return a;
      }, {} as any);
      await collection.updateMany(filter || {}, [{ $set }], {
        ...omit(options!, ['filter']),
        session: options?.session ?? this.getSession(),
        arrayFilters: undefined,
        upsert: false,
      });
      delete options.initArrayFields;
    }
    /* Execute update operation */
    return (
      await collection.updateMany(filter || {}, update, {
        ...omit(options!, ['filter']),
        session: options?.session ?? this.getSession(),
        upsert: false,
      })
    ).matchedCount;
  }

  /**
   * Replaces a document with the given id in the collection
   *
   * @param command - The command information.
   */
  protected async _replace(
    command: MongoEntityService.ReplaceCommand<T>,
  ): Promise<PartialDTO<T> | undefined> {
    const input: any = command.input;
    isNotNullish(input, { label: 'input' });
    isNotNullish(input._id, { label: 'input._id' });
    const inputCodec = this._getInputCodec('replace');
    const document: any = inputCodec(input);
    const { options } = command;

    const filter = MongoAdapter.prepareFilter([
      MongoAdapter.prepareKeyValues(command.documentId!, ['_id']),
      options?.filter,
    ]);
    const db = this.getDatabase();
    const collection = await this.getCollection(db);
    const out = await collection.findOneAndReplace(filter || {}, document, {
      upsert: undefined,
      ...options,
      returnDocument: 'after',
      includeResultMetadata: false,
      session: options?.session ?? this.getSession(),
      projection: MongoAdapter.prepareProjection(
        this.dataType,
        options?.projection,
        this._dataTypeScope,
      ),
    });
    const outputCodec = this._getOutputCodec('replace');
    if (out) return outputCodec(out);
  }

  protected _prepareUpdate(
    command:
      | MongoEntityService.UpdateOneCommand<T>
      | MongoEntityService.UpdateManyCommand<T>,
  ): UpdateFilter<T> {
    const { input, inputRaw } = command;
    isNotNullish(input || inputRaw, { label: 'input' });
    if (input && inputRaw) {
      throw new TypeError(
        'You must pass one of MongoDB UpdateFilter or a partial document, not both',
      );
    }
    if (inputRaw) return inputRaw;
    const inputCodec = this._getInputCodec('update');
    const doc = inputCodec(input!);
    delete doc._id;
    if (doc!._$push) {
      (doc as any)._$push = inputCodec(doc!._$push);
    }
    return this._generatePatch(command, doc);
  }

  protected _generatePatch(
    command:
      | MongoEntityService.UpdateOneCommand<T>
      | MongoEntityService.UpdateManyCommand<T>,
    doc: any,
  ) {
    const patchGenerator = new MongoPatchGenerator();
    const { update, arrayFilters, initArrayFields } =
      patchGenerator.generatePatch<T>(this.dataType, doc, {
        scope: this._dataTypeScope,
      });
    command.options = command.options || {};
    if (arrayFilters) {
      command.options.arrayFilters = command.options.arrayFilters || [];
      command.options.arrayFilters.push(...arrayFilters);
      command.options.initArrayFields = initArrayFields;
    }
    return update;
  }

  protected override async _executeCommand(
    command: MongoEntityService.CommandInfo,
    commandFn: () => any,
  ): Promise<any> {
    try {
      const result = await super._executeCommand(command, async () => {
        /* Call before[X] hooks */
        if (command.crud === 'create')
          await this._beforeCreate(
            command as MongoEntityService.CreateCommand<T>,
          );
        else if (command.crud === 'delete' && command.byId) {
          await this._beforeDelete(
            command as MongoEntityService.DeleteCommand<T>,
          );
        } else if (command.crud === 'delete' && !command.byId) {
          await this._beforeDeleteMany(
            command as MongoEntityService.DeleteCommand<T>,
          );
        } else if (command.crud === 'replace') {
          await this._beforeReplace(
            command as MongoEntityService.ReplaceCommand<T>,
          );
        } else if (command.crud === 'update' && command.byId) {
          await this._beforeUpdate(
            command as MongoEntityService.UpdateOneCommand<T>,
          );
        } else if (command.crud === 'update' && !command.byId) {
          await this._beforeUpdateMany(
            command as MongoEntityService.UpdateManyCommand<T>,
          );
        }
        /* Call command function */
        return commandFn();
      });
      /* Call after[X] hooks */
      if (command.crud === 'create')
        await this._afterCreate(
          command as MongoEntityService.CreateCommand<T>,
          result,
        );
      else if (command.crud === 'delete' && command.byId) {
        await this._afterDelete(
          command as MongoEntityService.DeleteCommand<T>,
          result,
        );
      } else if (command.crud === 'delete' && !command.byId) {
        await this._afterDeleteMany(
          command as MongoEntityService.DeleteCommand<T>,
          result,
        );
      } else if (command.crud === 'replace') {
        await this._afterReplace(
          command as MongoEntityService.ReplaceCommand<T>,
          result,
        );
      } else if (command.crud === 'update' && command.byId) {
        await this._afterUpdate(
          command as MongoEntityService.UpdateOneCommand<T>,
          result,
        );
      } else if (command.crud === 'update' && !command.byId) {
        await this._afterUpdateMany(
          command as MongoEntityService.UpdateManyCommand<T>,
          result,
        );
      }
      return result;
    } catch (e: any) {
      Error.captureStackTrace(e, this._executeCommand);
      await this.onError?.(e, this);
      throw e;
    }
  }

  protected async _beforeCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.CreateCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeDelete(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.DeleteCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeDeleteMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.DeleteCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeReplace(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.ReplaceCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeUpdate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.UpdateOneCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.UpdateManyCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.CreateCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterReplace(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.ReplaceCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterDelete(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.DeleteCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterDeleteMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.DeleteCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterUpdate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.UpdateOneCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result?: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: MongoEntityService.UpdateManyCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }
}
