import type { HttpMediaType, HttpRequestBody } from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';
import { mapDataTypeRef } from './data-type.mapper.js';

function mapHttpMediaType(
  media: HttpMediaType,
  ctx: OpenApiGenerateContext,
): OpenApi.MediaTypeObject {
  if (media.multipartFields?.length) {
    const properties: Record<string, OpenApi.SchemaObject> = {};
    for (const field of media.multipartFields) {
      if (field.fieldName instanceof RegExp) {
        ctx.warn(
          `Multipart field with a pattern-matched name (/${field.fieldName.source}/) ` +
            `has no OpenAPI equivalent and was skipped`,
        );
        continue;
      }
      properties[field.fieldName] =
        field.fieldType === 'file'
          ? { type: 'string', format: 'binary' }
          : field.type
            ? mapDataTypeRef(field.type, ctx)
            : { type: 'string' };
    }
    return { schema: { type: 'object', properties } };
  }
  if (media.type) {
    let schema = mapDataTypeRef(media.type, ctx);
    if (media.isArray) schema = { type: 'array', items: schema };
    return { schema };
  }
  return {};
}

/**
 * Maps an HttpRequestBody to an OpenAPI Request Body Object. OPRA-specific
 * flags that have no OpenAPI schema equivalent (`partial`,
 * `allowPatchOperators`, `allowNullOptionals`) are folded into the
 * description as a best-effort note rather than silently dropped.
 */
export function mapHttpRequestBody(
  body: HttpRequestBody,
  ctx: OpenApiGenerateContext,
): OpenApi.RequestBodyObject {
  const content: Record<string, OpenApi.MediaTypeObject> = {};
  for (const media of body.content) {
    const mediaObj = mapHttpMediaType(media, ctx);
    const contentTypes = Array.isArray(media.contentType)
      ? media.contentType
      : [media.contentType || 'application/json'];
    for (const ct of contentTypes) content[ct] = mediaObj;
  }

  const notes: string[] = [];
  if (body.partial)
    notes.push(`partial update (partial: ${JSON.stringify(body.partial)})`);
  if (body.allowPatchOperators) notes.push('allows patch operators');
  if (body.allowNullOptionals)
    notes.push('an explicit null clears an optional field');

  const out: OpenApi.RequestBodyObject = { content };
  if (body.required) out.required = true;
  const descParts = [
    body.description,
    notes.length ? `(OPRA: ${notes.join(', ')})` : undefined,
  ].filter(Boolean);
  if (descParts.length) out.description = descParts.join(' ');
  return out;
}
