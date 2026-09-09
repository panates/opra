import { ResourceNotAvailableError } from '@opra/common';
import { ExecutionContext, ServiceBase } from '@opra/core';
import mongodb, { type UpdateFilter } from 'mongodb';
import type { DTO, Nullish, PartialDTO, RequiredSome, Type } from 'ts-gems';
import { MongoAdapter } from '../adapter/mongo-adapter.js';
import type { MongoPatchDTO } from '../types.js';
import { MongoEntityService } from './mongo-entity-service.js';

/**
 * Options for MongoCollectionService.
 */
export namespace MongoCollectionService {
  /**
   * Configuration options for MongoCollectionService.
   */
  export interface Options extends MongoEntityService.Options {
    /**
     * Default maximum number of records returned by `findMany`.
     */
    defaultLimit?: number;
  }
}

/**
 * Service for managing a collection of entities backed by a MongoDB data source.
 *
 * @template T - The entity type managed by this service.
 */
export class MongoCollectionService<
  T extends mongodb.Document,
> extends MongoEntityService<T> {
  /**
   * Default maximum number of records returned by `findMany`.
   */
  defaultLimit: number;

  /**
   * Constructs a new instance.
   *
   * @param dataType - The entity class or its registered name.
   * @param options - Options for the collection service.
   */
  constructor(
    dataType: Type | string,
    options?: MongoCollectionService.Options,
  ) {
    super(dataType, options);
    this.defaultLimit = options?.defaultLimit || 10;
  }

  /**
   * Create a copy of this instance with given properties and context applied.
   *
   * @param context - The execution context or service base to associate with this instance.
   * @param [overwriteProperties] - An optional object containing properties to overwrite in the current instance.
   * @param [overwriteContext] - An optional partial context to apply and potentially overwrite parts of the provided execution context.
   * @returns The current instance with the specified properties and context applied.
   * @template P
   * @template C
   */
  for<C extends ExecutionContext, P extends Partial<this>>(
    context: C | ServiceBase,
    overwriteProperties?: Nullish<P>,
    overwriteContext?: Partial<C>,
  ): this & Required<P> {
    return super.for(context, overwriteProperties, overwriteContext) as this &
      Required<P>;
  }

  /**
   * Asserts the existence of a resource with the given ID.
   * Throws a ResourceNotFoundError if the resource does not exist.
   *
   * @param id - The ID of the resource to assert.
   * @param options - Optional options for checking the existence.
   * @returns A Promise that resolves when the resource exists.
   * @throws {@link ResourceNotAvailableError} - If the resource does not exist.
   */
  async assert(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.ExistsOptions<T>,
  ): Promise<void> {
    if (!(await this.exists(id, options)))
      throw new ResourceNotAvailableError(this.getResourceName(), id);
  }

  /**
   * Creates a new document in the MongoDB collection.
   * Interceptors will be called before performing db operation.
   *
   * @param input - The input data for creating the document.
   * @param options - The options for creating the document.
   * @returns A promise that resolves to the created document.
   * @throws {@link Error} if an unknown error occurs while creating the document.
   */
  async create(
    input: PartialDTO<T> | T,
    options: RequiredSome<MongoEntityService.CreateOptions, 'projection'>,
  ): Promise<PartialDTO<T>>;
  async create(
    input: PartialDTO<T> | T,
    options?: MongoEntityService.CreateOptions,
  ): Promise<T>;
  async create(
    input: any,
    options?: MongoEntityService.CreateOptions,
  ): Promise<PartialDTO<T> | T> {
    const command: MongoEntityService.CreateCommand<T> = {
      crud: 'create',
      method: 'create',
      byId: false,
      input,
      options,
    };
    input._id =
      input._id == null || input._id === ''
        ? this._generateId(command)
        : input._id;
    return this._executeCommand(command, async () => {
      const r = await this._create(command);
      const findCommand: MongoEntityService.FindOneCommand<T> = {
        ...command,
        crud: 'read',
        byId: true,
        documentId: r._id,
        options,
      };
      const out = await this._findById(findCommand);
      if (out) return out;
    });
  }

  /**
   * Returns the count of documents in the collection based on the provided options.
   *
   * @param options - The options for the count operation.
   * @returns A promise that resolves to the count of documents in the collection.
   */
  async count(options?: MongoEntityService.CountOptions<T>): Promise<number> {
    const command: MongoEntityService.CountCommand<T> = {
      crud: 'read',
      method: 'count',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._count(command);
    });
  }

  /**
   * Deletes a document from the collection.
   *
   * @param id - The ID of the document to delete.
   * @param [options] - Optional delete options.
   * @returns A Promise that resolves to the number of documents deleted.
   */
  async delete(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.DeleteOptions<T>,
  ): Promise<number> {
    const command: MongoEntityService.DeleteCommand<T> = {
      crud: 'delete',
      method: 'delete',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._delete(command);
    });
  }

  /**
   * Deletes multiple documents from the collection that meet the specified filter criteria.
   *
   * @param options - The options for the delete operation.
   * @returns A promise that resolves to the number of documents deleted.
   */
  async deleteMany(
    options?: MongoEntityService.DeleteManyOptions<T>,
  ): Promise<number> {
    const command: MongoEntityService.DeleteCommand<T> = {
      crud: 'delete',
      method: 'deleteMany',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._deleteMany(command);
    });
  }

  /**
   * The distinct command returns a list of distinct values for the given key across a collection.
   * @param field - The field to get distinct values for.
   * @param [options] - The options for the distinct operation.
   * @protected
   */
  async distinct(
    field: string,
    options?: MongoEntityService.DistinctOptions<T>,
  ): Promise<any[]> {
    const command: MongoEntityService.DistinctCommand<T> = {
      crud: 'read',
      method: 'distinct',
      byId: false,
      field,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._distinct(command);
    });
  }

  /**
   * Checks if an object with the given id exists.
   *
   * @param id - The id of the object to check.
   * @param [options] - The options for the query (optional).
   * @returns A Promise that resolves to a boolean indicating whether the object exists or not.
   */
  async exists(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.ExistsOptions<T>,
  ): Promise<boolean> {
    const command: MongoEntityService.ExistsCommand<T> = {
      crud: 'read',
      method: 'exists',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const findCommand = command as MongoEntityService.FindOneCommand<T>;
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter<T>([
          documentFilter,
          command.options?.filter,
        ]);
        findCommand.options = {
          ...command.options,
          filter,
          projection: ['_id'],
        };
      }
      return !!(await this._findById(findCommand));
    });
  }

  /**
   * Checks if an object with the given arguments exists.
   *
   * @param [options] - The options for the query (optional).
   * @returns A Promise that resolves to a boolean indicating whether the object exists or not.
   */
  async existsOne(
    options?: MongoEntityService.ExistsOptions<T>,
  ): Promise<boolean> {
    return !!(await this.findOne({ ...options, projection: ['_id'] }));
  }

  /**
   * Finds a document by its ID and returns it with the requested projection.
   *
   * @param id - The ID of the document to find.
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to the found document as a partial DTO, or `undefined` if not found.
   */
  async findById(
    id: MongoAdapter.AnyId,
    options: RequiredSome<MongoEntityService.FindOneOptions<T>, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Finds a document by its ID and returns the whole DTO.
   *
   * @param id - The ID of the document to find.
   * @param options - Optional query options.
   * @returns A promise that resolves to the found document as a full DTO, or `undefined` if not found.
   */
  async findById(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.FindOneOptions<T>,
  ): Promise<T | undefined>;
  async findById(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.FindOneOptions<T>,
  ): Promise<PartialDTO<T> | T | undefined> {
    const command: MongoEntityService.FindOneCommand<T> = {
      crud: 'read',
      method: 'findById',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._findById(command);
    });
  }

  /**
   * Finds a document in the collection that matches the specified options.
   *
   * @param [options] - The options for the query.
   * @returns A promise that resolves with the found document or undefined if no document is found.
   */
  /**
   * Finds the first record matching the given options and returns it with the requested projection.
   *
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to the found record as a partial DTO, or `undefined` if not found.
   */
  async findOne(
    options: RequiredSome<MongoEntityService.FindOneOptions<T>, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Finds the first record matching the given options and returns the whole DTO.
   *
   * @param options - Optional query options.
   * @returns A promise that resolves to the found record, or `undefined` if not found.
   */
  async findOne(
    options?: MongoEntityService.FindOneOptions<T>,
  ): Promise<T | undefined>;
  async findOne(
    options?: MongoEntityService.FindOneOptions<T>,
  ): Promise<PartialDTO<T> | T | undefined> {
    const command: MongoEntityService.FindOneCommand<T> = {
      crud: 'read',
      method: 'findOne',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._findOne(command);
    });
  }

  /**
   * Finds multiple documents matching the given options and returns them with the requested projection.
   *
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to an array of matching documents as partial DTOs.
   */
  async findMany(
    options: RequiredSome<MongoEntityService.FindManyOptions<T>, 'projection'>,
  ): Promise<PartialDTO<T>[]>;
  /**
   * Finds multiple documents matching the given options and returns them as whole DTOs.
   *
   * @param options - Optional query options.
   * @returns A promise that resolves to an array of matching documents as whole DTOs.
   */
  async findMany(
    options?: MongoEntityService.FindManyOptions<T>,
  ): Promise<DTO<T>[]>;
  async findMany(
    options?: MongoEntityService.FindManyOptions<T>,
  ): Promise<(PartialDTO<T> | DTO<T>)[]> {
    const command: MongoEntityService.FindManyCommand<T> = {
      crud: 'read',
      method: 'findMany',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      command.options = command.options || {};
      if (documentFilter) {
        command.options.filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
      }
      const limit = command.options?.limit || this.defaultLimit;
      if (limit) command.options.limit = limit;
      return this._findMany(command);
    });
  }

  /**
   * Finds multiple documents matching the given options and returns them with the total count.
   *
   * @param options - Options including a required `projection`.
   * @returns An object containing the items (as partial DTOs) and the total count.
   */
  async findManyWithCount(
    options: RequiredSome<MongoEntityService.FindManyOptions<T>, 'projection'>,
  ): Promise<{
    count: number;
    items: PartialDTO<T>[];
  }>;
  /**
   * Finds multiple documents matching the given options and returns them with the total count.
   *
   * @param options - Optional query options.
   * @returns An object containing the items (as full DTOs) and the total count.
   */
  async findManyWithCount(
    options?: MongoEntityService.FindManyOptions<T>,
  ): Promise<{
    count: number;
    items: DTO<T>[];
  }>;
  async findManyWithCount(
    options?: MongoEntityService.FindManyOptions<T>,
  ): Promise<{
    count: number;
    items: (PartialDTO<T> | DTO<T>)[];
  }> {
    const command: MongoEntityService.FindManyCommand<T> = {
      crud: 'read',
      method: 'findManyWithCount',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      command.options = command.options || {};
      if (documentFilter) {
        command.options.filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
      }
      const limit = command.options?.limit || this.defaultLimit;
      if (limit) command.options.limit = limit;
      return this._findManyWithCount(command);
    });
  }

  /**
   * Retrieves a document by its ID and returns it with the requested projection.
   * Throws a ResourceNotAvailableError if the document does not exist.
   *
   * @param id - The ID of the document to retrieve.
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to the retrieved document as a partial DTO.
   * @throws {@link ResourceNotAvailableError} If the document does not exist.
   */
  async get(
    id: MongoAdapter.AnyId,
    options: RequiredSome<MongoEntityService.FindOneOptions<T>, 'projection'>,
  ): Promise<PartialDTO<T>>;
  /**
   * Retrieves a document by its ID and returns the whole DTO.
   * Throws a ResourceNotAvailableError if the document does not exist.
   *
   * @param id - The ID of the document to retrieve.
   * @param options - Optional query options.
   * @returns A promise that resolves to the retrieved document as a full DTO.
   * @throws {@link ResourceNotAvailableError} If the document does not exist.
   */
  async get(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.FindOneOptions<T>,
  ): Promise<T>;
  async get(
    id: MongoAdapter.AnyId,
    options?: MongoEntityService.FindOneOptions<T>,
  ): Promise<PartialDTO<T> | T> {
    const out = await this.findById(id, options);
    if (!out) throw new ResourceNotAvailableError(this.getResourceName(), id);
    return out;
  }

  /**
   * Replaces a document by its ID and returns it with the requested projection.
   *
   * @param id - The ID of the document to replace.
   * @param input - The replacement document data.
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to the replaced document as a partial DTO, or `undefined` if not found.
   */
  async replace(
    id: MongoAdapter.AnyId,
    input: PartialDTO<T>,
    options: RequiredSome<MongoEntityService.ReplaceOptions<T>, 'projection'>,
  ): Promise<PartialDTO<T>>;
  /**
   * Replaces a document by its ID and returns the whole replaced DTO.
   *
   * @param id - The ID of the document to replace.
   * @param input - The replacement document data.
   * @param options - Optional replace options.
   * @returns A promise that resolves to the replaced document as a full DTO, or `undefined` if not found.
   */
  async replace(
    id: MongoAdapter.AnyId,
    input: PartialDTO<T>,
    options?: MongoEntityService.CreateOptions,
  ): Promise<T>;
  async replace(
    id: MongoAdapter.AnyId,
    input: any,
    options?: MongoEntityService.CreateOptions,
  ): Promise<PartialDTO<T> | T> {
    const command: MongoEntityService.ReplaceCommand<T> = {
      crud: 'replace',
      method: 'replace',
      documentId: id,
      byId: true,
      input,
      options,
    };
    input._id = id;
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return await this._replace(command);
    });
  }

  /**
   * Updates a document by its ID and returns it with the requested projection.
   *
   * @param id - The ID of the document to update.
   * @param input - The fields to update.
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to the updated document as a partial DTO, or `undefined` if not found.
   */
  async update(
    id: MongoAdapter.AnyId,
    input: MongoPatchDTO<T> | UpdateFilter<T>,
    options: RequiredSome<MongoEntityService.UpdateOneOptions<T>, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Updates a document by its ID and returns the whole updated DTO.
   *
   * @param id - The ID of the document to update.
   * @param input - The fields to update.
   * @param options - Optional update options.
   * @returns A promise that resolves to the updated document as a full DTO, or `undefined` if not found.
   */
  async update(
    id: MongoAdapter.AnyId,
    input: MongoPatchDTO<T> | UpdateFilter<T>,
    options?: MongoEntityService.UpdateOneOptions<T>,
  ): Promise<T | undefined>;
  async update(
    id: MongoAdapter.AnyId,
    input: MongoPatchDTO<T> | UpdateFilter<T>,
    options?: MongoEntityService.UpdateOneOptions<T>,
  ): Promise<PartialDTO<T> | T | undefined> {
    const isUpdateFilter =
      Array.isArray(input) || !!Object.keys(input).find(x => x.startsWith('$'));
    const command: MongoEntityService.UpdateOneCommand<T> = {
      crud: 'update',
      method: 'update',
      documentId: id,
      byId: true,
      input: isUpdateFilter ? undefined : (input as MongoPatchDTO<T>),
      inputRaw: isUpdateFilter ? input : undefined,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._update(command);
    });
  }

  /**
   * Updates a document in the collection with the specified ID.
   *
   * @param id - The ID of the document to update.
   * @param input - The partial input data to update the document with.
   * @param [options] - The options for updating the document.
   * @returns A promise that resolves to the number of documents modified.
   */
  async updateOnly(
    id: MongoAdapter.AnyId,
    input: MongoPatchDTO<T> | UpdateFilter<T>,
    options?: MongoEntityService.UpdateOneOptions<T>,
  ): Promise<number> {
    const isUpdateFilter =
      Array.isArray(input) || !!Object.keys(input).find(x => x.startsWith('$'));
    const command: MongoEntityService.UpdateOneCommand<T> = {
      crud: 'update',
      method: 'updateOnly',
      documentId: id,
      byId: true,
      input: isUpdateFilter ? undefined : (input as MongoPatchDTO<T>),
      inputRaw: isUpdateFilter ? input : undefined,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._updateOnly(command);
    });
  }

  /**
   * Updates multiple documents in the collection based on the specified input and options.
   *
   * @param input - The partial input to update the documents with.
   * @param [options] - The options for updating the documents.
   * @returns A promise that resolves to the number of documents matched and modified.
   */
  async updateMany(
    input: MongoPatchDTO<T> | UpdateFilter<T>,
    options?: MongoEntityService.UpdateManyOptions<T>,
  ): Promise<number> {
    const isUpdateFilter =
      Array.isArray(input) || !!Object.keys(input).find(x => x.startsWith('$'));
    const command: MongoEntityService.UpdateManyCommand<T> = {
      crud: 'update',
      method: 'updateMany',
      byId: false,
      input: isUpdateFilter ? undefined : (input as MongoPatchDTO<T>),
      inputRaw: isUpdateFilter ? input : undefined,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      if (documentFilter) {
        const filter = MongoAdapter.prepareFilter([
          documentFilter,
          command.options?.filter,
        ]);
        command.options = { ...command.options, filter };
      }
      return this._updateMany(command);
    });
  }
}
