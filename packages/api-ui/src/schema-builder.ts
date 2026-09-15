import { omitUndefined } from '@jsopen/objects';
import {
  type ApiDocument,
  type ApiField,
  applyTranslations,
  ArrayType,
  BUILTIN,
  ComplexType,
  DataType,
  type DocumentElement,
  EnumType,
  type HttpApi,
  type HttpController,
  type HttpMediaType,
  type HttpMultipartField,
  type HttpOperation,
  type HttpOperationResponse,
  type HttpParameter,
  type HttpRequestBody,
  MappedType,
  MixinType,
  SimpleType,
  type TranslatableField,
  UnionType,
} from '@opra/common';

/** Whether `dataType` belongs to OPRA's own shared built-in types document
 * (`string`, `number`, `datetime`, ...) rather than the application's own
 * document — see the identity-instability note in `mapTypeRef`. */
function isBuiltin(dataType: DataType): boolean {
  return !!(dataType.node.getDocument() as unknown as Record<symbol, unknown>)[
    BUILTIN
  ];
}

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
    /** Language documentation texts are resolved in, same rules as
     *  `ApiDocument#export({ lang })`. */
    lang?: string;
    /** Annotates every node carrying documentation prose with the bundle key
     *  that prose is read from (`_docKey`) and which of its fields are
     *  translatable (`_docFields`), so `oprimp docs:studio` can write an edit
     *  back to the right place. Adds nothing to the payload when off, which
     *  is every normal page. */
    authoring?: boolean;
  }

  export function build(document: ApiDocument, options?: Options): object {
    const ctx = new BuildContext(
      document,
      options?.scope,
      options?.lang,
      options?.authoring,
    );
    const out: Record<string, unknown> = {
      spec: '1.0',
      id: document.id,
      // Same resolution `ApiDocument#export()` performs for `info` — this
      // builder walks the runtime model rather than the exported schema, so
      // it has to ask for it explicitly.
      info: document.exportInfo({ lang: ctx.lang }),
    };
    // `info` is the one place translation doesn't go through
    // `applyTranslations` (see `ApiDocument#exportInfo`), so its key is
    // stamped by hand rather than by `ctx.translate`.
    if (ctx.authoring) {
      const info = out.info as Record<string, unknown>;
      info._docKey = ['info'];
      info._docFields = ['title', 'description', 'termsOfService'];
      if (info.license) {
        const license = info.license as Record<string, unknown>;
        license._docKey = ['info', 'license'];
        license._docFields = ['content'];
      }
    }

    const api = document.api as HttpApi | undefined;
    if (api && (api as { transport?: string }).transport === 'http') {
      const controllers: Record<string, unknown> = {};
      for (const ctrl of api.controllers.values()) {
        controllers[ctrl.name] = mapHttpController(ctrl, ctx);
      }
      out.api = omitUndefined({
        transport: 'http',
        url: api.url,
        servers: mapPlainList(api, api.servers, 'servers', s => s.url, ctx),
        sections: mapPlainList(api, api.sections, 'sections', s => s.name, ctx),
        controllers,
      });
    }

    // Registers every type the document declares (`document.types` — what
    // was actually passed via `types: [...]` at construction), in addition
    // to whatever the controller/operation walk above already reached
    // incidentally as some field's/parameter's type. `ctx.types` ends up
    // holding both, since a field referencing an undeclared type still
    // needs a real page to link/expand to — but `declaredTypes` tracks
    // only the former, so the client's sidebar "Models" list reflects the
    // document's own declared type list rather than everything transitively
    // reachable through it.
    const declaredTypes: string[] = [];
    for (const dataType of document.types.values()) {
      if (!(dataType.name && dataType.inScope(ctx.scope))) continue;
      const name = mapTypeRef(dataType, ctx);
      if (typeof name === 'string') declaredTypes.push(name);
    }
    if (Object.keys(ctx.types).length) out.types = ctx.types;
    if (declaredTypes.length) out.declaredTypes = declaredTypes;

    return omitUndefined(out);
  }
}

/** Threaded through every mapper call: the scope filter, and the map of
 * already-registered named types (reserved before recursing, so a type
 * that transitively references itself doesn't recurse forever). */
class BuildContext {
  readonly document: ApiDocument;
  readonly scope?: string;
  readonly lang?: string;
  readonly authoring?: boolean;
  readonly types: Record<string, unknown> = {};
  private readonly _names = new Map<DataType, string>();
  private readonly _namesInUse = new Set<string>();

