import type { HttpOperation } from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';
import { mapHttpParameter } from './http-parameter.mapper.js';
import { mapHttpRequestBody } from './http-request-body.mapper.js';
import { mapHttpResponses } from './http-response.mapper.js';

const METHOD_MAP: Record<string, OpenApi.HttpMethodKey> = {
  GET: 'get',
  PUT: 'put',
  POST: 'post',
  DELETE: 'delete',
  OPTIONS: 'options',
  HEAD: 'head',
  PATCH: 'patch',
};

/**
 * Maps a single HttpOperation to an OpenAPI Operation Object plus the
 * lowercase method key it belongs under. Returns `undefined` (with a
 * warning recorded) for OPRA's `QUERY`/`SEARCH` methods, which aren't
 * valid OpenAPI 3.x path-item operations.
 */
export function mapHttpOperation(
  operation: HttpOperation,
  ctx: OpenApiGenerateContext,
):
  | { method: OpenApi.HttpMethodKey; operation: OpenApi.OperationObject }
  | undefined {
  const method = METHOD_MAP[operation.method];
  if (!method) {
    ctx.warn(
      `Operation "${operation.name}" uses HTTP method "${operation.method}", ` +
        `which OpenAPI does not support, and was skipped`,
    );
    return undefined;
  }

  const parameters: OpenApi.ParameterObject[] = [];
  for (const param of operation.parameters) {
    const mapped = mapHttpParameter(param, ctx);
    if (mapped) parameters.push(mapped);
  }

  const out: OpenApi.OperationObject = {
    operationId: operation.name,
    responses: mapHttpResponses(operation.responses, ctx),
  };
  if (operation.description) out.description = operation.description;
  if (parameters.length) out.parameters = parameters;
  if (operation.requestBody)
    out.requestBody = mapHttpRequestBody(operation.requestBody, ctx);

  return { method, operation: out };
}
