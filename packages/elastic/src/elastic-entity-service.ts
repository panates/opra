import type { estypes } from '@elastic/elasticsearch';
import type { TransportRequestOptions } from '@elastic/transport';
import {
  ComplexType,
  DataType,
  DATATYPE_METADATA,
  InternalServerError,
} from '@opra/common';
import type {
  PartialDTO,
  PatchDTO,
  RequiredSome,
  StrictOmit,
  Type,
} from 'ts-gems';
import { isNotNullish, type vg } from 'valgen';
import { ElasticAdapter } from './elastic-adapter.js';
import { ElasticService } from './elastic-service.js';

/**
 *
 * @namespace ElasticEntityService
 */
export namespace ElasticEntityService {
  /**
   * The constructor options of ElasticEntityService.
   *
   * @interface Options
   * @extends ElasticService.Options
   */
  export interface Options extends ElasticService.Options {
    indexName?: ElasticEntityService['indexName'];
    resourceName?: ElasticEntityService['resourceName'];
    idGenerator?: ElasticEntityService['idGenerator'];
    scope?: ElasticEntityService['scope'];
  }

  export interface CommandInfo extends ElasticService.CommandInfo {}

  /**
   * Represents options for the "create" operation.
   */
  export interface CreateOptions {
    request?: StrictOmit<CreateRequest, 'id' | 'index' | 'document'>;
    transport?: TransportRequestOptions;
    replaceIfExists?: boolean;
  }

  /**
   * Represents options for the "count" operation.
   *
   * @template T - The type of the document.
   */
  export interface CountOptions {
    filter?: ElasticAdapter.FilterInput;
    request?: StrictOmit<CountRequest, 'index'>;
    transport?: TransportRequestOptions;
  }

  /**
   * Represents options for the "delete" operation.
   *
   * @template T - The type of the document.
   */
  export interface DeleteOptions {
    filter?: ElasticAdapter.FilterInput;
    request?: StrictOmit<DeleteByQueryRequest, 'index'>;
    transport?: TransportRequestOptions;
  }

  /**
   * Represents options for the "deleteMany" operation.
   *
   * @template T - The type of the document.
   */
  export interface DeleteManyOptions {
    filter?: ElasticAdapter.FilterInput;
    request?: StrictOmit<DeleteByQueryRequest, 'index'>;
    transport?: TransportRequestOptions;
  }

  /**
   * Represents options for the "findOne" operation.
   *
   * @template T - The type of the document.
   */
  export interface FindOneOptions extends StrictOmit<
    FindManyOptions,
    'limit'
  > {}

  /**
   * Represents options for the "findMany" operation.
   *
   * @template T - The type of the document.
   */
  export interface FindManyOptions {
    filter?: ElasticAdapter.FilterInput;
    projection?: string | string[];
    sort?: string[];
    limit?: number;
    skip?: number;
    request?: StrictOmit<
      SearchRequest,
      'index' | 'from' | 'size' | 'sort' | '_source'
    >;
    transport?: TransportRequestOptions;
    noDecode?: boolean;
  }

  /**
   * Represents options for the "search" operation.
   */
  export interface SearchOptions {
    transport?: TransportRequestOptions;
    noDecode?: boolean;
  }

  /**
   * Represents options for the "update" operation.
   *
   * @template T - The type of the document.
   */
  export interface UpdateOneOptions {
    filter?: ElasticAdapter.FilterInput;
    request?: StrictOmit<UpdateByQueryRequest, 'index'>;
    transport?: TransportRequestOptions;
  }

  /**
   * Represents options for the "updateMany" operation.
   *
   * @template T - The type of the document.
   */
  export interface UpdateManyOptions {
    filter?: ElasticAdapter.FilterInput;
    request?: StrictOmit<UpdateByQueryRequest, 'index'>;
    transport?: TransportRequestOptions;
  }

  export interface CreateCommand extends StrictOmit<
    RequiredSome<CommandInfo, 'input'>,
    'documentId'
  > {
    crud: 'create';
    options?: CreateOptions;
  }

