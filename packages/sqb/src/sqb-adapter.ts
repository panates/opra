import type { OpraFilter } from '@opra/common';
import type { ExecutionContext } from '@opra/core';
import type { HttpContext } from '@opra/http';
import { EntityMetadata, type Repository } from '@sqb/connect';
import _prepareFilter from './adapter-utils/prepare-filter.js';

/**
 * SQBAdapter namespace provides types and utility functions for integrating SQB with Opra.
 */
export namespace SQBAdapter {
  /**
   * Represents a single identifier type.
   */
  export type Id = string | number | boolean | Date;

  /**
   * Represents a single identifier or a composite key.
   */
  export type IdOrIds = Id | Record<string, Id>;

  /**
   * Represents the input for a filter, which can be an Opra filter expression,
   * a SQB filter object, a string, or undefined.
   */
  export type FilterInput =
    | OpraFilter.Expression
    | Repository.FindManyOptions['filter']
    | string
    | undefined;

  /**
   * Parses the given filter input into a SQB filter expression.
   * @deprecated Use {@link prepareFilter} instead.
   */
  export const parseFilter = _prepareFilter;

  /**
   * Prepares the given filter input into a SQB filter expression.
   */
  export const prepareFilter = _prepareFilter;

  /**
   * Represents a request that has been transformed for SQB operations.
   */
  export interface TransformedRequest {
    /**
     * The operation method name.
     */
    method:
      | 'create'
      | 'delete'
      | 'deleteMany'
      | 'get'
      | 'replace'
      | 'findMany'
      | 'update'
      | 'updateMany';
    /**
     * The primary key for the operation, if applicable.
     */
    key?: any;
    /**
     * The data object for create or update operations.
     */
    data?: any;
    /**
     * Additional options for the SQB operation.
     */
    options: any;
  }

  /**
   * Parses an execution context and transforms it into a SQB-compatible request.
   *
   * @param context - The execution context to parse.
   * @returns A promise that resolves to the transformed request.
   * @throws {TypeError} If the context transport is not 'http'.
   * @throws {Error} If the operation is not compatible with SQB Adapter.
   */
  export async function parseRequest(
    context: ExecutionContext,
  ): Promise<TransformedRequest> {
    if (context.transport !== 'http') {
      throw new TypeError('SQBAdapter can parse only HttpContext');
    }
    const ctx = context as HttpContext;
    const { __oprDef } = ctx;

    if (
      __oprDef?.composition?.startsWith('Entity.') &&
      __oprDef.compositionOptions?.type
    ) {
      const dataType = ctx.__docNode.getComplexType(
        __oprDef.compositionOptions?.type,
      );
      const entityMetadata = EntityMetadata.get(dataType.ctor!);
      if (!entityMetadata)
        throw new Error(`Type class "${dataType.ctor}" is not an SQB entity`);
      const controller = __oprDef.owner;
      switch (__oprDef.composition) {
        case 'Entity.Create': {
          const data = await ctx.getBody<any>();
          const options = {
            projection: ctx.queryParams.projection,
          };
          return {
            method: 'create',
            data,
            options,
          } satisfies TransformedRequest;
        }
        case 'Entity.Delete': {
          const keyParam =
            __oprDef.parameters.find(p => p.keyParam) ||
            controller.parameters.find(p => p.keyParam);
          const key = keyParam && ctx.pathParams[String(keyParam.name)];
          const options = {
            filter: prepareFilter(ctx.queryParams.filter),
          };
          return {
            method: 'delete',
            key,
            options,
          } satisfies TransformedRequest;
        }
        case 'Entity.DeleteMany': {
          const options = {
            filter: prepareFilter(ctx.queryParams.filter),
          };
          return { method: 'deleteMany', options } satisfies TransformedRequest;
        }
        case 'Entity.FindMany': {
          const options = {
            count: ctx.queryParams.count,
            filter: prepareFilter(ctx.queryParams.filter),
            projection:
              ctx.queryParams.projection ||
              __oprDef.compositionOptions.defaultProjection,
            // A list request is always paged. The service applies no limit of its own any more,
            // so an operation that declares no `defaultLimit` falls back to the page size the
            // service used to impose.
            limit:
              ctx.queryParams.limit ||
              __oprDef.compositionOptions.defaultLimit ||
              100,
            skip: ctx.queryParams.skip,
            sort:
              ctx.queryParams.sort || __oprDef.compositionOptions.defaultSort,
          };
          return { method: 'findMany', options } satisfies TransformedRequest;
        }
        case 'Entity.Get': {
          const keyParam =
            __oprDef.parameters.find(p => p.keyParam) ||
            controller.parameters.find(p => p.keyParam);
          const key = keyParam && ctx.pathParams[String(keyParam.name)];
          const options = {
            projection: ctx.queryParams.projection,
            filter: parseFilter(ctx.queryParams.filter),
          };
          return { method: 'get', key, options } satisfies TransformedRequest;
        }
        case 'Entity.Replace': {
          const data = await ctx.getBody<any>();
          const keyParam =
            __oprDef.parameters.find(p => p.keyParam) ||
            controller.parameters.find(p => p.keyParam);
          const key = keyParam && ctx.pathParams[String(keyParam.name)];
          const options = {
            projection: ctx.queryParams.projection,
            filter: ctx.queryParams.filter,
          };
          return {
            method: 'replace',
            key,
            data,
            options,
          } satisfies TransformedRequest;
        }
        case 'Entity.Update': {
          const data = await ctx.getBody<any>();
          const keyParam =
            __oprDef.parameters.find(p => p.keyParam) ||
            controller.parameters.find(p => p.keyParam);
          const key = keyParam && ctx.pathParams[String(keyParam.name)];
          const options = {
            projection: ctx.queryParams.projection,
            filter: prepareFilter(ctx.queryParams.filter),
          };
          return {
            method: 'update',
            key,
            data,
            options,
          } satisfies TransformedRequest;
        }
        case 'Entity.UpdateMany': {
          const data = await ctx.getBody<any>();
          const options = {
            filter: prepareFilter(ctx.queryParams.filter),
          };
          return {
            method: 'updateMany',
            data,
            options,
          } satisfies TransformedRequest;
        }
        default:
          break;
      }
    }
    throw new Error(`This operation is not compatible to SQB Adapter`);
  }
}
