import {
  ApiField,
  ArrayType,
  ComplexType,
  type DataType,
  FieldsProjection,
  parseFieldsProjection,
} from '@opra/common';
import mongodb, { type Document } from 'mongodb';

/** An array field (`isArray: true`) is declared as `ArrayType(Note)`, not
 * `Note` directly — its own `.type` is the array wrapper, not the item
 * type a nested projection needs to recurse into. */
function unwrapArrayType(type: DataType): DataType {
  while (type instanceof ArrayType) type = type.type;
  return type;
}

/**
 * Prepares the MongoDB projection object based on the data type and requested projection.
 *
 * @param dataType - The data type of the entity.
 * @param projection - The requested projection (string, array of strings, Document, or '*').
 * @param scope - Optional scope for field visibility.
 * @returns The prepared MongoDB projection document, or `undefined`.
 */
export default function prepareProjection(
  dataType: ComplexType,
  projection?: string | string[] | Document | '*',
  scope?: string,
): mongodb.Document | undefined {
  if (projection === '*') return undefined;
  if (
    projection &&
    typeof projection === 'object' &&
    !Array.isArray(projection)
  )
    return projection;
  const out: Record<string, boolean> = {};
  const projection_ =
    typeof projection === 'string' || Array.isArray(projection)
      ? parseFieldsProjection(projection)
      : projection;
  prepare(dataType, out, projection_, scope);
  return Object.keys(out).length ? out : undefined;
}

export function prepare(
  dataType: ComplexType,
  target: mongodb.Document,
  projection?: FieldsProjection,
  scope?: string,
) {
  const defaultFields =
    !projection || !Object.values(projection).find(p => !p.sign);
  const projectionKeys = projection && Object.keys(projection);
  const projectionKeysSet = new Set(projectionKeys);
  let fieldName: string;
  let field: ApiField;
  let k: string;
  /* Add fields from data type */
  for (field of dataType.fields(scope)) {
    fieldName = field.name;
    k = fieldName.toLowerCase();
    projectionKeysSet.delete(k);
    const p = projection?.[k];
    if (
      /* Ignore if field is omitted */
      p?.sign === '-' ||
      /* Ignore if defaultFields is false and field is not in projection */
      (!defaultFields && !p) ||
      /* Ignore if defaultFields is true and fields is exclusive */
      (defaultFields && field.exclusive && !p)
    ) {
      continue;
    }

    const itemType = unwrapArrayType(field.type);
    if (itemType instanceof ComplexType && typeof p?.projection === 'object') {
      target[fieldName] = {};
      prepare(itemType, target[fieldName], p.projection);
      continue;
    }
    target[fieldName] = 1;
  }
  /* Add additional fields */
  if (dataType.additionalFields) {
    for (k of projectionKeysSet.values()) {
      const n = projection?.[k];
      if (n?.sign !== '-') target[k] = 1;
    }
  }
}