  export interface CountCommand extends StrictOmit<
    CommandInfo,
    'documentId' | 'input'
  > {
    crud: 'read';
    options?: CountOptions;
  }

  export interface DeleteCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'delete';
    options?: DeleteOptions;
  }

  export interface DeleteManyCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'delete';
    options?: DeleteManyOptions;
  }

  export interface FindManyCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'read';
    options?: FindManyOptions;
  }

  export interface SearchCommand extends StrictOmit<CommandInfo, 'input'> {
    crud: 'read';
    request: SearchRequest;
    options?: SearchOptions;
  }

  export interface UpdateCommand<T> extends CommandInfo {
    crud: 'update';
    input: PatchDTO<T>;
    options?: UpdateOneOptions;
  }

  export type CreateRequest = estypes.CreateRequest;
  export type CreateResponse = estypes.CreateResponse;
  export type CountRequest = estypes.CountRequest;
  export type CountResponse = estypes.CountResponse;
  export type DeleteByQueryRequest = estypes.DeleteByQueryRequest;
  export type DeleteByQueryResponse = estypes.DeleteByQueryResponse;
  export type SearchRequest = estypes.SearchRequest;
  export type SearchResponse<T> = estypes.SearchResponse<T>;
  export type UpdateByQueryRequest = estypes.UpdateByQueryRequest;
  export type UpdateByQueryResponse = estypes.UpdateByQueryResponse;
  export type QueryDslQueryContainer = estypes.QueryDslQueryContainer;
  export type Script = estypes.Script;
  export type ScriptSource = estypes.ScriptSource;
}

/**
 * Class representing an Elasticsearch entity service for interacting with an Elasticsearch index.
 *
 * @template T - The type of the documents in the collection.
 */
export class ElasticEntityService<
  T extends object = any,