  constructor(
    document: ApiDocument,
    scope?: string,
    lang?: string,
    authoring?: boolean,
  ) {
    this.document = document;
    this.scope = scope;
    this.lang = lang;
    this.authoring = authoring;
  }

  /**
   * Resolves `element`'s prose into `out` and, in authoring mode, records
   * *where that prose lives* so the studio can write an edit back.
   *
   * Every mapper goes through this rather than calling `applyTranslations`
   * directly: the documentation key is `docKeySegments` plus whatever extra
   * segments the lookup used, so deriving it anywhere other than the line
   * that performs the lookup is how the two drift apart. `docKey` itself is
   * never exported (it is authoring-only), and the shipped tree's own shape
   * doesn't mirror the bundle's — types are flattened into one top-level
   * map, an operation's parameters are merged down from its ancestors,
   * responses become an array — so there is no way to recover the key from
   * the emitted JSON afterwards.
   *
   * Outside authoring mode this adds nothing at all to the payload.
   */
  translate<T extends Record<string, any>>(
    element: DocumentElement,
    out: T,
    fields: TranslatableField[],
    extraSegments?: string[],
    extraUnstable?: boolean,
  ): T {
    applyTranslations(
      element,
      out,
      { lang: this.lang },
      fields,
      extraSegments,
      extraUnstable,
    );
    if (this.authoring) {
      const segments = extraSegments
        ? element.docKeySegments.concat(extraSegments)
        : element.docKeySegments;
      const target = out as Record<string, unknown>;
      target._docKey = segments;
      // The same rule `collectKeys` applies when it builds a skeleton: a
      // bundle may reword an existing `deprecated` reason but never invent
      // one, so a node that isn't deprecated has no slot to offer — listing
      // one would send the studio hunting for text that can never exist.
      target._docFields = fields.filter(
        field => field !== 'deprecated' || typeof out.deprecated === 'string',
      );
      if (extraUnstable || element.docKeyUnstable)
        target._docKeyUnstable = true;
      // A key is only meaningful against the bundle of the document that
      // *declares* the element (see `findTexts`), and a reference document
      // brings its own translation store. The root page embeds those nodes —
      // a type imported from `cm:` gets a page here like any other — so they
      // have to be marked, or the studio would write their text into the root
      // document's bundle where nothing will ever read it.
      if (!this.owns(element)) target._docForeign = true;
    }
    return out;
  }

