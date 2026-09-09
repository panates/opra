import type { HttpOperationResponse, HttpStatusRange } from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';
import { mapDataTypeRef } from './data-type.mapper.js';

/**
 * Expands a list of status ranges into OpenAPI response-map keys. A full
 * hundred-range (e.g. 400-499) becomes OpenAPI's `4XX` wildcard; anything
 * else is enumerated one code at a time (OpenAPI 3.x has no arbitrary
 * range syntax beyond the `NXX` wildcards).
 */
function statusKeysFor(ranges: HttpStatusRange[]): string[] {
  const keys: string[] = [];
  for (const r of ranges) {
    if (r.start === r.end) {
      keys.push(String(r.start));
      continue;
    }
    if (r.start % 100 === 0 && r.end === r.start + 99) {
      keys.push(`${String(r.start)[0]}XX`);
      continue;
    }
    for (let code = r.start; code <= r.end; code++) keys.push(String(code));
  }
  return keys;
}

function mapSingleResponse(
  res: HttpOperationResponse,
  ctx: OpenApiGenerateContext,
): OpenApi.ResponseObject {
  const out: OpenApi.ResponseObject = {
    description: res.description || 'Successful response',
  };

  if (res.type) {
    let schema = mapDataTypeRef(res.type, ctx);
    if (res.isArray) schema = { type: 'array', items: schema };
    const contentTypes = Array.isArray(res.contentType)
      ? res.contentType
      : [res.contentType || 'application/json'];
    out.content = {};
    for (const ct of contentTypes) out.content[ct] = { schema };
  }

  const headerParams = res.parameters.filter(p => p.location === 'header');
  if (headerParams.length) {
    out.headers = {};
    for (const p of headerParams) {
      if (p.name instanceof RegExp) continue;
      out.headers[p.name] = {
        description: p.description,
        schema: p.type ? mapDataTypeRef(p.type, ctx) : undefined,
      };
    }
  }
  return out;
}

/**
 * Maps every HttpOperationResponse on an operation into OpenAPI's
 * `responses` map, keyed by status code (or `NXX`/`default`).
 */
export function mapHttpResponses(
  responses: HttpOperationResponse[],
  ctx: OpenApiGenerateContext,
): Record<string, OpenApi.ResponseObject> {
  const out: Record<string, OpenApi.ResponseObject> = {};
  for (const res of responses) {
    const entry = mapSingleResponse(res, ctx);
    for (const key of statusKeysFor(res.statusCode)) out[key] = entry;
  }
  if (!Object.keys(out).length) {
    out.default = { description: 'No description provided' };
  }
  return out;
}