> extends ElasticService {
  protected _dataTypeScope?: string;
  protected _dataType_: Type | string;
  protected _dataType?: ComplexType;
  protected _inputCodecs: Record<string, vg.isObject.Validator<T>> = {};
  protected _outputCodecs: Record<string, vg.isObject.Validator<T>> = {};

  /**
   * Defines comma-delimited scopes for API document.
   */
  scope?: string;

  /**
   * Represents the name of an index in Elasticsearch.
   */
  indexName?: string | ((_this: any) => string);

  /**
   * Represents the name of a resource.
   */
  resourceName?: string | ((_this: any) => string);

  /**
   * Generates a new ID for a new document.
   */
  idGenerator?: (command: ElasticEntityService.CommandInfo, _this: any) => any;

  /**
   * Constructs a new instance.
   *
   * @param dataType - The data type of the documents.
   * @param options - The options for the entity service.
   */
  constructor(dataType: Type | string, options?: ElasticEntityService.Options) {
    super(options);
    this._dataType_ = dataType;
    if (options?.indexName) this.indexName = options?.indexName;
    else {
      if (typeof dataType === 'string') this.indexName = dataType;
      if (typeof dataType === 'function') {
        const metadata = Reflect.getMetadata(DATATYPE_METADATA, dataType);
        if (metadata) this.indexName = metadata.name;
      }
    }
    this.resourceName = options?.resourceName;
    this.idGenerator = options?.idGenerator;
  }

  /**
   * Retrieves the index name.
   *
   * @protected
   * @returns The index name.
   * @throws {@link Error} if the index name is not defined.
   */
  getIndexName(): string {
    const out =
      typeof this.indexName === 'function'
        ? this.indexName(this)
        : this.indexName;
    if (out) return out;
    throw new Error('indexName is not defined');
  }

  /**
   * Retrieves the resource name.
   *
   * @protected
   * @returns The resource name.
   * @throws {@link Error} if the resource name is not defined.
   */
  getResourceName(): string {
    const out =
      typeof this.resourceName === 'function'
        ? this.resourceName(this)
        : this.resourceName || this.getIndexName();
    if (out) return out;
    throw new Error('resourceName is not defined');
  }

  /**
   * Retrieves the OPRA data type.
   *
   * @throws {@link NotAcceptableError} if the data type is not a `ComplexType`.
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
   * Adds a JSON document to the specified data stream or index and makes it searchable.
   * If the target is an index and the document already exists,
   * the request updates the document and increments its version.
   *
   * @param command - The create command.
   * @protected
   * @throws {@link InternalServerError} if an unknown error occurs while creating the document.
   */
  protected async _create(
    command: ElasticEntityService.CreateCommand,
  ): Promise<ElasticEntityService.CreateResponse> {
    const input = command.input;
    isNotNullish(input, { label: 'input' });
    isNotNullish(input._id, { label: 'input._id' });
    const inputCodec = this._getInputCodec('create');
    const doc: any = inputCodec(input);
    delete doc._id;
    const { options } = command;
    const request: ElasticEntityService.CreateRequest = {
      ...options?.request,
      index: this.getIndexName(),
      id: input._id,
      document: doc,
    };
    const r = await this.__create(request, options);
    /* istanbul ignore next */
    if (!(r._id && (r.result === 'created' || r.result === 'updated'))) {
      throw new InternalServerError(
        `Unknown error while creating document for "${this.getResourceName()}"`,
      );
    }
    return r;
  }

  protected async __create(
    request: ElasticEntityService.CreateRequest,
    options?: ElasticEntityService.CreateOptions,
  ) {
    const client = this.getClient();
    return options?.replaceIfExists
      ? await client.index(request, options?.transport)
      : await client.create(request, options?.transport);
  }

  /**
   * Returns the count of documents in the collection based on the provided options.
   *
   * @param command - The count command.
   * @protected
   * @returns A promise that resolves to the count response.
   */
  protected async _count(
    command: ElasticEntityService.CountCommand,
  ): Promise<ElasticEntityService.CountResponse> {
    const { options } = command;
    const filterQuery = ElasticAdapter.prepareFilter([
      options?.filter,
      options?.request?.query,
    ]);
    let query: ElasticEntityService.QueryDslQueryContainer | undefined = {
      ...options?.request?.query,
      ...(filterQuery as any),
    };
    if (!Object.keys(query!).length) query = undefined;
    const request: ElasticEntityService.CountRequest = {
      index: this.getIndexName(),
      ...options?.request,
      query,
    };
    return this.__count(request, options);
  }

  protected __count(
    request: ElasticEntityService.CountRequest,
    options?: ElasticEntityService.CountOptions,
  ) {
    const client = this.getClient();
    return client.count(request, options?.transport);
  }

  /**
   * Deletes a document from the collection.
   *
   * @param command - The delete command.
   * @protected
   * @returns A promise that resolves to the delete response.
   */
  protected async _delete(
    command: ElasticEntityService.DeleteCommand,
  ): Promise<ElasticEntityService.DeleteByQueryResponse> {
    isNotNullish(command.documentId, { label: 'documentId' });
    const { options } = command;
    const filterQuery = ElasticAdapter.prepareFilter([
      { ids: { values: [command.documentId] } },
      options?.filter,
      options?.request?.query,
    ]);
    let query: ElasticEntityService.QueryDslQueryContainer | undefined = {
      ...options?.request?.query,
      ...(filterQuery as any),
    };
    if (!Object.keys(query!).length) query = { match_all: {} };
    const request: ElasticEntityService.DeleteByQueryRequest = {
      index: this.getIndexName(),
      ...options?.request,
      query,
    };
    return this.__delete(request, options);
  }

  /**
   * Deletes multiple documents from the collection that meet the specified filter criteria.
   *
   * @param command - The deleteMany command.
   * @protected
   * @returns A promise that resolves to the delete response.
   */
  protected async _deleteMany(
    command: ElasticEntityService.DeleteManyCommand,
  ): Promise<ElasticEntityService.DeleteByQueryResponse> {
    const { options } = command;
    const filterQuery = ElasticAdapter.prepareFilter([
      options?.filter,
      options?.request?.query,
    ]);
    let query: ElasticEntityService.QueryDslQueryContainer | undefined = {
      ...options?.request?.query,
      ...(filterQuery as any),
    };
    if (!Object.keys(query!).length) query = { match_all: {} };
    const request: ElasticEntityService.DeleteByQueryRequest = {
      ...options?.request,
      index: this.getIndexName(),
      query,
    };
    return await this.__delete(request, options);
  }

  protected async __delete(
    request: ElasticEntityService.DeleteByQueryRequest,
    options?: ElasticEntityService.DeleteOptions,
  ) {
    const client = this.getClient();
    return client.deleteByQuery(request, options?.transport);
  }

  /**
   * Returns search hits that match the query defined in the request.
   *
   * @param command - The findMany command.
   * @returns A promise that resolves to the search response.
   */
  protected async _findMany(
    command: ElasticEntityService.FindManyCommand,
  ): Promise<ElasticEntityService.SearchResponse<PartialDTO<T>>> {
    const { options } = command;
    const filterQuery = ElasticAdapter.prepareFilter([
      command.documentId
        ? { ids: { values: [command.documentId] } }
        : undefined,
      options?.filter,
      // options?.request?.query,
    ]);

    let query = this._mergeQueries(options?.request?.query, filterQuery);
    if (!(query && Object.keys(query).length)) query = { match_all: {} };

    const request: ElasticEntityService.SearchRequest = {
      from: options?.skip,
      size: options?.limit,
      sort: options?.sort
        ? ElasticAdapter.prepareSort(options?.sort)
        : undefined,
      _source: ElasticAdapter.prepareProjection(
        this.dataType,
        options?.projection,
        this._dataTypeScope,
      ),
      index: this.getIndexName(),
      ...options?.request,
      query,
    };
    const r = await this.__findMany(request, options);
    if (options?.noDecode) return r;
    if (r.hits.hits?.length) {
      const outputCodec = this.getOutputCodec('find');
      r.hits.hits = r.hits!.hits.map((x: any) => ({
        ...x,
        _source: {
          _id: x._id,
          ...outputCodec(x._source!),
        },
      }));
    }
    return r;
  }

  protected async __findMany(
    request: ElasticEntityService.SearchRequest,
    options?: ElasticEntityService.FindManyOptions,
  ) {
    const client = this.getClient();
    return client.search<T>(request, options?.transport);
  }

  /**
   * Executes a search operation on the Elasticsearch index using the provided search command.
   *
   * @param command - The search command containing the request configuration and optional transport settings.
   * @returns A promise resolving to the search response from Elasticsearch.
   */
  protected async _searchRaw(
    command: ElasticEntityService.SearchCommand,
  ): Promise<ElasticEntityService.SearchResponse<PartialDTO<T>>> {
    const { options } = command;
    const request: ElasticEntityService.SearchRequest = {
      index: this.getIndexName(),
      ...command.request,
    };
    const client = this.getClient();
    const r = await client.search<T>(request, options?.transport);
    if (r.hits.hits?.length) {
      const outputCodec = this.getOutputCodec('find');
      r.hits.hits = r.hits!.hits.map((x: any) => ({
        ...x,
        _source: {
          _id: x._id,
          ...outputCodec(x._source!),
        },
      }));
    }
    return r;
  }

  /**
   * Updates multiple documents in the collection based on the specified input and options.
   *
   * @param command - The update command.
   * @returns A promise that resolves to the update response.
   * @throws {@link TypeError} if both 'input' and 'script' are provided and the script language is not 'painless'.
   */
  protected async _updateMany(
    command: ElasticEntityService.UpdateCommand<T>,
  ): Promise<ElasticEntityService.UpdateByQueryResponse> {
    if (command.byId) isNotNullish(command.documentId, { label: 'documentId' });
    const { options } = command;
    const input: any = command.input;
    const requestScript = command.options?.request?.script;
    let script: ElasticEntityService.Script | undefined;
    const inputKeysLen = Object.keys(input).length;
    isNotNullish(inputKeysLen || script, { label: 'input' });
    if (requestScript) {
      if (typeof requestScript === 'string') script = { source: requestScript };
      else if ((requestScript as any).source || (requestScript as any).id)
        script = { ...(requestScript as ElasticEntityService.Script) };
      else
        script = { source: requestScript as ElasticEntityService.ScriptSource };
      script.lang = script.lang || 'painless';
      if (inputKeysLen > 0 && script.lang !== 'painless') {
        throw new TypeError(
          `You cannot provide 'input' and 'script' arguments at the same time unless the script lang is 'painless'`,
        );
      }
    }
    if (inputKeysLen) {
      delete input._id;
      const inputCodec = this._getInputCodec('update');
      const doc = inputCodec(input);
      const scr = ElasticAdapter.preparePatch(doc);
      if (script) {
        script.source =
          (script.source ? script.source + '\n' + script.source : '') +
          scr.source;
        script.params = { ...script.params, ...scr.params };
      } else script = scr;
    }
    script!.source = script?.source || 'return;';
    const filterQuery = ElasticAdapter.prepareFilter([
      command.byId ? { ids: { values: [command.documentId] } } : undefined,
      options?.filter,
      options?.request?.query,
    ]);
    let query: ElasticEntityService.QueryDslQueryContainer | undefined = {
      ...options?.request?.query,
      ...(filterQuery as any),
    };
    if (!Object.keys(query!).length) query = { match_all: {} };
    const request: ElasticEntityService.UpdateByQueryRequest = {
      ...options?.request,
      index: this.getIndexName(),
      script,
      query,
    };
    return await this.__update(request, options);
  }

  protected async __update(
    request: ElasticEntityService.UpdateByQueryRequest,
    options?: ElasticEntityService.UpdateManyOptions,
  ) {
    const client = this.getClient();
    return client.updateByQuery(request, options?.transport);
  }

  /**
   * Generates an ID.
   *
   * @protected
   * @returns The generated ID.
   */
  protected _generateId(command: ElasticEntityService.CommandInfo): any {
    return typeof this.idGenerator === 'function'
      ? this.idGenerator(command, this)
      : undefined;
  }

  /**
   * Retrieves the codec for the specified operation.
   *
   * @param operation - The operation to retrieve the encoder for. Valid values are 'create' and 'update'.
   */
  protected _getInputCodec(operation: string): vg.isObject.Validator<T> {
    const dataType = this.dataType;
    const cacheKey =
      operation + (this._dataTypeScope ? ':' + this._dataTypeScope : '');
    let validator = this._inputCodecs[cacheKey];
    if (validator) return validator;
    const options: DataType.GenerateCodecOptions = {
      projection: '*',
      scope: this._dataTypeScope,
    };
    if (operation === 'update') {
      options.partial = 'deep';
      options.keepKeyFields = true;
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
   * Retrieves the codec.
   */
  getOutputCodec(operation: string): vg.isObject.Validator<T> {
    const cacheKey =
      operation + (this._dataTypeScope ? ':' + this._dataTypeScope : '');
    let validator = this._outputCodecs[cacheKey];
    if (validator) return validator;
    const options: DataType.GenerateCodecOptions = {
      projection: '*',
      partial: 'deep',
      scope: this._dataTypeScope,
    };
    const dataType = this.dataType;
    validator = dataType.generateCodec(
      'decode',
      options,
    ) as vg.isObject.Validator<T>;
    this._outputCodecs[cacheKey] = validator;
    return validator;
  }

  protected async _executeCommand(
    command: ElasticEntityService.CommandInfo,
    commandFn: () => any,
  ): Promise<any> {
    try {
      const result = await super._executeCommand(command, async () => {
        /* Call before[X] hooks */
        if (command.crud === 'create')
          await this._beforeCreate(
            command as ElasticEntityService.CreateCommand,
          );
        else if (command.crud === 'update' && command.byId) {
          await this._beforeUpdate(
            command as ElasticEntityService.UpdateCommand<T>,
          );
        } else if (command.crud === 'update' && !command.byId) {
          await this._beforeUpdateMany(
            command as ElasticEntityService.UpdateCommand<T>,
          );
        } else if (command.crud === 'delete' && command.byId) {
          await this._beforeDelete(
            command as ElasticEntityService.DeleteCommand,
          );
        } else if (command.crud === 'delete' && !command.byId) {
          await this._beforeDeleteMany(
            command as ElasticEntityService.DeleteCommand,
          );
        }
        /* Call command function */
        return commandFn();
      });
      /* Call after[X] hooks */
      if (command.crud === 'create')
        await this._afterCreate(
          command as ElasticEntityService.CreateCommand,
          result,
        );
      else if (command.crud === 'update' && command.byId) {
        await this._afterUpdate(
          command as ElasticEntityService.UpdateCommand<T>,
          result,
        );
      } else if (command.crud === 'update' && !command.byId) {
        await this._afterUpdateMany(
          command as ElasticEntityService.UpdateCommand<T>,
          result,
        );
      } else if (command.crud === 'delete' && command.byId) {
        await this._afterDelete(
          command as ElasticEntityService.DeleteCommand,
          result,
        );
      } else if (command.crud === 'delete' && !command.byId) {
        await this._afterDeleteMany(
          command as ElasticEntityService.DeleteCommand,
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

  protected _mergeQueries(
    requestQuery?: ElasticEntityService.QueryDslQueryContainer,
    filterQuery?: ElasticEntityService.QueryDslQueryContainer,
  ): ElasticEntityService.QueryDslQueryContainer | undefined {
    if (requestQuery) {
      let subQuery = false;
      if (requestQuery.function_score) {
        subQuery = true;
        if (Array.isArray(requestQuery.function_score)) {
          requestQuery.function_score.forEach(item => {
            item.filter = this._mergeQueries(item.filter, filterQuery);
          });
        } else {
          requestQuery.function_score.query = this._mergeQueries(
            requestQuery.function_score.query,
            filterQuery,
          );
        }
      }
      if (requestQuery.dis_max) {
        subQuery = true;
        requestQuery.dis_max.queries?.map(q =>
          this._mergeQueries(q, filterQuery),
        );
      }
      if (requestQuery.constant_score) {
        subQuery = true;
        requestQuery.constant_score.filter = this._mergeQueries(
          requestQuery.constant_score.filter,
          filterQuery,
        )!;
      }
      if (requestQuery.has_child) {
        subQuery = true;
        requestQuery.has_child.query = this._mergeQueries(
          requestQuery.has_child.query,
          filterQuery,
        )!;
      }
      if (requestQuery.has_parent) {
        subQuery = true;
        requestQuery.has_parent.query = this._mergeQueries(
          requestQuery.has_parent.query,
          filterQuery,
        )!;
      }
      if (requestQuery.script_score) {
        subQuery = true;
        requestQuery.script_score.query = this._mergeQueries(
          requestQuery.script_score.query,
          filterQuery,
        )!;
      }
      return subQuery
        ? requestQuery
        : ElasticAdapter.prepareFilter([requestQuery, filterQuery]);
    }
    return filterQuery;
  }

  protected async _beforeCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.CreateCommand,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeUpdate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.UpdateCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.UpdateCommand<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeDelete(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.DeleteCommand,
  ): Promise<void> {
    // Do nothing
  }

  protected async _beforeDeleteMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.DeleteCommand,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.CreateCommand,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterUpdate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.UpdateCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result?: PartialDTO<T>,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.UpdateCommand<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterDelete(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.DeleteCommand,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }

  protected async _afterDeleteMany(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    command: ElasticEntityService.DeleteCommand,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    affected: number,
  ): Promise<void> {
    // Do nothing
  }
}
