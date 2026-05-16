import { ComplexType, DataType, InternalServerError } from '@opra/common';
import { ExecutionContext, ServiceBase } from '@opra/core';
import { sql, SqlElement } from '@sqb/builder';
import { EntityMetadata, Repository } from '@sqb/connect';
import type {
  Nullish,
  PartialDTO,
  PatchDTO,
  RequiredSome,
  StrictOmit,
  Type,
} from 'ts-gems';
import { isNotNullish, vg } from 'valgen';
import { SQBAdapter } from './sqb-adapter.js';
import { SqbServiceBase } from './sqb-service-base.js';

/**
 * Namespace containing types and options for SqbEntityService.
 */
export namespace SqbEntityService {
  /**
   * Configuration options for SqbEntityService.
   */
  export interface Options extends SqbServiceBase.Options {
    /**
     * The name of the resource managed by this service.
     */
    resourceName?: SqbEntityService<any>['resourceName'];
    /**
     * Optional error handler.
     */
    onError?: SqbEntityService<any>['onError'];
    /**
     * Optional common filter applied to all read/write operations.
     */
    commonFilter?: SqbEntityService<any>['commonFilter'];
    /**
     * Optional interceptor for the service operations.
     */
    interceptor?: SqbEntityService<any>['interceptor'];
    /**
     * Optional scope for the service.
     */
    scope?: SqbEntityService<any>['scope'];
  }

  /**
   * Represents the CRUD operation types.
   */
  export type CrudOp = 'create' | 'read' | 'update' | 'delete';

  /**
   * Information about the command being executed.
   */
  export interface CommandInfo {
    /* The CRUD operation type. */
    crud: SqbEntityService.CrudOp;
    /* The method name being called. */
    method: string;
    /* Whether the operation is targeting a specific record by ID. */
    byId: boolean;
    /* The identifier of the record, if applicable. */
    documentId?: SQBAdapter.IdOrIds;
    /* The input data for the operation, if applicable. */
    input?: Record<string, any>;
    /* The options for the operation, if applicable. */
    options?: Record<string, any>;
  }

  /**
   * Type definition for a common filter.
   */
  export type CommonFilter =
    | SQBAdapter.FilterInput
    | ((
        args: SqbEntityService.CommandInfo,
        _this: SqbEntityService<any>,
      ) =>
        | SQBAdapter.FilterInput
        | Promise<SQBAdapter.FilterInput>
        | undefined);

  /* Options for the `create` operation. */
  export interface CreateOptions extends Repository.CreateOptions {}

  /* Options for the `count` operation. */
  export interface CountOptions extends StrictOmit<
    Repository.CountOptions,
    'filter'
  > {
    /* Filter criteria for the count operation. */
    filter?: Repository.CountOptions['filter'] | string;
  }

  /* Options for the `delete` operation. */
  export interface DeleteOptions extends StrictOmit<
    Repository.DeleteOptions,
    'filter'
  > {
    /* Filter criteria for the delete operation. */
    filter?: Repository.DeleteOptions['filter'] | string;
  }

  /* Options for the `deleteMany` operation. */
  export interface DeleteManyOptions extends StrictOmit<
    Repository.DeleteManyOptions,
    'filter'
  > {
    /* Filter criteria for the delete many operation. */
    filter?: Repository.DeleteManyOptions['filter'] | string;
  }

  /* Options for `exists` / `existsOne` operations. */
  export interface ExistsOptions extends StrictOmit<
    Repository.ExistsOptions,
    'filter'
  > {
    /* Filter criteria for the existence check. */
    filter?: Repository.ExistsOptions['filter'] | string;
  }

  /* Options for the `findOne` / `findById` operations. */
  export interface FindOneOptions extends StrictOmit<
    Repository.FindOneOptions,
    'filter' | 'offset'
  > {
    /* Filter criteria for the query. */
    filter?: Repository.FindOneOptions['filter'] | string;
    /* Number of records to skip. */
    skip?: number;
  }

  /* Options for the `findMany` operation. */
  export interface FindManyOptions extends StrictOmit<
    Repository.FindManyOptions,
    'filter' | 'offset'
  > {
    /* Filter criteria for the query. */
    filter?: Repository.FindManyOptions['filter'] | string;
    /* Number of records to skip. */
    skip?: number;
  }

