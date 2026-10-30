import type { estypes } from '@elastic/elasticsearch';
import { ResourceNotAvailableError } from '@opra/common';
import { ExecutionContext, ServiceBase } from '@opra/core';
import type {
  Nullish,
  PartialDTO,
  PatchDTO,
  RequiredSome,
  Type,
} from 'ts-gems';
import { ElasticAdapter } from './elastic-adapter.js';
import { ElasticEntityService } from './elastic-entity-service.js';
import { ElasticService } from './elastic-service.js';

/**
 *
 * @namespace ElasticCollectionService
 */
export namespace ElasticCollectionService {
  /**
   * The constructor options of ElasticCollectionService.
   *
   * @interface Options
   * @extends ElasticService.Options
   */
  export interface Options extends ElasticEntityService.Options {
    documentFilter?: ElasticCollectionService['documentFilter'];
    /**
     * Maximum number of documents `findMany` and `findManyWithCount` return when the call gives
     * no `limit`. Unset by default: such a call returns every matching document. The HTTP
     * FindMany operation pages with its own `defaultLimit` and does not depend on this.
     */
    defaultLimit?: number;
  }

  export type DocumentFilter =
    | ElasticAdapter.FilterInput
    | ((
        args: ElasticEntityService.CommandInfo,
        _this: ElasticCollectionService,
      ) =>
        | ElasticAdapter.FilterInput
        | Promise<ElasticAdapter.FilterInput>
        | undefined);

  export interface FindManyWithCountResult<X> {
    items: X[];
    count: number;
    relation: estypes.SearchTotalHitsRelation;
  }
}

/**
 * Class representing an Elasticsearch collection service for interacting with an Elasticsearch index.
 *
 * @template T - The type of the documents in the collection.
 */
export class ElasticCollectionService<
  T extends object = any,
