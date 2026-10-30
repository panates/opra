import type { estypes } from '@elastic/elasticsearch';
import { OpraFilter } from '@opra/common';
import type { ExecutionContext } from '@opra/core';
import type { HttpContext } from '@opra/http';
import _prepareFilter from './adapter-utils/prepare-filter.js';
import _preparePatch from './adapter-utils/prepare-patch.js';
import _prepareProjection from './adapter-utils/prepare-projection.js';
import _prepareSort from './adapter-utils/prepare-sort.js';

export namespace ElasticAdapter {
  export type FilterInput =
    OpraFilter.Expression | estypes.QueryDslQueryContainer | string | undefined;

  export const prepareFilter = _prepareFilter;
  export const preparePatch = _preparePatch;
  export const prepareProjection = _prepareProjection;
  export const prepareSort = _prepareSort;

  export interface TransformedRequest {
    method:
      | 'create'
      | 'delete'
      | 'deleteMany'
      | 'get'
      | 'replace'
      | 'findMany'
      | 'update'
      | 'updateMany';
    key?: any;
    data?: any;
    options: any;
  }

  /**
   * Parses the execution context and transforms it into an `ElasticAdapter.TransformedRequest`.
   *
   * @param context - The execution context to parse.
   * @returns A promise that resolves to the transformed request.
   * @throws {@link TypeError} if the context is not an `HttpContext`.
   * @throws {@link Error} if the operation is not compatible with the Elastic adapter.
   */
  export async function parseRequest(
    context: ExecutionContext,
  ): Promise<TransformedRequest> {
    if (context.transport !== 'http') {
      throw new TypeError('ElasticAdapter can parse only HttpContext');
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
            // The operation's declared defaults apply when the request gives none - as in the
            // SQB and Mongo adapters. Without them, an operation's `defaultSort` was silently
            // ignored and its `defaultLimit` never applied.
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
    throw new Error(`This operation is not compatible to Elastic adapter`);
  }
}
