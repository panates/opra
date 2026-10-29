import { OpraFilter } from '@opra/common';
import type { ExecutionContext } from '@opra/core';
import type { HttpContext } from '@opra/http';
import mongodb, { ObjectId } from 'mongodb';
import _prepareFilter from './prepare-filter.js';
import _prepareKeyValues from './prepare-key-values.js';
import _prepareProjection from './prepare-projection.js';
import _prepareSort from './prepare-sort.js';

/**
 * MongoAdapter namespace provides types and utility functions for integrating MongoDB with Opra.
 */
export namespace MongoAdapter {
  /**
   * Represents any type of identifier that can be used in MongoDB.
   */
  export type AnyId = string | number | ObjectId;

  /**
   * Represents the input for a filter, which can be an Opra filter expression,
   * a MongoDB filter object, a string, or undefined.
   */
  export type FilterInput<T = any> =
    OpraFilter.Expression | mongodb.Filter<T> | string | undefined;

  /**
   * Prepares the given filter input into a MongoDB filter expression.
   */
  export const prepareFilter = _prepareFilter;

  /**
   * Prepares the given key values into a MongoDB compatible format.
   */
  export const prepareKeyValues = _prepareKeyValues;

  /**
   * Prepares the given projection into a MongoDB compatible format.
   */
  export const prepareProjection = _prepareProjection;

  /**
   * Prepares the given sort into a MongoDB compatible format.
   */
  export const prepareSort = _prepareSort;

  /**
   * Represents a request that has been transformed for MongoDB operations.
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
      | 'findMany'
      | 'replace'
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
     * Additional options for the MongoDB operation.
     */
    options: any;
  }

  /**
   * Parses an execution context and transforms it into a MongoDB-compatible request.
   *
   * @param context - The execution context to parse.
   * @returns A promise that resolves to the transformed request.
   * @throws {@link TypeError} If the context transport is not 'http'.
   * @throws {@link Error} If the operation is not compatible with MongoDB Adapter.
   */
  export async function parseRequest(
    context: ExecutionContext,
  ): Promise<TransformedRequest> {
    if (context.transport !== 'http') {
      throw new TypeError('MongoAdapter can parse only HttpContext');
    }
    const ctx = context as HttpContext;
    const { __oprDef } = ctx;
    if (
      __oprDef?.composition?.startsWith('Entity.') &&
      __oprDef.compositionOptions?.type
    ) {
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
            filter: ctx.queryParams.filter,
          };
          return {
            method: 'delete',
            key,
            options,
          } satisfies TransformedRequest;
        }
        case 'Entity.DeleteMany': {
          const options = {
            filter: ctx.queryParams.filter,
          };
          return { method: 'deleteMany', options } satisfies TransformedRequest;
        }
        case 'Entity.FindMany': {
          const options = {
            filter: ctx.queryParams.filter,
            projection:
              ctx.queryParams.projection ||
              __oprDef.compositionOptions.defaultProjection,
            count: ctx.queryParams.count,
            // A list request is always paged. The service applies no limit of its own any more,
            // so an operation that declares no `defaultLimit` falls back to the page size the
            // service used to impose.
            limit:
              ctx.queryParams.limit ||
              __oprDef.compositionOptions.defaultLimit ||
              10,
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
            filter: ctx.queryParams.filter,
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
            filter: ctx.queryParams.filter,
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
            filter: ctx.queryParams.filter,
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
    throw new Error(`This operation is not compatible to MongoDB adapter`);
  }
}