  /** Whether `element` belongs to the document being built, rather than one
   *  of its references. Detached elements (an anonymous type built outside
   *  any document) have nothing to look up either way. */
  private owns(element: DocumentElement): boolean {
    try {
      return element.node.getDocument() === this.document;
    } catch {
      return false;
    }
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

/**
 * `servers`/`sections` are plain objects rather than document elements, so
 * their texts hang off the api's own key plus one container level — the same
 * keying `HttpApi#exportPlainList()` uses for `export()`. Doing it here too
 * is what keeps a server's or section's description translated in the page
 * (it was previously passed through raw, so it stayed in the source language
 * no matter what `?lang=` asked for) and keeps `docKey` — an authoring aid,
 * never part of what is published — out of the shipped tree.
 */
function mapPlainList<T extends { description?: string; docKey?: string }>(
  api: HttpApi,
  items: T[] | undefined,
  container: string,
  keyOf: (item: T) => string | undefined,
  ctx: BuildContext,
): T[] | undefined {
  if (!items?.length) return undefined;
  return items.map((item, i) => {
    const { docKey, ...rest } = item;
    return ctx.translate(
      api,
      rest as T,
      ['description'],
      [container, docKey || keyOf(item) || String(i)],
      // A server's `url` is environment-dependent, so keying documentation
      // by it is fragile unless a `docKey` says otherwise; a section's `name`
      // is a real identifier.
      container === 'servers' && !docKey,
    );
  });
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

function mapField(
  field: ApiField,
  ctx: BuildContext,
  owner: ComplexType | MappedType | MixinType,
) {
  // Applies any `.Override(scopePattern, ...)` for this scope (e.g.
  // `readonly: false` in "db") before reading the field's own properties
  // below — a no-op (returns `field` itself) when nothing overrides it
  // for this scope. `field.origin` (used for `from` below) is unaffected
  // either way — an override never changes which type actually declared
  // the field.
  field = field.forScope(ctx.scope);
  return ctx.translate(
    field,
    omitUndefined({
      type: mapTypeRef(field.type, ctx),
      description: field.description,
      required: field.required || undefined,
      deprecated: field.deprecated || undefined,
      readonly: field.readonly || undefined,
      writeonly: field.writeonly || undefined,
      exclusive: field.exclusive || undefined,
      localization: field.localization || undefined,
      examples: field.examples || undefined,
      // Set only when the field is inherited (via `extends` or a mixin) rather
      // than declared directly on `owner` — the client shows a small link
      // icon next to it, pointing back at whichever type actually declared it.
      from:
        field.origin && field.origin !== owner
          ? mapTypeRef(field.origin, ctx)
          : undefined,
    }),
    ['description', 'deprecated'],
  );
}

/**
 * Describes how a ComplexType/MappedType/MixinType is composed, purely for
 * display (e.g. "Extends Record" / "Mixin of (Record, Person)") — the
 * `fields` list is already fully flattened regardless, so nothing here is
 * needed to *read* the type, only to explain its shape.
 */
function mapInherits(
  dataType: ComplexType | MappedType | MixinType,
  ctx: BuildContext,
) {
  if (dataType instanceof MixinType) {
    return {
      kind: 'mixin',
      types: dataType.types.map(t => mapTypeRef(t, ctx)),
    };
  }
  if (dataType instanceof MappedType) {
    return { kind: 'mapped', types: [mapTypeRef(dataType.base, ctx)] };
  }
  const base = dataType.base;
  if (!base) return undefined;
  if (base instanceof MixinType) {
    return { kind: 'mixin', types: base.types.map(t => mapTypeRef(t, ctx)) };
  }
  // A ComplexType whose base is itself a MappedType — e.g. `class X
  // extends OmitType(Y, [...]) {}`, OPRA's pattern for a *named* mapped
  // type — is shown as "Mapped from Y" directly, skipping the anonymous
  // intermediate MappedType the framework inserts as `base` (otherwise
  // this would misleadingly read as "Extends" an unnamed/"embedded" type).
  if (base instanceof MappedType) {
    let root: ComplexType | MappedType | MixinType = base.base;
    while (root instanceof MappedType) root = root.base;
    return { kind: 'mapped', types: [mapTypeRef(root, ctx)] };
  }
  return { kind: 'extends', types: [mapTypeRef(base, ctx)] };
}

function mapObjectLike(
  dataType: ComplexType | MappedType | MixinType,
  ctx: BuildContext,
) {
  const fields: Record<string, unknown> = {};
  for (const field of dataType.fields('*')) {
    if (!field.inScope(ctx.scope)) continue;
    fields[field.name] = mapField(field, ctx, dataType);
  }
  return omitUndefined({
    fields: Object.keys(fields).length ? fields : undefined,
    inherits: mapInherits(dataType, ctx),
  });
}

function mapEnumType(dataType: EnumType, ctx: BuildContext) {
  // `attributes` is already merged with every base EnumType's own values —
  // no separate base-walk needed. `alias` (the enum member's source name,
  // used by tooling like the CLI importer) is machine-only and not shipped.
  const values: Record<string, unknown> = {};
  for (const [key, meta] of Object.entries(dataType.attributes)) {
    values[key] = ctx.translate(
      dataType,
      meta?.description ? { description: meta.description } : {},
      ['description'],
      ['values', key],
    );
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

/** A description for each of `properties`' own keys, where the type (or
 * one of its bases — `SimpleType.attributes` is already merged down the
 * base chain at construction time, same as `EnumType.attributes`) has
 * one declared via `@SimpleType.Attribute({ description: ... })` — e.g.
 * `StringType`'s own `pattern`/`minLength`/`maxLength`. Most of a custom
 * SimpleType's constraints are inherited from a builtin this way, so
 * this is rarely empty even for a type that declares no attributes of
 * its own. */
/** Which type in the base chain actually declares `key` — `attributes` is
 *  merged down from every base at construction, but the description is keyed
 *  under the type that *declared* it (`SimpleType#toJSON` reads
 *  `ownAttributes`), so translating against the wrong one silently finds
 *  nothing. */
function declaringTypeOfAttribute(
  dataType: SimpleType,
  key: string,
): SimpleType | undefined {
  let t: SimpleType | undefined = dataType;
  while (t) {
    if (t.ownAttributes?.[key]) return t;
    t = t.base;
  }
  return undefined;
}

function mapSimpleTypePropertyDescriptions(
  dataType: SimpleType,
  properties: unknown,
  ctx: BuildContext,
): Record<string, string> | undefined {
  if (!properties || typeof properties !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    // A class field declared without an initializer (e.g. `StringType`'s
    // `pattern?: string | RegExp;`) is still its own enumerable property
    // on the instance, just `undefined` — `Object.keys` alone can't tell
    // "declared but not set" apart from "actually set", so this would
    // otherwise attach a description to every constraint the *type*
    // supports rather than just the ones this particular instance uses
    // (which is all that ends up in the embedded `properties` object —
    // `JSON.stringify` drops `undefined` values, so keeping them here
    // would silently create description entries with no matching value).
    if (value === undefined) continue;
    const description = dataType.attributes?.[key]?.description;
    if (!description) continue;
    const declaring = declaringTypeOfAttribute(dataType, key);
    // `applyTranslations` rather than `ctx.translate`: this map is
    // `key -> string`, with nowhere to hang a `_docKey`, so these stay
    // read-only in the studio. In practice they are almost always inherited
    // from an OPRA builtin, which no application's bundle can reach anyway.
    out[key] = declaring
      ? applyTranslations(
          declaring,
          { description },
          { lang: ctx.lang },
          ['description'],
          ['attributes', key],
        ).description!
      : description;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A field/parameter that customizes a builtin with its own constraint
 * values (e.g. `new FieldPathType({ dataType: 'cm:Customer', allowSigns:
 * 'each' })`, passed as a parameter's `type`, or a field's own inline
 * `{ pattern: ... }`) gets its own anonymous SimpleType instance for that
 * specific usage — `dataType.name` is empty even though it's really "a
 * `string`/`fieldpath`, configured this way". Walking `.base` finds the
 * nearest ancestor that *does* have a name, so the client shows that
 * (e.g. "fieldpath") instead of falling all the way back to the bare,
 * uninformative "SimpleType" kind label. The same anonymous instance's
 * own `.description` and `.examples` are empty too (only the shared named
 * type it customizes actually carries the ones from `@SimpleType({
 * description: ... }).Example(...)`) — the caller falls back to this same
 * ancestor for those for the same reason. This is what keeps a field's
 * *own* examples (`ApiField.examples`, shown separately under the field
 * itself) from being the only thing anyone ever sees where a type's own
 * examples belong — without this fallback, a customized type's chip
 * tooltip has no examples of its own at all. */
function nearestNamedSimpleType(dataType: SimpleType): SimpleType | undefined {
  let t: SimpleType | undefined = dataType;
  while (t && !t.name) t = t.base;
  return t;
}

function mapDataType(dataType: DataType, ctx: BuildContext) {
  let out: Record<string, unknown>;
  if (dataType instanceof SimpleType) {
    // Always inlined (see `mapTypeRef`) — `name` carries the builtin's own
    // name (e.g. "string", "datetime") purely for display, since it's never
    // used as a lookup key here.
    const properties = mapSimpleTypeProperties(dataType);
    const namedBase = dataType.name
      ? undefined
      : nearestNamedSimpleType(dataType);
    out = {
      kind: dataType.kind,
      name: dataType.name || namedBase?.name,
      description: dataType.description || namedBase?.description,
      examples: dataType.examples || namedBase?.examples,
      properties,
      propertyDescriptions: mapSimpleTypePropertyDescriptions(
        dataType,
        properties,
        ctx,
      ),
    };
  } else if (isFieldsBearing(dataType)) {
    out = { kind: dataType.kind, ...mapObjectLike(dataType, ctx) };
  } else if (dataType instanceof EnumType) {
    out = { kind: dataType.kind, ...mapEnumType(dataType, ctx) };
  } else if (dataType instanceof ArrayType) {
    out = {
      kind: dataType.kind,
      type: dataType.type ? mapTypeRef(dataType.type, ctx) : undefined,
      minOccurs: dataType.minOccurs,
      maxOccurs: dataType.maxOccurs,
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
  // The SimpleType branch above seeds `description`/`examples` from its
  // nearest named base when the instance is anonymous; every other kind just
  // takes its own. Either way the lookup happens here, once, so the key is
  // stamped on the node the client actually renders.
  if (out.description === undefined) out.description = dataType.description;
  if (out.examples === undefined) out.examples = dataType.examples;
  ctx.translate(dataType, out, ['description']);
  // Only an example's `description` is prose — its `value` is data and is
  // copied through untouched, exactly as `DataType#toJSON` treats it.
  if (Array.isArray(out.examples)) {
    out.examples = (out.examples as Record<string, any>[]).map((ex, i) =>
      ctx.translate(
        dataType,
        { ...ex },
        ['description'],
        ['examples', ex.docKey || String(i)],
      ),
    );
  }
  // `dataType.name` here is the instance's *own* name — checked before any
  // SimpleType base-fallback above overwrote `out.name` with a borrowed
  // one. Anonymous either way: an embedded ComplexType/Mixin/Mapped type
  // declared with no name of its own, or a SimpleType customized inline
  // for one specific field/parameter (e.g. a `string` with its own
  // `pattern`) — the client uses this to mark the chip/tooltip as "not a
  // standalone type with its own page", regardless of which borrowed name
  // it ends up displaying.
  if (!dataType.name) out.anonymous = true;
  return omitUndefined(out);
}

/**
 * Reference-or-inline: a named DataType becomes a plain name string
 * resolved against the document's top-level `types` map (registering it,
 * once, on first reference); an anonymous DataType is inlined directly.
 */
function mapTypeRef(dataType: DataType, ctx: BuildContext): unknown {
  // A framework builtin (`string`, `datetime`, ...) is always inlined: the
  // same conceptual builtin can reach here through more than one DataType
  // object instance (repeated `node.getDataType('string')`-style lookups
  // aren't guaranteed to return the same object), which would otherwise
  // collide against this context's collision-safe name registry and mint
  // spurious "string2"-style duplicates. `mapDataType()` still carries the
  // real name (see above) so the client can display it. A *custom* named
  // SimpleType — the user's own `class X extends StringType {}` — doesn't
  // have that instability (it's a single, stable class reference) and gets
  // a real page like any other named type.
  if (dataType instanceof SimpleType && (!dataType.name || isBuiltin(dataType)))
    return mapDataType(dataType, ctx);
  const name = ctx.getTypeName(dataType);
  if (!name) return mapDataType(dataType, ctx);
  if (!ctx.hasType(name)) {
    ctx.types[name] = {};
    ctx.types[name] = mapDataType(dataType, ctx);
  }
  return name;
}

function mapHttpParameter(p: HttpParameter, ctx: BuildContext) {
  return ctx.translate(
    p,
    omitUndefined({
      name: typeof p.name === 'string' ? p.name : String(p.name),
      location: p.location,
      type: p.type ? mapTypeRef(p.type, ctx) : undefined,
      description: p.description,
      required: p.required || undefined,
      deprecated: p.deprecated || undefined,
      default: p.default,
      keyParam: p.keyParam || undefined,
      arraySeparator: p.arraySeparator,
    }),
    ['description', 'deprecated'],
  );
}

/**
 * @param ownsDescription - False when the enclosing request body keys this
 *   media type's description to the very same bundle entry as its own (see
 *   `mapHttpRequestBody`), in which case the body renders it and this is
 *   left blank rather than repeating the sentence.
 */
function mapHttpMediaType(
  m: HttpMediaType,
  ctx: BuildContext,
  ownsDescription = true,
) {
  const out = omitUndefined({
    contentType: Array.isArray(m.contentType)
      ? m.contentType.join(', ')
      : m.contentType,
    contentEncoding: m.contentEncoding,
    type: m.type ? mapTypeRef(m.type, ctx) : undefined,
    description: ownsDescription ? m.description : undefined,
    example: m.example,
    examples: m.examples,
    multipartFields: m.multipartFields?.length
      ? m.multipartFields.map(f => mapHttpMultipartField(f, ctx))
      : undefined,
    maxParts: m.maxParts,
    maxPartSize: m.maxPartSize,
    maxFieldSize: m.maxFieldSize,
    maxTotalSize: m.maxTotalSize,
  });
  return ownsDescription ? ctx.translate(m, out, ['description']) : out;
}

/** One entry of a `multipart/form-data` body — itself a full `HttpMediaType`
 * (own `contentType`/`type`/`example`/...), plus the field name (or
 * pattern) it binds to within the multipart stream and whether that part
 * is a plain form `field` or an uploaded `file`. */
function mapHttpMultipartField(f: HttpMultipartField, ctx: BuildContext) {
  return omitUndefined({
    ...mapHttpMediaType(f, ctx),
    fieldName: f.fieldName instanceof RegExp ? f.fieldName.source : f.fieldName,
    fieldType: f.fieldType,
    required: f.required || undefined,
  });
}

function mapHttpRequestBody(b: HttpRequestBody, ctx: BuildContext) {
  /* A body declaring exactly one content lets that media type share the
   * body's own documentation key, so it adds no level to the bundle for the
   * common case (see `HttpMediaType#docKeySegment`). The two both carry a
   * `description`, though, so they then resolve the *same* bundle entry —
   * printing one sentence twice on the page, and offering the studio two
   * places to write a single text where the second save would quietly
   * overwrite the first. The body owns it. */
  const bodyKey = b.docKeySegments.join(' ');
  return ctx.translate(
    b,
    omitUndefined({
      description: b.description,
      required: b.required || undefined,
      content: b.content.length
        ? b.content.map(m =>
            mapHttpMediaType(m, ctx, m.docKeySegments.join(' ') !== bodyKey),
          )
        : undefined,
    }),
    ['description'],
  );
}

function mapHttpResponse(r: HttpOperationResponse, ctx: BuildContext) {
  const statusCodes = r.statusCode.map(x => x.toJSON());
  return ctx.translate(
    r,
    omitUndefined({
      statusCode: statusCodes.length === 1 ? statusCodes[0] : statusCodes,
      description: r.description,
      type: r.type ? mapTypeRef(r.type, ctx) : undefined,
      partial: r.partial,
    }),
    ['description'],
  );
}

/** `inheritedParams` are the path/header/... parameters declared on this
 * operation's own controller *and* every ancestor controller above it
 * (e.g. a `.KeyParam('customerId', ...)` declared once on `CustomerController`
 * applies to every operation nested under it, including two levels down
 * under `Notes`) — merged ahead of the operation's own parameters so a
 * single "Parameters" table on the operation's page is the complete,
 * effective set a caller must supply, without needing to check every
 * parent controller's own page too. */
function mapHttpOperation(
  op: HttpOperation,
  ctx: BuildContext,
  inheritedParams: readonly HttpParameter[],
) {
  const allParams = inheritedParams.length
    ? [...inheritedParams, ...op.parameters]
    : op.parameters;
  return omitUndefined({
    kind: 'HttpOperation',
    method: op.method,
    ...ctx.translate(op, { title: op.title, description: op.description }, [
      'title',
      'description',
    ]),
    sections: op.sections?.length ? op.sections : undefined,
    path: op.path,
    mergePath: op.mergePath || undefined,
    composition: op.composition,
    parameters: allParams.length
      ? allParams.map(p => mapHttpParameter(p, ctx))
      : undefined,
    requestBody: op.requestBody
      ? mapHttpRequestBody(op.requestBody, ctx)
      : undefined,
    responses: op.responses.length
      ? op.responses.map(r => mapHttpResponse(r, ctx))
      : undefined,
  });
}

function mapHttpController(
  ctrl: HttpController,
  ctx: BuildContext,
  inheritedParams: readonly HttpParameter[] = [],
) {
  // Own parameters only (not `inheritedParams`) — a controller's page
  // documents what *it* adds to the path; the merged, effective set is
  // shown on each operation's own page instead (see `mapHttpOperation`).
  const out: Record<string, unknown> = ctx.translate(
    ctrl,
    {
      kind: 'HttpController',
      description: ctrl.description,
      path: ctrl.path,
      parameters: ctrl.parameters.length
        ? ctrl.parameters.map(p => mapHttpParameter(p, ctx))
        : undefined,
    } as Record<string, unknown>,
    ['description'],
  );
  const allParams =
    inheritedParams.length || ctrl.parameters.length
      ? [...inheritedParams, ...ctrl.parameters]
      : inheritedParams;
  if (ctrl.operations.size) {
    const operations: Record<string, unknown> = {};
    for (const op of ctrl.operations.values()) {
      operations[op.name] = mapHttpOperation(op, ctx, allParams);
    }
    out.operations = operations;
  }
  if (ctrl.controllers.size) {
    const controllers: Record<string, unknown> = {};
    for (const sub of ctrl.controllers.values()) {
      controllers[sub.name] = mapHttpController(sub, ctx, allParams);
    }
    out.controllers = controllers;
  }
  return omitUndefined(out);
}
