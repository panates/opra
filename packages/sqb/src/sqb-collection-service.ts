import { ResourceNotAvailableError } from '@opra/common';
import type { SqlElement } from '@sqb/builder';
import type { DTO, PartialDTO, PatchDTO, RequiredSome, Type } from 'ts-gems';
import { SQBAdapter } from './sqb-adapter.js';
import { SqbEntityService } from './sqb-entity-service.js';

/**
 * Options for SqbCollectionService.
 */
export namespace SqbCollectionService {
  /**
   * Configuration options for SqbCollectionService.
   */
  export interface Options extends SqbEntityService.Options {
    /**
     * Maximum number of records `findMany` and `findManyWithCount` return when the call gives
     * no `limit`. Unset by default: such a call returns every matching record. The HTTP
     * FindMany operation pages with its own `defaultLimit` and does not depend on this.
     */
    defaultLimit?: SqbCollectionService<any>['defaultLimit'];
    /**
     * Optional interceptor for the service operations.
     */
    interceptor?: SqbCollectionService<any>['interceptor'];
  }
}

/**
 * Service for managing a collection of entities backed by an SQB data source.
 *
 * @typeParam T - The entity type managed by this service
 */
export class SqbCollectionService<
  T extends object = object,
> extends SqbEntityService<T> {
  /**
   * Maximum number of records `findMany` and `findManyWithCount` return when the call gives no
   * `limit`. Unset by default: such a call returns every matching record.
   */
  defaultLimit?: number;

  /**
   * Constructs a new instance.
   *
   * @param dataType - The data type of the collection elements.
   * @param options - Options for the collection service.
   */
  constructor(
    dataType: Type<T> | string,
    options?: SqbCollectionService.Options,
  ) {
    super(dataType, options);
    this.defaultLimit = options?.defaultLimit;
  }

  /**
   * Asserts that a resource with the given ID exists.
   * Throws {@link ResourceNotAvailableError} if it does not.
   *
   * @param id - The ID of the resource to check.
   * @param options - Optional existence check options.
   * @throws {@link ResourceNotAvailableError} If the resource does not exist.
   */
  async assert(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.ExistsOptions,
  ): Promise<void> {
    if (!(await this.exists(id, options)))
      throw new ResourceNotAvailableError(this.getResourceName(), id);
  }

  /**
   * Creates a new resource and returns it with the requested projection.
   *
   * @param input - The input data for the new resource.
   * @param options - Options including a required `projection`.
   * @returns The created resource as a partial DTO.
   */
  async create(
    input: PartialDTO<T>,
    options: RequiredSome<SqbEntityService.CreateOptions, 'projection'>,
  ): Promise<PartialDTO<T>>;
  /**
   * Creates a new resource and returns the full DTO.
   *
   * @param input - The input data for the new resource.
   * @param options - Optional create options.
   * @returns The created resource as a full DTO.
   */
  async create(
    input: PartialDTO<T>,
    options?: SqbEntityService.CreateOptions,
  ): Promise<T>;
  async create(
    input: PartialDTO<T>,
    options?: SqbEntityService.CreateOptions,
  ): Promise<PartialDTO<T>> {
    const command: SqbEntityService.CreateCommand<T> = {
      crud: 'create',
      method: 'create',
      byId: false,
      input,
      options,
    };
    return this._executeCommand(command, () => this._create(command));
  }

  /**
   * Creates a new resource without returning it.
   *
   * @param input - The input data for the new resource.
   * @param options - Optional create options.
   */
  async createOnly(
    input: PartialDTO<T>,
    options?: SqbEntityService.CreateOptions,
  ): Promise<void> {
    const command: SqbEntityService.CreateCommand<T> = {
      crud: 'create',
      method: 'createOnly',
      byId: false,
      input,
      options,
    };
    return this._executeCommand(command, () => this._createOnly(command));
  }

  /**
   * Returns the number of records matching the given options.
   *
   * @param options - Options for the count operation.
   * @returns The number of matching records.
   */
  async count(options?: SqbEntityService.CountOptions): Promise<number> {
    const command: SqbEntityService.CountCommand = {
      crud: 'read',
      method: 'count',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._count(command);
    });
  }

  /**
   * Deletes the record with the given ID.
   *
   * @param id - The ID of the record to delete.
   * @param options - Optional delete options.
   * @returns The number of records deleted.
   */
  async delete(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.DeleteOptions,
  ): Promise<number> {
    const command: SqbEntityService.DeleteOneCommand = {
      crud: 'delete',
      method: 'delete',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._delete(command);
    });
  }

  /**
   * Deletes all records matching the given options.
   *
   * @param options - Options including filter criteria.
   * @returns The number of records deleted.
   */
  async deleteMany(
    options?: SqbEntityService.DeleteManyOptions,
  ): Promise<number> {
    const command: SqbEntityService.DeleteManyCommand = {
      crud: 'delete',
      method: 'deleteMany',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._deleteMany(command);
    });
  }

  /**
   * Checks whether a record with the given ID exists.
   *
   * @param id - The ID to check.
   * @param options - Optional query options.
   * @returns `true` if the record exists, `false` otherwise.
   */
  async exists(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.ExistsOptions,
  ): Promise<boolean> {
    const command: SqbEntityService.ExistsCommand = {
      crud: 'read',
      method: 'exists',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._exists(command);
    });
  }

  /**
   * Checks whether any record matching the given options exists.
   *
   * @param options - Optional query options.
   * @returns `true` if at least one matching record exists, `false` otherwise.
   */
  async existsOne(options?: SqbEntityService.ExistsOptions): Promise<boolean> {
    const command: SqbEntityService.ExistsCommand = {
      crud: 'read',
      method: 'existsOne',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._existsOne(command);
    });
  }

  /**
   * Finds a record by ID and returns it with the requested projection.
   *
   * @param id - The ID of the record.
   * @param options - Options including a required `projection`.
   * @returns The found record as a partial DTO, or `undefined` if not found.
   */
  async findById(
    id: SQBAdapter.IdOrIds,
    options?: RequiredSome<SqbEntityService.FindOneOptions, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Finds a record by ID and returns the whole DTO.
   *
   * @param id - The ID of the record.
   * @param options - Optional query options.
   * @returns The found record, or `undefined` if not found.
   */
  async findById(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.FindOneOptions,
  ): Promise<DTO<T> | undefined>;
  async findById(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.FindOneOptions,
  ): Promise<PartialDTO<T> | DTO<T> | undefined> {
    const command: SqbEntityService.FindOneCommand = {
      crud: 'read',
      method: 'findById',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getCommonFilter(command);
      const filter = SQBAdapter.prepareFilter([
        documentFilter,
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._findById(command);
    });
  }

  /**
   * Finds the first record matching the given options and returns it with the requested projection.
   *
   * @param options - Options including a required `projection`.
   * @returns A promise that resolves to the found record as a partial DTO, or `undefined` if not found.
   */
  async findOne(
    options: RequiredSome<SqbEntityService.FindOneOptions, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Finds the first record matching the given options and returns the whole DTO.
   *
   * @param options - Optional query options.
   * @returns A promise that resolves to the found record, or `undefined` if not found.
   */
  async findOne(
    options?: SqbEntityService.FindOneOptions,
  ): Promise<DTO<T> | undefined>;
  async findOne(
    options?: SqbEntityService.FindOneOptions,
  ): Promise<PartialDTO<T> | DTO<T> | undefined> {
    const command: SqbEntityService.FindOneCommand = {
      crud: 'read',
      method: 'findOne',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._findOne(command);
    });
  }

  /**
   * Finds multiple records matching the given options and returns partial DTOs.
   *
   * @param options - Options including a required `projection`.
   * @returns An array of matching records as partial DTOs.
   */
  async findMany(
    options?: RequiredSome<SqbEntityService.FindManyOptions, 'projection'>,
  ): Promise<PartialDTO<T>[]>;
  /**
   * Finds multiple records matching the given options and returns whole DTOs.
   *
   * @param options - Optional query options.
   * @returns An array of matching records as full DTOs.
   */
  async findMany(options?: SqbEntityService.FindManyOptions): Promise<DTO<T>[]>;
  async findMany(
    options?: SqbEntityService.FindManyOptions,
  ): Promise<(PartialDTO<T> | DTO<T>)[]> {
    const command: SqbEntityService.FindManyCommand = {
      crud: 'read',
      method: 'findMany',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      const limit = command.options?.limit || this.defaultLimit;
      command.options = { ...command.options, filter, limit };
      return this._findMany(command);
    });
  }

  /**
   * Finds multiple records and returns them together with the total count of matches.
   *
   * @param options - Options including a required `projection`.
   * @returns An object with `items` (partial DTOs) and `count` (total matches).
   */
  async findManyWithCount(
    options?: RequiredSome<SqbEntityService.FindManyOptions, 'projection'>,
  ): Promise<{
    count: number;
    items: PartialDTO<T>[];
  }>;
  /**
   * Finds multiple records and returns them together with the total count of matches.
   *
   * @param options - Optional query options.
   * @returns An object with `items` (full DTOs) and `count` (total matches).
   */
  async findManyWithCount(options?: SqbEntityService.FindManyOptions): Promise<{
    count: number;
    items: DTO<T>[];
  }>;
  async findManyWithCount(options?: SqbEntityService.FindManyOptions): Promise<{
    count: number;
    items: (PartialDTO<T> | DTO<T>)[];
  }> {
    const [items, count] = await Promise.all([
      this.findMany(options),
      this.count(options),
    ]);
    return { count, items };
  }

  /**
   * Retrieves a record by ID. Throws if the record does not exist.
   *
   * @param id - The ID of the record to retrieve.
   * @param options - Options including a required `projection`.
   * @returns The record as a partial DTO.
   * @throws {@link ResourceNotAvailableError} If the record does not exist.
   */
  async get(
    id: SQBAdapter.IdOrIds,
    options?: RequiredSome<SqbEntityService.FindOneOptions, 'projection'>,
  ): Promise<PartialDTO<T>>;
  /**
   * Retrieves a record by ID. Throws if the record does not exist.
   *
   * @param id - The ID of the record to retrieve.
   * @param options - Optional query options.
   * @returns The record as a full DTO.
   * @throws {@link ResourceNotAvailableError} If the record does not exist.
   */
  async get(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.FindOneOptions,
  ): Promise<DTO<T>>;
  async get(
    id: SQBAdapter.IdOrIds,
    options?: SqbEntityService.FindOneOptions,
  ): Promise<PartialDTO<T> | DTO<T>> {
    const out = await this.findById(id, options);
    if (!out) throw new ResourceNotAvailableError(this.getResourceName(), id);
    return out;
  }

  /**
   * Updates a record by ID and returns the updated record with the requested projection.
   *
   * @param id - The ID of the record to update.
   * @param input - The fields to update.
   * @param options - Options including a required `projection`.
   * @returns The updated record as a partial DTO, or `undefined` if not found.
   */
  async update(
    id: SQBAdapter.IdOrIds,
    input: PatchDTO<T, SqlElement>,
    options?: RequiredSome<SqbEntityService.UpdateOneOptions, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Updates a record by ID and returns the full updated DTO.
   *
   * @param id - The ID of the record to update.
   * @param input - The fields to update.
   * @param options - Optional update options.
   * @returns The updated record as a full DTO, or `undefined` if not found.
   */
  async update(
    id: SQBAdapter.IdOrIds,
    input: PatchDTO<T, SqlElement>,
    options?: SqbEntityService.UpdateOneOptions,
  ): Promise<DTO<T> | undefined>;
  async update(
    id: SQBAdapter.IdOrIds,
    input: PatchDTO<T, SqlElement>,
    options?: SqbEntityService.UpdateOneOptions,
  ): Promise<PartialDTO<T> | DTO<T> | undefined> {
    const command: SqbEntityService.UpdateOneCommand<T> = {
      crud: 'update',
      method: 'update',
      documentId: id,
      byId: true,
      input,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._update(command);
    });
  }

  /**
   * Updates a record by ID without returning it.
   *
   * @param id - The ID of the record to update.
   * @param input - The fields to update.
   * @param options - Optional update options.
   * @returns The number of records modified.
   */
  async updateOnly(
    id: SQBAdapter.IdOrIds,
    input: PatchDTO<T, SqlElement>,
    options?: SqbEntityService.UpdateOneOptions,
  ): Promise<number> {
    const command: SqbEntityService.UpdateOneCommand<T> = {
      crud: 'update',
      method: 'update',
      documentId: id,
      byId: true,
      input,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._updateOnly(command);
    });
  }

  /**
   * Updates all records matching the given options.
   *
   * @param input - The fields to update.
   * @param options - Options including filter criteria.
   * @returns The number of records modified.
   */
  async updateMany(
    input: PatchDTO<T, SqlElement>,
    options?: SqbEntityService.UpdateManyOptions,
  ): Promise<number> {
    const command: SqbEntityService.UpdateManyCommand<T> = {
      crud: 'update',
      method: 'updateMany',
      byId: false,
      input,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = SQBAdapter.prepareFilter([
        await this._getCommonFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._updateMany(command);
    });
  }
}
