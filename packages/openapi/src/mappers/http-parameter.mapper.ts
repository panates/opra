import type { HttpParameter } from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';
import { mapDataTypeRef } from './data-type.mapper.js';

/**
 * Maps a single HttpParameter to an OpenAPI Parameter Object. Returns
 * `undefined` (with a warning recorded) for pattern-matched (RegExp) names,
 * which OpenAPI has no way to express as a discrete parameter.
 */
export function mapHttpParameter(
  param: HttpParameter,
  ctx: OpenApiGenerateContext,
): OpenApi.ParameterObject | undefined {
  if (param.name instanceof RegExp) {
    ctx.warn(
      `Parameter with a pattern-matched name (/${param.name.source}/) in ` +
        `location "${param.location}" has no OpenAPI equivalent and was skipped`,
    );
    return undefined;
  }

  let schema: OpenApi.SchemaObject = param.type
    ? mapDataTypeRef(param.type, ctx)
    : { type: 'string' };
  if (param.isArray) schema = { type: 'array', items: schema };
  if (param.default !== undefined) schema.default = param.default;

  const out: OpenApi.ParameterObject = {
    name: param.name,
    in: param.location,
    schema,
  };
  if (param.description) out.description = param.description;
  // OpenAPI mandates `required: true` for every path parameter.
  if (param.location === 'path' || param.required) out.required = true;
  if (param.deprecated) out.deprecated = true;

  if (param.isArray) {
    // arraySeparator maps most naturally to comma-separated serialization —
    // OpenAPI's `style: form, explode: false` (query/cookie) or `style:
    // simple` (header), both CSV by default. A non-comma separator has no
    // direct style equivalent.
    out.style = param.location === 'header' ? 'simple' : 'form';
    out.explode = false;
    if (param.arraySeparator && param.arraySeparator !== ',') {
      ctx.warn(
        `Parameter "${param.name}" uses array separator "${param.arraySeparator}" — ` +
          `OpenAPI's comma-separated array style was used instead`,
      );
    }
  }
  return out;
}
