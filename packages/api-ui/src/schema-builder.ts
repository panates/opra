import { omitUndefined } from '@jsopen/objects';
import {
  type ApiDocument,
  type ApiField,
  ArrayType,
  ComplexType,
  DataType,
  EnumType,
  type HttpApi,
  type HttpController,
  type HttpMediaType,
  type HttpOperation,
  type HttpOperationResponse,
  type HttpParameter,
  type HttpRequestBody,
  MappedType,
  MixinType,
  SimpleType,
  UnionType,
} from '@opra/common';

/**
 * Builds the plain JSON tree `@opra/api-ui` embeds into the page, by walking
 * the *runtime* `ApiDocument` object graph rather than calling
 * `ApiDocument.export()`.
 *
 * `.export()` deliberately preserves the inheritance structure (a
 * `ComplexType`'s own JSON only lists fields declared at that level, plus a
 * `base` reference the reader must resolve and merge — same for
 * `EnumType.attributes`/`ownAttributes`). That's the right shape for a wire
 * format, but it would force this package's client-side renderer to
 * reimplement OPRA's own base/mixin/pick-omit-partial merge algorithm.
 *
 * `ComplexType`, `MappedType` and `MixinType` all share the (non-exported)
 * `ComplexTypeBase` implementation, which already resolves all of that into
 * a single flat `fields('*')` set at construction time — and `EnumType`
 * already merges base attributes into its live `.attributes` map the same
 * way. Reading those runtime accessors directly means every "model" node in
 * the shipped JSON is already fully flattened; the client never needs to
 * walk a `base` chain itself.
 */
export namespace ApiUiSchemaBuilder {
  export interface Options {
    scope?: string;
  }

  export function build(document: ApiDocument, options?: Options): object {
    const ctx = new BuildContext(options?.scope);
    const out: Record<string, unknown> = {
      spec: '1.0',
      id: document.id,
      info: document.info,
    };

    const api = document.api as HttpApi | undefined;
    if (api && (api as { transport?: string }).transport === 'http') {
      const controllers: Record<string, unknown> = {};
      for (const ctrl of api.controllers.values()) {
        controllers[ctrl.name] = mapHttpController(ctrl, ctx);
      }
      out.api = omitUndefined({
        transport: 'http',
        url: api.url,
        controllers,
      });
    }

    // Registers every type the document declares, in addition to whatever
    // the controller/operation walk above already reached — catching a
    // declared-but-otherwise-unreferenced type. SimpleTypes are always
    // inlined (see `mapTypeRef`), so `ctx.types` only ever holds "model"
    // kinds (object-like, enum, union) — a clean list for the sidebar, with
    // no separate declared-vs-referenced bookkeeping needed.
    for (const dataType of document.types.values()) {
      if (dataType.name && dataType.inScope(ctx.scope))
        mapTypeRef(dataType, ctx);
    }
    if (Object.keys(ctx.types).length) out.types = ctx.types;

    return omitUndefined(out);
  }
}

/** Threaded through every mapper call: the scope filter, and the map of
 * already-registered named types (reserved before recursing, so a type
 * that transitively references itself doesn't recurse forever). */
class BuildContext {
  readonly scope?: string;
  readonly types: Record<string, unknown> = {};
  private readonly _names = new Map<DataType, string>();
  private readonly _namesInUse = new Set<string>();

  constructor(scope?: string) {
    this.scope = scope;
  }

  /** Returns the collision-safe name to register a named DataType under,
   * assigning one on first use. Anonymous types return `undefined`. */
  getTypeName(dataType: DataType): string | undefined {
    if (!dataType.name) return undefined;
    const existing = this._names.get(dataType);
    if (existing) return existing;
    let name = dataType.name;
    let i = 1;
    while (this._namesInUse.has(name)) name = `${dataType.name}${++i}`;
    this._namesInUse.add(name);
    this._names.set(dataType, name);
    return name;
  }

  hasType(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.types, name);
  }
}

function isFieldsBearing(
  dataType: DataType,
): dataType is ComplexType | MappedType | MixinType {
  return (
    dataType instanceof ComplexType ||
    dataType instanceof MappedType ||
    dataType instanceof MixinType
  );
}

function mapField(field: ApiField, ctx: BuildContext) {
  return omitUndefined({
    type: mapTypeRef(field.type, ctx),
    description: field.description,
    required: field.required || undefined,
    deprecated: field.deprecated || undefined,
  });
}

function mapObjectLike(
  dataType: ComplexType | MappedType | MixinType,
  ctx: BuildContext,
) {
  const fields: Record<string, unknown> = {};
  for (const field of dataType.fields('*')) {
    if (!field.inScope(ctx.scope)) continue;
    fields[field.name] = mapField(field, ctx);
  }
  return Object.keys(fields).length ? { fields } : {};
}

function mapEnumType(dataType: EnumType) {
  // `attributes` is already merged with every base EnumType's own values —
  // no separate base-walk needed. `alias` (the enum member's source name,
  // used by tooling like the CLI importer) is machine-only and not shipped.
  const values: Record<string, unknown> = {};
  for (const [key, meta] of Object.entries(dataType.attributes)) {
    values[key] = meta?.description ? { description: meta.description } : {};
  }
  return { values };
}

