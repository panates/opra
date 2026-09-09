import {
  type ApiField,
  ArrayType,
  ComplexType,
  DataType,
  EnumType,
  MappedType,
  MixinType,
  SimpleType,
  UnionType,
} from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';
import { mapSimpleType } from './simple-type.mapper.js';

/**
 * ComplexType/MappedType/MixinType all share the (non-exported)
 * `ComplexTypeBase` implementation: OPRA already resolves `base`
 * inheritance, mixin merging, and pick/omit/partial/required transforms
 * into a single flat `.fields('*')` set at construction time, so all three
 * kinds are mapped identically here — no separate "flatten MappedType" or
 * "merge MixinType" logic is needed on this side.
 */
function isFieldsBearing(
  dataType: DataType,
): dataType is ComplexType | MappedType | MixinType {
  return (
    dataType instanceof ComplexType ||
    dataType instanceof MappedType ||
    dataType instanceof MixinType
  );
}

/**
 * Maps a single field to its OpenAPI property schema. `required`-ness is
 * NOT included here — OPRA puts `required` on the field, OpenAPI puts it on
 * the containing object schema, so the caller collects required field names
 * into that schema's `required[]` array instead.
 */
function mapField(
  field: ApiField,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  let inner = mapDataTypeRef(field.type, ctx);
  if (field.isArray && !(field.type instanceof ArrayType)) {
    inner = { type: 'array', items: inner };
  }

  const extra: OpenApi.SchemaObject = {};
  if (field.description) extra.description = field.description;
  if (field.default !== undefined) extra.default = field.default;
  if (field.readonly) extra.readOnly = true;
  if (field.writeonly) extra.writeOnly = true;
  if (field.deprecated) extra.deprecated = true;
  if (Object.keys(extra).length === 0) return inner;

  // A `$ref`'s sibling keys are ignored in OpenAPI 3.0 (and best avoided in
  // 3.1 too, for consistency) — wrap in `allOf` so field-level overrides
  // (description/default/readOnly/...) actually take effect.
  if (inner.$ref) return { allOf: [inner], ...extra };
  return { ...inner, ...extra };
}

function mapObjectLike(
  dataType: ComplexType | MappedType | MixinType,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  const properties: Record<string, OpenApi.SchemaObject> = {};
  const required: string[] = [];
  for (const field of dataType.fields('*')) {
    properties[field.name] = mapField(field, ctx);
    if (field.required) required.push(field.name);
  }

  const schema: OpenApi.SchemaObject = { type: 'object' };
  if (Object.keys(properties).length) schema.properties = properties;
  if (required.length) schema.required = required;

  const additionalFields = dataType.additionalFields;
  if (additionalFields === true) schema.additionalProperties = true;
  else if (additionalFields === false) schema.additionalProperties = false;
  else if (additionalFields instanceof DataType)
    schema.additionalProperties = mapDataTypeRef(additionalFields, ctx);
  else if (Array.isArray(additionalFields))
    // ['error'] / ['error', message] — OPRA rejects unknown fields at runtime
    schema.additionalProperties = false;
  // else undefined: leave unset — OpenAPI's default (additional properties
  // allowed) is the closest honest mapping of "OPRA didn't say either way".

  // MixinType has no discriminatorField/discriminatorValue of its own.
  const discriminatorField = (dataType as ComplexType | MappedType)
    .discriminatorField;
  if (discriminatorField)
    schema.discriminator = { propertyName: discriminatorField };

  return schema;
}

function mapEnumType(dataType: EnumType): OpenApi.SchemaObject {
  return {
    type: 'string',
    enum: Object.keys(dataType.attributes),
  };
}

function mapArrayType(
  dataType: ArrayType,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  const schema: OpenApi.SchemaObject = {
    type: 'array',
    items: dataType.type ? mapDataTypeRef(dataType.type, ctx) : {},
  };
  if (dataType.minOccurs != null) schema.minItems = dataType.minOccurs;
  if (dataType.maxOccurs != null) schema.maxItems = dataType.maxOccurs;
  return schema;
}

function mapUnionType(
  dataType: UnionType,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  const schema: OpenApi.SchemaObject = {
    oneOf: dataType.types.map(t => mapDataTypeRef(t, ctx)),
  };
  if (dataType.discriminator)
    schema.discriminator = { propertyName: dataType.discriminator };
  return schema;
}

/**
 * Maps a DataType to its OpenAPI Schema Object, dispatching by kind. This
 * builds the shape itself — see `mapDataTypeRef()` for the "reference vs.
 * inline" decision used everywhere a type is actually consumed (fields,
 * array items, union members, request/response bodies...).
 */
export function mapDataType(
  dataType: DataType,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  let schema: OpenApi.SchemaObject;
  if (dataType instanceof SimpleType) schema = mapSimpleType(dataType, ctx);
  else if (isFieldsBearing(dataType)) schema = mapObjectLike(dataType, ctx);
  else if (dataType instanceof EnumType) schema = mapEnumType(dataType);
  else if (dataType instanceof ArrayType) schema = mapArrayType(dataType, ctx);
  else if (dataType instanceof UnionType) schema = mapUnionType(dataType, ctx);
  else {
    ctx.warn(
      `Unknown DataType kind "${dataType.kind}" — mapped to an empty schema`,
    );
    schema = {};
  }
  if (dataType.description && !schema.description)
    schema.description = dataType.description;
  return schema;
}

/**
 * Reference-or-inline: a named DataType becomes a `$ref` into
 * `components.schemas` (the schema itself is generated lazily, once, on
 * first reference); an anonymous DataType is inlined directly.
 *
 * SimpleTypes are always inlined, even named/custom ones — a named `$ref`
 * for something as small as `{type:"string", format:"uuid"}` adds
 * indirection without real benefit. Only "model" types (object-like, enum,
 * union, array) become reusable named components.
 */
export function mapDataTypeRef(
  dataType: DataType,
  ctx: OpenApiGenerateContext,
): OpenApi.SchemaObject {
  if (dataType instanceof SimpleType) return mapDataType(dataType, ctx);
  const name = ctx.getSchemaName(dataType);
  if (!name) return mapDataType(dataType, ctx);
  if (!ctx.hasSchema(name)) {
    // Reserve the slot before recursing so a type that (transitively)
    // references itself doesn't recurse forever.
    ctx.schemas[name] = {};
    ctx.schemas[name] = mapDataType(dataType, ctx);
  }
  return { $ref: `#/components/schemas/${name}` };
}
