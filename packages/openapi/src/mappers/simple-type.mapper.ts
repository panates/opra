import type { SimpleType } from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';

/**
 * `{type, format}` for every builtin SimpleType name. Custom types that
 * `base` off one of these (directly or transitively) inherit its mapping —
 * see `resolveBuiltin()` below, which walks the `.base` chain.
 */
const BUILTIN_FORMATS: Record<
  string,
  { type: OpenApi.SchemaType; format?: string }
> = {
  any: { type: 'string' }, // no real "any" in OpenAPI 3.0; closest honest guess
  null: { type: 'null' },
  boolean: { type: 'boolean' },
  number: { type: 'number' },
  integer: { type: 'integer' },
  bigint: { type: 'string', format: 'int64' },
  string: { type: 'string' },
  date: { type: 'string', format: 'date' },
  datetime: { type: 'string', format: 'date-time' },
  datetimetz: { type: 'string', format: 'date-time' },
  time: { type: 'string', format: 'time' },
  uuid: { type: 'string', format: 'uuid' },
  email: { type: 'string', format: 'email' },
  url: { type: 'string', format: 'uri' },
  base64: { type: 'string', format: 'byte' },
  creditcard: { type: 'string' },
  ean: { type: 'string' },
  iban: { type: 'string' },
  ip: { type: 'string' },
  mobilephone: { type: 'string' },
  ObjectId: { type: 'string' },
  fieldpath: { type: 'string' },
  filter: { type: 'string' },
};

/** Walks `.base` until it hits a builtin (baseless) SimpleType, merging
 * `.properties` (own overrides base's) along the way. */
function resolveBuiltin(dataType: SimpleType): {
  name: string;
  properties: Record<string, any>;
} {
  let properties: Record<string, any> = {};
  let t: SimpleType | undefined = dataType;
  let last = dataType;
  while (t) {
    properties = { ...(t.properties || {}), ...properties };
    last = t;
    t = t.base;
  }
  return { name: last.name || 'string', properties };
}

export function mapSimpleType(
  dataType: SimpleType,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  const { name, properties } = resolveBuiltin(dataType);
  const builtin = BUILTIN_FORMATS[name] || { type: 'string' as const };
  const schema: OpenApi.SchemaObject = { type: builtin.type };
  if (builtin.format) schema.format = builtin.format;

  if (properties.pattern != null) {
    schema.pattern =
      properties.pattern instanceof RegExp
        ? properties.pattern.source
        : String(properties.pattern);
  }
  if (typeof properties.minLength === 'number')
    schema.minLength = properties.minLength;
  if (typeof properties.maxLength === 'number')
    schema.maxLength = properties.maxLength;
  if (typeof properties.minValue === 'number')
    schema.minimum = properties.minValue;
  if (typeof properties.maxValue === 'number')
    schema.maximum = properties.maxValue;
  if (name === 'ip' && (properties.version === 4 || properties.version === 6))
    schema.format = `ipv${properties.version}`;

  if (name === 'any') {
    // Best-effort: OpenAPI 3.0 has no "any" schema. Drop the type constraint
    // entirely for 3.1 (an empty schema means "anything"); for 3.0 leave the
    // guessed `string` type but flag it so consumers know it's approximate.
    if (ctx.version === '3.1') delete schema.type;
    else
      ctx.warn(
        `SimpleType "any" has no OpenAPI 3.0 equivalent — mapped to "string"`,
      );
  }
  if (name === 'null' && ctx.version === '3.0') {
    ctx.warn(
      `SimpleType "null" has no OpenAPI 3.0 equivalent — mapped to an empty schema`,
    );
    delete schema.type;
  }

  return schema;
}