function mapSimpleTypeProperties(dataType: SimpleType) {
  let properties: unknown = dataType.properties;
  // Some SimpleTypes (e.g. the builtin `fieldpath` type) store an instance
  // with its own multi-arg `toJSON(properties, element, options)` instead of
  // a plain object — mirror `SimpleType.toJSON()`'s own handling rather than
  // letting a bare `JSON.stringify` call it with the wrong arguments (it
  // reads `element.node`, which would be `undefined` otherwise).
  if (
    properties &&
    typeof (properties as { toJSON?: unknown }).toJSON === 'function'
  ) {
    properties = (
      properties as { toJSON: (p: unknown, owner: unknown) => unknown }
    ).toJSON(properties, dataType.owner);
  }
  if (
    properties &&
    (properties as { pattern?: unknown }).pattern instanceof RegExp
  ) {
    properties = {
      ...(properties as object),
      pattern: (properties as { pattern: RegExp }).pattern.source,
    };
  }
  return properties && Object.keys(properties as object).length
    ? properties
    : undefined;
}

function mapDataType(dataType: DataType, ctx: BuildContext) {
  let out: Record<string, unknown>;
  if (dataType instanceof SimpleType) {
    // Always inlined (see `mapTypeRef`) — `name` carries the builtin's own
    // name (e.g. "string", "datetime") purely for display, since it's never
    // used as a lookup key here.
    out = {
      kind: dataType.kind,
      name: dataType.name,
      properties: mapSimpleTypeProperties(dataType),
    };
  } else if (isFieldsBearing(dataType)) {
    out = { kind: dataType.kind, ...mapObjectLike(dataType, ctx) };
  } else if (dataType instanceof EnumType) {
    out = { kind: dataType.kind, ...mapEnumType(dataType) };
  } else if (dataType instanceof ArrayType) {
    out = {
      kind: dataType.kind,
      type: dataType.type ? mapTypeRef(dataType.type, ctx) : undefined,
    };
  } else if (dataType instanceof UnionType) {
    out = {
      kind: dataType.kind,
      discriminator: dataType.discriminator,
      types: dataType.types.map(t => mapTypeRef(t, ctx)),
    };
  } else {
    out = { kind: dataType.kind };
  }
  out.description = dataType.description;
  return omitUndefined(out);
}

/**
 * Reference-or-inline: a named DataType becomes a plain name string
 * resolved against the document's top-level `types` map (registering it,
 * once, on first reference); an anonymous DataType is inlined directly.
 */
function mapTypeRef(dataType: DataType, ctx: BuildContext): unknown {
  // Always inlined, even named/builtin ones (`string`, `datetime`, ...): the
  // same conceptual builtin can reach here through more than one DataType
  // object instance (repeated `node.getDataType('string')`-style lookups
  // aren't guaranteed to return the same object), which would otherwise
  // collide against this context's collision-safe name registry and mint
  // spurious "string2"-style duplicates. `mapDataType()` still carries the
  // real name (see above) so the client can display it.
  if (dataType instanceof SimpleType) return mapDataType(dataType, ctx);
  const name = ctx.getTypeName(dataType);
  if (!name) return mapDataType(dataType, ctx);
  if (!ctx.hasType(name)) {
    ctx.types[name] = {};
    ctx.types[name] = mapDataType(dataType, ctx);
  }
  return name;
}

function mapHttpParameter(p: HttpParameter, ctx: BuildContext) {
  return omitUndefined({
    name: typeof p.name === 'string' ? p.name : String(p.name),
    location: p.location,
    type: p.type ? mapTypeRef(p.type, ctx) : undefined,
    description: p.description,
    required: p.required || undefined,
    deprecated: p.deprecated || undefined,
    default: p.default,
    keyParam: p.keyParam || undefined,
    arraySeparator: p.arraySeparator,
  });
}

function mapHttpMediaType(m: HttpMediaType, ctx: BuildContext) {
  return omitUndefined({
    contentType: Array.isArray(m.contentType)
      ? m.contentType.join(', ')
      : m.contentType,
    contentEncoding: m.contentEncoding,
    type: m.type ? mapTypeRef(m.type, ctx) : undefined,
    description: m.description,
    example: m.example,
  });
}

function mapHttpRequestBody(b: HttpRequestBody, ctx: BuildContext) {
  return omitUndefined({
    description: b.description,
    required: b.required || undefined,
    content: b.content.length
      ? b.content.map(m => mapHttpMediaType(m, ctx))
      : undefined,
  });
}

function mapHttpResponse(r: HttpOperationResponse, ctx: BuildContext) {
  const statusCodes = r.statusCode.map(x => x.toJSON());
  return omitUndefined({
    statusCode: statusCodes.length === 1 ? statusCodes[0] : statusCodes,
    description: r.description,
    type: r.type ? mapTypeRef(r.type, ctx) : undefined,
    partial: r.partial,
  });
}

function mapHttpOperation(op: HttpOperation, ctx: BuildContext) {
  return omitUndefined({
    kind: 'HttpOperation',
    method: op.method,
    description: op.description,
    path: op.path,
    mergePath: op.mergePath || undefined,
    composition: op.composition,
    parameters: op.parameters.length
      ? op.parameters.map(p => mapHttpParameter(p, ctx))
      : undefined,
    requestBody: op.requestBody
      ? mapHttpRequestBody(op.requestBody, ctx)
      : undefined,
    responses: op.responses.length
      ? op.responses.map(r => mapHttpResponse(r, ctx))
      : undefined,
  });
}

function mapHttpController(ctrl: HttpController, ctx: BuildContext) {
  const out: Record<string, unknown> = {
    kind: 'HttpController',
    description: ctrl.description,
    path: ctrl.path,
  };
  if (ctrl.operations.size) {
    const operations: Record<string, unknown> = {};
    for (const op of ctrl.operations.values()) {
      operations[op.name] = mapHttpOperation(op, ctx);
    }
    out.operations = operations;
  }
  if (ctrl.controllers.size) {
    const controllers: Record<string, unknown> = {};
    for (const sub of ctrl.controllers.values()) {
      controllers[sub.name] = mapHttpController(sub, ctx);
    }
    out.controllers = controllers;
  }
  return omitUndefined(out);
}