  /* Options for the `update` / `updateOnly` operations. */
  export interface UpdateOneOptions extends StrictOmit<
    Repository.UpdateOptions,
    'filter'
  > {
    /* Filter criteria for the update operation. */
    filter?: Repository.UpdateOptions['filter'] | string;
  }

  /* Options for the `updateMany` operation. */
  export interface UpdateManyOptions extends StrictOmit<
    Repository.UpdateManyOptions,
    'filter'
  > {
    /* Filter criteria for the update many operation. */
    filter?: Repository.UpdateManyOptions['filter'] | string;
  }

  /* Command interface for the `create` operation. */
  export interface CreateCommand<T> extends StrictOmit<
    RequiredSome<CommandInfo, 'input'>,
    'documentId'
  > {
    crud: 'create';
    input: PatchDTO<T>;
    options?: CreateOptions;
  }

  /* Command interface for the `count` operation. */
  export interface CountCommand extends StrictOmit<
    CommandInfo,
    'documentId' | 'input'
  > {
    crud: 'read';
    options?: CountOptions;
  }

  export interface DeleteOneCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'delete';
    options?: DeleteOptions;
  }

  export interface DeleteManyCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'delete';
    options?: DeleteManyOptions;
  }

  export interface ExistsCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'read';
    options?: ExistsOptions;
  }

  export interface FindOneCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'read';
    options?: FindOneOptions;
  }

  export interface FindManyCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'read';
    options?: FindManyOptions;
  }

  export interface UpdateOneCommand<T> extends CommandInfo {
    crud: 'update';
    input: PatchDTO<T, SqlElement>;
    options?: UpdateOneOptions;
  }

  export interface UpdateManyCommand<T> extends CommandInfo {
    crud: 'update';
    input: PatchDTO<T, SqlElement>;
    options?: UpdateManyOptions;
  }
}

export interface SqbEntityService {
  /**
   * Optional interceptor that wraps every command execution.
   *
   * @param next - Calls the next interceptor or the actual command handler.
   * @param command - Metadata describing the current operation.
   * @param _this - Reference to the service instance.
   * @returns The result of the command execution.
   */
  interceptor?(
    next: () => any,
    command: SqbEntityService.CommandInfo,
    _this: any,
  ): Promise<any>;
}

/**
 * Base service providing CRUD operations over an SQB entity.
 *
 * @typeParam T - The entity type managed by this service
 */
export class SqbEntityService<
  T extends object = object,