> extends ElasticEntityService<T> {
  /**
   * Represents a common filter for the service.
   */
  documentFilter?:
    | ElasticCollectionService.DocumentFilter
    | ElasticCollectionService.DocumentFilter[];

  /**
   * Maximum number of documents `findMany` and `findManyWithCount` return when the call gives no
   * `limit`. Unset by default: such a call returns every matching document, paged through with a
   * point in time, so it is not cut at the index's `max_result_window`.
   */
  defaultLimit?: number;

  /**
   * Constructs a new instance.
   *
   * @param dataType - The data type of the documents.
   * @param options - The options for the collection service.
   */
  constructor(
    dataType: Type | string,
    options?: ElasticCollectionService.Options,
  ) {
    super(dataType, options);
    this.documentFilter = options?.documentFilter;
    this.defaultLimit = options?.defaultLimit;
  }

  for<C extends ExecutionContext, P extends Partial<this>>(
    context: C | ServiceBase,
    overwriteProperties?: Nullish<P>,
    overwriteContext?: Partial<C>,
  ): this & Required<P> {
    if (overwriteProperties?.documentFilter && this.documentFilter) {
      overwriteProperties.documentFilter = [
        ...(Array.isArray(this.documentFilter)
          ? this.documentFilter
          : [this.documentFilter]),
        ...(Array.isArray(overwriteProperties?.documentFilter)
          ? overwriteProperties.documentFilter
          : [overwriteProperties.documentFilter]),
      ];
    }
    return super.for(context, overwriteProperties, overwriteContext);
  }

  /**
   * Asserts the existence of a resource with the given ID.
   *
   * @param id - The ID of the resource to assert.
   * @param options - Optional options for checking the existence.
   * @returns A promise that resolves when the resource exists.
   * @throws {@link ResourceNotAvailableError} if the resource does not exist.
   */
  async assert(
    id: string,
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<void> {
    if (!(await this.exists(id, options)))
      throw new ResourceNotAvailableError(this.getResourceName(), id);
  }

  /**
   * Adds a document to the specified index.
   *
   * @param input - The input data for creating the document.
   * @param options - The options for creating the document.
   * @returns A promise that resolves to the created response.
   * @throws {@link Error} if an unknown error occurs while creating the document.
   */
  async create(
    input: PartialDTO<T>,
    options?: ElasticEntityService.CreateOptions,
  ): Promise<estypes.CreateResponse> {
    const command: ElasticEntityService.CreateCommand = {
      crud: 'create',
      method: 'createOnly',
      byId: false,
      input,
      options,
    };
    command.input._id =
      command.input._id == null || command.input._id === ''
        ? this._generateId(command)
        : command.input._id;
    return this._executeCommand(command, () => this._create(command));
  }

  /**
   * Returns the count of documents in the collection based on the provided options.
   *
   * @param options - The options for the count operation.
   * @returns A promise that resolves to the count of documents.
   */
  async count(options?: ElasticEntityService.CountOptions): Promise<number> {
    const command: ElasticEntityService.CountCommand = {
      crud: 'read',
      method: 'count',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      const r = await this._count(command);
      return r.count;
    });
  }

  /**
   * Deletes a document from the collection by its ID.
   *
   * @param id - The ID of the document to delete.
   * @param options - Optional delete options.
   * @returns A promise that resolves to the delete response.
   */
  async delete(
    id: string,
    options?: ElasticEntityService.DeleteOptions,
  ): Promise<estypes.DeleteByQueryResponse> {
    const command: ElasticEntityService.DeleteCommand = {
      crud: 'delete',
      method: 'delete',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._delete(command);
    });
  }

  /**
   * Deletes multiple documents from the collection that meet the specified filter criteria.
   *
   * @param options - The options for the delete operation.
   * @returns A promise that resolves to the delete response.
   */
  async deleteMany(
    options?: ElasticEntityService.DeleteManyOptions,
  ): Promise<estypes.DeleteByQueryResponse> {
    const command: ElasticEntityService.DeleteManyCommand = {
      crud: 'delete',
      method: 'deleteMany',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._deleteMany(command);
    });
  }

  /**
   * Checks if an object with the given ID exists.
   *
   * @param id - The ID of the object to check.
   * @param options - The options for the query.
   * @returns A promise that resolves to a boolean indicating whether the object exists.
   */
  async exists(
    id: string,
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<boolean> {
    const command: ElasticEntityService.FindManyCommand = {
      crud: 'read',
      method: 'exists',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const request = {
        ...command.options?.request,
        terminate_after: 1,
        size: 0,
      };
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...options, request, filter };
      const r = await this._findMany(command);
      return !!(typeof r.hits.total === 'number'
        ? r.hits.total
        : r.hits.total?.value);
    });
  }

  /**
   * Checks if at least one document exists matching the specified criteria.
   *
   * @param options - The options for the query.
   * @returns A promise that resolves to a boolean indicating whether the object exists.
   */
  async existsOne(
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<boolean> {
    const command: ElasticEntityService.FindManyCommand = {
      crud: 'read',
      method: 'exists',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const request = {
        ...command.options?.request,
        terminate_after: 1,
        size: 0,
      };
      command.options = { ...options, request };
      const r = await this._findMany(command);
      return !!(typeof r.hits.total === 'number'
        ? r.hits.total
        : r.hits.total?.value);
    });
  }

  /**
   * Finds a document by its ID.
   *
   * @param id - The ID of the document.
   * @param options - The options for the find operation.
   * @returns A promise resolving to the found document, or undefined if not found.
   */
  async findById(
    id: string,
    options: RequiredSome<ElasticEntityService.FindOneOptions, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Finds a document by its ID.
   *
   * @param id - The ID of the document.
   * @param options - The options for the find operation.
   * @returns A promise resolving to the found document, or undefined if not found.
   */
  async findById(
    id: string,
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<T | undefined>;
  /**
   * Finds a document by its ID.
   *
   * @param id - The ID of the document.
   * @param options - The options for the find operation.
   * @returns A promise resolving to the found document, or undefined if not found.
   */
  async findById(
    id: string,
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<PartialDTO<T> | T | undefined> {
    const command: ElasticEntityService.FindManyCommand = {
      crud: 'read',
      method: 'findById',
      byId: true,
      documentId: id,
      options,
    };
    return this._executeCommand(command, async () => {
      const documentFilter = await this._getDocumentFilter(command);
      const filter = ElasticAdapter.prepareFilter([
        documentFilter,
        command.options?.filter,
      ]);
      const newCommand = {
        ...command,
        options: { ...command.options, filter, limit: 1 },
      } as ElasticEntityService.FindManyCommand;
      // _findMany has decoded the hits already. Decoding them again breaks any codec that does
      // not accept its own output - a Buffer-typed base64 field rejects the Buffer it made.
      const r = await this._findMany(newCommand);
      if (r.hits.hits?.length) {
        return {
          _id: r.hits.hits[0]._id,
          ...r.hits.hits[0]._source,
        };
      }
    });
  }

  /**
   * Finds a document in the collection that matches the specified criteria.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves with the found document or undefined if no document is found.
   */
  async findOne(
    options: RequiredSome<ElasticEntityService.FindOneOptions, 'projection'>,
  ): Promise<PartialDTO<T> | undefined>;
  /**
   * Finds a document in the collection that matches the specified criteria.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves with the found document or undefined if no document is found.
   */
  async findOne(
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<T | undefined>;
  /**
   * Finds a document in the collection that matches the specified criteria.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves with the found document or undefined if no document is found.
   */
  async findOne(
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<PartialDTO<T> | T | undefined> {
    const command: ElasticEntityService.FindManyCommand = {
      crud: 'read',
      method: 'findOne',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      const newCommand = {
        ...command,
        options: { ...command.options, filter, limit: 1 },
      } as ElasticEntityService.FindManyCommand;
      // _findMany has decoded the hits already. Decoding them again breaks any codec that does
      // not accept its own output - a Buffer-typed base64 field rejects the Buffer it made.
      const r = await this._findMany(newCommand);
      if (r.hits.hits?.length) {
        return {
          _id: r.hits.hits[0]._id,
          ...r.hits.hits[0]._source,
        };
      }
    });
  }

  /**
   * Finds multiple documents in the Elasticsearch collection.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves to an array of partial documents.
   */
  async findMany(
    options: RequiredSome<ElasticEntityService.FindManyOptions, 'projection'>,
  ): Promise<PartialDTO<T>[]>;
  /**
   * Finds multiple documents in the Elasticsearch collection.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves to an array of documents.
   */
  async findMany(options?: ElasticEntityService.FindManyOptions): Promise<T[]>;
  /**
   * Finds multiple documents in the Elasticsearch collection.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves to an array of documents.
   */
  async findMany(
    options?: ElasticEntityService.FindManyOptions,
  ): Promise<(PartialDTO<T> | T)[]> {
    const command: ElasticEntityService.FindManyCommand = {
      crud: 'read',
      method: 'findMany',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      const limit = command.options?.limit || this.defaultLimit;
      command.options = { ...command.options, filter, limit };
      const r = limit
        ? await this._findMany(command)
        : await this._findAll(command);
      return r.hits?.hits.map((x: any) => x._source) || [];
    });
  }

  async searchRaw(
    request: estypes.SearchRequest,
    options?: ElasticEntityService.SearchOptions,
  ): Promise<estypes.SearchResponse<PartialDTO<T>>> {
    const command: ElasticEntityService.SearchCommand = {
      crud: 'read',
      method: 'searchRaw',
      byId: false,
      request,
      options,
    };
    return this._executeCommand(command, async () => this._searchRaw(command));
  }

  /**
   * Finds multiple documents and returns both records and total count.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves to an object containing items and count.
   */
  async findManyWithCount(
    options: RequiredSome<ElasticEntityService.FindManyOptions, 'projection'>,
  ): Promise<ElasticCollectionService.FindManyWithCountResult<PartialDTO<T>>>;
  /**
   * Finds multiple documents and returns both records and total count.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves to an object containing items and count.
   */
  async findManyWithCount(
    options?: ElasticEntityService.FindManyOptions,
  ): Promise<ElasticCollectionService.FindManyWithCountResult<T>>;
  /**
   * Finds multiple documents and returns both records and total count.
   *
   * @param options - The options for the find operation.
   * @returns A promise that resolves to an object containing items and count.
   */
  async findManyWithCount(
    options?: ElasticEntityService.FindManyOptions,
  ): Promise<{
    count: number;
    items: (PartialDTO<T> | T)[];
  }> {
    const command: ElasticEntityService.FindManyCommand = {
      crud: 'read',
      method: 'findManyWithCount',
      byId: false,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      const limit = command.options?.limit || this.defaultLimit;
      command.options = {
        ...command.options,
        filter,
        limit,
        request: { ...command.options?.request, track_total_hits: true },
      };
      const r = limit
        ? await this._findMany(command)
        : await this._findAll(command);
      const out = {} as ElasticCollectionService.FindManyWithCountResult<any>;
      // The hits come decoded already - see findById.
      out.items = (r.hits.hits || []).map((x: any) => ({
        _id: x._id,
        ...x._source,
      }));
      if (typeof r.hits.total === 'object') {
        out.count = r.hits.total.value;
        out.relation = r.hits.total.relation;
      } else out.count = r.hits.total || 0;
      return out;
    });
  }

  /**
   * Retrieves a document from the collection by its ID. Throws error if not found.
   *
   * @param id - The ID of the document to retrieve.
   * @param options - Optional options for the operation.
   * @returns A promise that resolves to the retrieved document.
   * @throws {@link ResourceNotAvailableError} if the document with the specified ID does not exist.
   */
  async get(
    id: string,
    options: RequiredSome<ElasticEntityService.FindOneOptions, 'projection'>,
  ): Promise<PartialDTO<T>>;
  /**
   * Retrieves a document from the collection by its ID. Throws error if not found.
   *
   * @param id - The ID of the document to retrieve.
   * @param options - Optional options for the operation.
   * @returns A promise that resolves to the retrieved document.
   * @throws {@link ResourceNotAvailableError} if the document with the specified ID does not exist.
   */
  async get(
    id: string,
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<T>;
  /**
   * Retrieves a document from the collection by its ID. Throws error if not found.
   *
   * @param id - The ID of the document to retrieve.
   * @param options - Optional options for the operation.
   * @returns A promise that resolves to the retrieved document.
   * @throws {@link ResourceNotAvailableError} if the document with the specified ID does not exist.
   */
  async get(
    id: string,
    options?: ElasticEntityService.FindOneOptions,
  ): Promise<PartialDTO<T> | T> {
    const out = await this.findById(id, options);
    if (!out) throw new ResourceNotAvailableError(this.getResourceName(), id);
    return out;
  }

  /**
   * Updates a document in the collection with the specified ID.
   *
   * @param id - The ID of the document to update.
   * @param input - The partial input data to update the document with.
   * @param options - The options for updating the document.
   * @returns A promise that resolves to the update response.
   */
  async update(
    id: string,
    input: PatchDTO<T>,
    options?: ElasticEntityService.UpdateOneOptions,
  ): Promise<estypes.UpdateByQueryResponse> {
    const command: ElasticEntityService.UpdateCommand<T> = {
      crud: 'update',
      method: 'update',
      documentId: id,
      byId: true,
      input,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return await this._updateMany(command);
    });
  }

  /**
   * Updates multiple documents in the collection based on the specified input and options.
   *
   * @param input - The partial input to update the documents with.
   * @param options - The options for updating the documents.
   * @returns A promise that resolves to the update response.
   */
  async updateMany(
    input: PatchDTO<T>,
    options?: ElasticEntityService.UpdateManyOptions,
  ): Promise<estypes.UpdateByQueryResponse> {
    const command: ElasticEntityService.UpdateCommand<T> = {
      crud: 'update',
      method: 'updateMany',
      byId: false,
      input,
      options,
    };
    return this._executeCommand(command, async () => {
      const filter = ElasticAdapter.prepareFilter([
        await this._getDocumentFilter(command),
        command.options?.filter,
      ]);
      command.options = { ...command.options, filter };
      return this._updateMany(command);
    });
  }

  /**
   * Retrieves the common filter used for querying documents.
   *
   * @param command - The command information.
   * @protected
   * @returns The common filter or a promise that resolves to the common filter.
   */
  protected _getDocumentFilter(
    command: ElasticService.CommandInfo,
  ):
    | ElasticAdapter.FilterInput
    | Promise<ElasticAdapter.FilterInput>
    | undefined {
    const commonFilter = Array.isArray(this.documentFilter)
      ? this.documentFilter
      : [this.documentFilter];
    const mapped = commonFilter.map(f =>
      typeof f === 'function' ? f(command, this) : f,
    ) as ElasticAdapter.FilterInput[];
    return mapped.length > 1 ? ElasticAdapter.prepareFilter(mapped) : mapped[0];
  }
}