> extends SqbServiceBase {
  protected _dataTypeScope?: string;
  protected _dataType_: Type | string;
  protected _dataType?: ComplexType;
  protected _dataTypeClass?: Type;
  protected _entityMetadata?: EntityMetadata;
  protected _inputCodecs: Record<string, vg.isObject.Validator<T>> = {};
  protected _outputCodecs: Record<string, vg.isObject.Validator<T>> = {};

  /**
   * Comma-delimited scopes used to filter the API document.
   */
  scope?: string;

  /**
   * Override for the resource name exposed in error messages and API metadata.
   * Accepts a static string or a function that returns one.
   */
  resourceName?: string | ((_this: this) => string);

  /**
   * Filter(s) automatically applied to every query for this service.
   * Useful for multi-tenant isolation or other cross-cutting constraints.
   */
  commonFilter?:
    | SqbEntityService.CommonFilter
    | SqbEntityService.CommonFilter[];

  /**
   * Called whenever a command throws. Useful for logging or transforming errors.
   *
   * @param error - The thrown error.
   * @param command - The service command during which the error was thrown.
   * @param _this - The service instance.
   */
  onError?: (
    error: unknown,
    command: SqbEntityService.CommandInfo,
    _this: any,
  ) => void | Promise<void>;

  /**
   * Constructs a new instance.
   *
   * @param dataType - The entity class or its registered name.
   * @param options - Options for the service.
   */
  constructor(dataType: Type<T> | string, options?: SqbEntityService.Options) {
    super(options);
    this._dataType_ = dataType;
    this.resourceName = options?.resourceName;
    this.commonFilter = options?.commonFilter;
    this.interceptor = options?.interceptor;
  }

  /**
   * Returns the resolved OPRA `ComplexType` for this service's entity.
   *
   * @throws If the data type is not registered as a `ComplexType`.
   */
  get dataType(): ComplexType {
    if (this._dataType && this._dataTypeScope !== this.scope)
      this._dataType = undefined;
    if (!this._dataType)
      this._dataType = this.context.__docNode.getComplexType(this._dataType_);
    this._dataTypeScope = this.scope;
    return this._dataType;
  }

  /**
   * Returns the constructor class of the entity data type.
   *
   * @throws If the data type is not registered as a `ComplexType`.
   */
  get dataTypeClass(): Type {
    if (!this._dataTypeClass) this._dataTypeClass = this.entityMetadata.ctor;
    return this._dataTypeClass;
  }

  /**
   * Returns the SQB `EntityMetadata` for the entity class.
   *
   * @throws If the class is not decorated with `@Entity()`.
   */
  get entityMetadata(): EntityMetadata {
    if (!this._entityMetadata) {
      const t = this.dataType.ctor!;
      const metadata = EntityMetadata.get(t);
      if (!metadata)
        throw new TypeError(
          `Class (${t}) is not decorated with $Entity() decorator`,
        );
      this._entityMetadata = metadata;
    }
    return this._entityMetadata!;
  }

  for<C extends ExecutionContext, P extends Partial<this>>(
    context: C | ServiceBase,
    overwriteProperties?: Nullish<P>,
    overwriteContext?: Partial<C>,
  ): this & Required<P> {
    if (overwriteProperties?.commonFilter && this.commonFilter) {
      overwriteProperties.commonFilter = [
        ...(Array.isArray(this.commonFilter)
          ? this.commonFilter
          : [this.commonFilter]),
        ...(Array.isArray(overwriteProperties?.commonFilter)
          ? overwriteProperties.commonFilter
          : [overwriteProperties.commonFilter]),
      ];
    }
    return super.for(context, overwriteProperties, overwriteContext);
  }

  /**
   * Returns the resource name used in error messages and API metadata.
   *
   * @throws If neither `resourceName` nor the data type name is available.
   */
  getResourceName(): string {
    const out =
      typeof this.resourceName === 'function'
        ? this.resourceName(this)
        : this.resourceName || this.dataType.name;
    if (out) return out;
    throw new Error('resourceName is not defined');
  }

  /**
   * Returns the input codec for the given operation (e.g. `'create'`, `'update'`).
   *
   * @param operation - The operation name.
   */
  getInputCodec(operation: string): vg.isObject.Validator<T> {
    const dataType = this.dataType;
    const cacheKey =
      operation + (this._dataTypeScope ? ':' + this._dataTypeScope : '');
    let validator = this._inputCodecs[cacheKey];
    if (validator) return validator;
    const options: DataType.GenerateCodecOptions = {
      projection: '*',
      scope: this._dataTypeScope,
      fieldHook: (_, __, defaultGenerator) => {
        return vg.oneOf([defaultGenerator(), vg.isInstanceOf(SqlElement)]);
      },
    };
    if (operation === 'update') {
      options.partial = 'deep';
      options.allowNullOptionals = true;
    }
    validator = dataType.generateCodec(
      'decode',
      options,
    ) as vg.isObject.Validator<T>;
    this._inputCodecs[cacheKey] = validator;
    return validator;
  }

  /**
   * Returns the output codec for the given operation.
   *
   * @param operation - The operation name.
   */
  getOutputCodec(operation: string): vg.isObject.Validator<T> {
    const dataType = this.dataType;
    const cacheKey =
      operation + (this._dataTypeScope ? ':' + this._dataTypeScope : '');
    let validator = this._outputCodecs[cacheKey];
    if (validator) return validator;
    const options: DataType.GenerateCodecOptions = {
      projection: '*',
      partial: 'deep',
      scope: this._dataTypeScope,
    };
    validator = dataType.generateCodec(
      'decode',
      options,
    ) as vg.isObject.Validator<T>;
    this._outputCodecs[cacheKey] = validator;
    return validator;
  }

  /**
   * Inserts a new record into the database and returns the created document.
   *
   * @param command - The create command.
   * @returns The created document.
   * @protected
   */
  protected async _create(
    command: SqbEntityService.CreateCommand<T>,
  ): Promise<PartialDTO<T>> {
    const { input, options } = command;
    isNotNullish(command.input, { label: 'input' });
    const inputCodec = this.getInputCodec('create');
    const outputCodec = this.getOutputCodec('create');
    const data = inputCodec(input);
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    const out = await repo.create(data, options);
    if (out) return outputCodec(out);
    throw new InternalServerError(
      `Unknown error while creating document for "${this.getResourceName()}"`,
    );
  }

  /**
   * Inserts a new record into the database without returning it.
   *
   * @param command - The create command.
   * @protected
   */
  protected async _createOnly(
    command: SqbEntityService.CreateCommand<T>,
  ): Promise<any> {
    const { input, options } = command;
    isNotNullish(command.input, { label: 'input' });
    const inputCodec = this.getInputCodec('create');
    const data = inputCodec(input);
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    return await repo.createOnly(data, options);
  }

  /**
   * Returns the count of records matching the command options.
   *
   * @param command - The count command.
   * @protected
   */
  protected async _count(
    command: SqbEntityService.CountCommand,
  ): Promise<number> {
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return this._dbCount({ ...command.options, filter });
  }

  /**
   * Deletes the record identified by `command.documentId`.
   *
   * @param command - The delete command.
   * @returns The number of records deleted.
   * @protected
   */
  protected async _delete(
    command: SqbEntityService.DeleteOneCommand,
  ): Promise<number> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return this._dbDelete(command.documentId!, { ...command.options, filter });
  }

  /**
   * Deletes all records matching the command filter.
   *
   * @param command - The deleteMany command.
   * @returns The number of records deleted.
   * @protected
   */
  protected async _deleteMany(
    command: SqbEntityService.DeleteManyCommand,
  ): Promise<number> {
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return await this._dbDeleteMany({ ...command.options, filter });
  }

  /**
   * Checks whether the record identified by `command.documentId` exists.
   *
   * @param command - The exists command.
   * @protected
   */
  protected async _exists(
    command: SqbEntityService.ExistsCommand,
  ): Promise<boolean> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return await this._dbExists(command.documentId!, {
      ...command.options,
      filter,
    });
  }

  /**
   * Checks whether any record matching the command filter exists.
   *
   * @param command - The existsOne command.
   * @protected
   */
  protected async _existsOne(
    command: SqbEntityService.ExistsCommand,
  ): Promise<boolean> {
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return await this._dbExistsOne({ ...command.options, filter });
  }

  /**
   * Finds the record identified by `command.documentId`.
   *
   * @param command - The findById command.
   * @returns The found record, or `undefined` if not found.
   * @protected
   */
  protected async _findById(
    command: SqbEntityService.FindOneCommand,
  ): Promise<PartialDTO<T> | undefined> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const decode = this.getOutputCodec('find');
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    const out = await this._dbFindById(command.documentId!, {
      ...command.options,
      filter,
    });
    return out ? (decode(out) as PartialDTO<T>) : undefined;
  }

  /**
   * Finds the first record matching the command filter.
   *
   * @param command - The findOne command.
   * @returns The found record, or `undefined` if not found.
   * @protected
   */
  protected async _findOne(
    command: SqbEntityService.FindOneCommand,
  ): Promise<PartialDTO<T> | undefined> {
    const decode = this.getOutputCodec('find');
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    const out = await this._dbFindOne({ ...command.options, filter });
    return out ? (decode(out) as PartialDTO<T>) : undefined;
  }

  /**
   * Finds all records matching the command filter.
   *
   * @param command - The findMany command.
   * @returns An array of matching records.
   * @protected
   */
  protected async _findMany(
    command: SqbEntityService.FindManyCommand,
  ): Promise<PartialDTO<T>[]> {
    const decode = this.getOutputCodec('find');
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    const out: any[] = await this._dbFindMany({ ...command.options, filter });
    if (out?.length) {
      return out.map(x => decode(x)) as any;
    }
    return out;
  }

  /**
   * Updates the record identified by `command.documentId` and returns it.
   *
   * @param command - The update command.
   * @returns The updated record, or `undefined` if not found.
   * @protected
   */
  protected async _update(
    command: SqbEntityService.UpdateOneCommand<T>,
  ): Promise<PartialDTO<T> | undefined> {
    isNotNullish(command.documentId, { label: 'documentId' });
    isNotNullish(command.input, { label: 'input' });
    const { documentId, input, options } = command;
    const inputCodec = this.getInputCodec('update');
    const data: any = inputCodec(input);
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    const out = await this._dbUpdate(documentId!, data, { ...options, filter });
    const outputCodec = this.getOutputCodec('update');
    if (out) return outputCodec(out);
  }

  /**
   * Updates the record identified by `command.documentId` without returning it.
   *
   * @param command - The updateOnly command.
   * @returns The number of records modified.
   * @protected
   */
  protected async _updateOnly(
    command: SqbEntityService.UpdateOneCommand<T>,
  ): Promise<number> {
    isNotNullish(command.documentId, { label: 'documentId' });
    isNotNullish(command.input, { label: 'input' });
    const { documentId, input, options } = command;
    const inputCodec = this.getInputCodec('update');
    const data: any = inputCodec(input);
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return await this._dbUpdateOnly(documentId!, data, { ...options, filter });
  }

  /**
   * Updates all records matching the command filter.
   *
   * @param command - The updateMany command.
   * @returns The number of records modified.
   * @protected
   */
  protected async _updateMany(
    command: SqbEntityService.UpdateOneCommand<T>,
  ): Promise<number> {
    isNotNullish(command.input, { label: 'input' });
    const inputCodec = this.getInputCodec('update');
    const data: any = inputCodec(command.input);
    const filter = command.options?.filter
      ? SQBAdapter.prepareFilter(command.options.filter)
      : undefined;
    return await this._dbUpdateMany(data, { ...command.options, filter });
  }

  /**
   * Acquires a connection and performs `Repository.create`.
   *
   * @param input - The document to insert.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbCreate(
    input: PartialDTO<T>,
    options?: Repository.CreateOptions,
  ): Promise<PartialDTO<T>> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    return await repo.create(input as any, options);
  }

  /**
   * Acquires a connection and performs `Repository.count`.
   *
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbCount(options?: Repository.CountOptions): Promise<number> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.count(options);
  }

  /**
   * Acquires a connection and performs `Repository.delete`.
   *
   * @param id - The key field value identifying the record.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbDelete(
    id: SQBAdapter.IdOrIds,
    options?: Repository.DeleteOptions,
  ): Promise<number> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return (await repo.delete(id, options)) ? 1 : 0;
  }

  /**
   * Acquires a connection and performs `Repository.deleteMany`.
   *
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbDeleteMany(
    options?: Repository.DeleteManyOptions,
  ): Promise<number> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.deleteMany(options);
  }

  /**
   * Acquires a connection and performs `Repository.exists`.
   *
   * @param id - The key field value identifying the record.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbExists(
    id: SQBAdapter.IdOrIds,
    options?: Repository.ExistsOptions,
  ): Promise<boolean> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.exists(id, options);
  }

  /**
   * Acquires a connection and performs `Repository.existsOne`.
   *
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbExistsOne(
    options?: Repository.ExistsOptions,
  ): Promise<boolean> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.existsOne(options);
  }

  /**
   * Acquires a connection and performs `Repository.findById`.
   *
   * @param id - The key field value identifying the record.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbFindById(
    id: SQBAdapter.IdOrIds,
    options?: Repository.FindOptions,
  ): Promise<PartialDTO<T> | undefined> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.findById(id, options);
  }

  /**
   * Acquires a connection and performs `Repository.findOne`.
   *
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbFindOne(
    options?: StrictOmit<Repository.FindOneOptions, 'offset'> & {
      skip?: number;
    },
  ): Promise<PartialDTO<T> | undefined> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.findOne({ ...options, offset: options?.skip });
  }

  /**
   * Acquires a connection and performs `Repository.findMany`.
   *
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbFindMany(
    options?: StrictOmit<Repository.FindManyOptions, 'offset'> & {
      skip?: number;
    },
  ): Promise<PartialDTO<T>[]> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.findMany({ ...options, offset: options?.skip });
  }

  /**
   * Acquires a connection and performs `Repository.update`.
   *
   * @param id - The key field value identifying the record.
   * @param data - The update values.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbUpdate(
    id: SQBAdapter.IdOrIds,
    data: PatchDTO<T>,
    options?: Repository.UpdateOptions,
  ): Promise<PartialDTO<T> | undefined> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.update(id, data, options);
  }

  /**
   * Acquires a connection and performs `Repository.updateOnly`.
   *
   * @param id - The key field value identifying the record.
   * @param data - The update values.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbUpdateOnly(
    id: SQBAdapter.IdOrIds,
    data: PatchDTO<T>,
    options?: Repository.UpdateOptions,
  ): Promise<number> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return (await repo.updateOnly(id, data, options)) ? 1 : 0;
  }

  /**
   * Acquires a connection and performs `Repository.updateMany`.
   *
   * @param data - The update values.
   * @param options - Optional settings.
   * @protected
   */
  protected async _dbUpdateMany(
    data: PatchDTO<T>,
    options?: Repository.UpdateManyOptions,
  ): Promise<number> {
    const conn = await this.getConnection();
    const repo = conn.getRepository(this.dataTypeClass);
    if (options?.filter)
      options.filter = SQBAdapter.prepareFilter(options.filter);
    return await repo.updateMany(data as any, options);
  }

  /**
   * Builds the common filter for the given command.
   * Used primarily for multi-tenant isolation and similar cross-cutting concerns.
   *
   * @protected
   * @returns The resolved filter input, or `undefined` if none is configured.
   */
  protected _getCommonFilter(
    command: SqbEntityService.CommandInfo,
  ): SQBAdapter.FilterInput | Promise<SQBAdapter.FilterInput> | undefined {
    const commonFilter = Array.isArray(this.commonFilter)
      ? this.commonFilter
      : [this.commonFilter];
    const mapped = commonFilter.map(f =>
      typeof f === 'function' ? f(command, this) : f,
    );
    return mapped.length > 1 ? sql.And(...mapped) : mapped[0];
  }

  protected async _executeCommand(
    command: SqbEntityService.CommandInfo,
    commandFn: () => any,
  ): Promise<any> {
    let proto: any;
    const next = async () => {
      proto = proto ? Object.getPrototypeOf(proto) : this;
      while (proto) {
        if (
          proto.interceptor &&
          Object.prototype.hasOwnProperty.call(proto, 'interceptor')
        ) {
          return await proto.interceptor.call(this, next, command, this);
        }
        proto = Object.getPrototypeOf(proto);
        if (!(proto instanceof SqbEntityService)) break;
      }
      /* Call before[X] hooks */
      if (command.crud === 'create')
        await this._beforeCreate(command as SqbEntityService.CreateCommand<T>);
      else if (command.crud === 'update' && command.byId) {
        await this._beforeUpdate(
          command as SqbEntityService.UpdateOneCommand<T>,
        );
      } else if (command.crud === 'update' && !command.byId) {
        await this._beforeUpdateMany(
          command as SqbEntityService.UpdateOneCommand<T>,
        );
      } else if (command.crud === 'delete' && command.byId) {
        await this._beforeDelete(command as SqbEntityService.DeleteOneCommand);
      } else if (command.crud === 'delete' && !command.byId) {
        await this._beforeDeleteMany(
          command as SqbEntityService.DeleteManyCommand,
        );
      }
      /* Call command function */
      return commandFn();
    };
    try {
      const result = await next();
      /* Call after[X] hooks */
      if (command.crud === 'create')
        await this._afterCreate(
          command as SqbEntityService.CreateCommand<T>,
          result,
        );
      else if (command.crud === 'update' && command.byId) {
        await this._afterUpdate(
          command as SqbEntityService.UpdateOneCommand<T>,
          result,
        );
      } else if (command.crud === 'update' && !command.byId) {
        await this._afterUpdateMany(
          command as SqbEntityService.UpdateOneCommand<T>,
          result,
        );
      } else if (command.crud === 'delete' && command.byId) {
        await this._afterDelete(
          command as SqbEntityService.DeleteOneCommand,
          result,
        );
      } else if (command.crud === 'delete' && !command.byId) {
        await this._afterDeleteMany(
          command as SqbEntityService.DeleteManyCommand,
          result,
        );
      }
      return result;
    } catch (e: any) {
      Error.captureStackTrace(e, this._executeCommand);
      await this.onError?.(e, command, this);
      throw e;
    }
  }

  protected async _beforeCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.CreateCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeUpdate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.UpdateOneCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.UpdateManyCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeDelete(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.DeleteOneCommand,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeDeleteMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.DeleteManyCommand,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.CreateCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterUpdate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.UpdateOneCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result?: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.UpdateManyCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterDelete(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.DeleteOneCommand,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterDeleteMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: SqbEntityService.DeleteManyCommand,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }
}
