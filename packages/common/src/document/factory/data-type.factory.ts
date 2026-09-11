import type { Combine, ThunkAsync, Type } from 'ts-gems';
import {
  cloneObject,
  resolveThunk,
  ResponsiveMap,
} from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import { DataTypeMap } from '../common/data-type-map.js';
import { DocumentElement } from '../common/document-element.js';
import { DocumentInitContext } from '../common/document-init-context.js';
import {
  DATATYPE_METADATA,
  DECODER,
  ENCODER,
  kCtorMap,
  kDataTypeMap,
} from '../constants.js';
import { ApiField } from '../data-type/api-field.js';
import { ArrayType } from '../data-type/array-type.js';
import { ComplexType } from '../data-type/complex-type.js';
import { ComplexTypeBase } from '../data-type/complex-type-base.js';
import { DataType } from '../data-type/data-type.js';
import { EnumType } from '../data-type/enum-type.js';
import { MappedType } from '../data-type/mapped-type.js';
import { MixinType } from '../data-type/mixin-type.js';
import { SimpleType } from '../data-type/simple-type.js';
import { UnionType } from '../data-type/union-type.js';

/**
 *
 * @namespace DataTypeFactory
 */
export namespace DataTypeFactory {
  export type DataTypeSources =
    | ThunkAsync<Type | EnumType.EnumObject | EnumType.EnumArray | object>[]
    | Record<string, OpraSchema.DataType>;

  export type DataTypeThunk =
    Type | EnumType.EnumObject | EnumType.EnumArray | object;

  export interface ArrayTypeInit extends Combine<
    {
      _instance?: ArrayType;
      type: (
        | string
        | SimpleTypeInit
        | ComplexTypeInit
        | MappedTypeInit
        | MixinTypeInit
        | UnionTypeInit
        | ArrayTypeInit
      )[];
    },
    ArrayType.InitArguments
  > {}

  export interface ComplexTypeInit extends Combine<
    {
      _instance?: ComplexType;
      base?: string | ComplexTypeInit | MappedTypeInit | MixinTypeInit;
      fields?: Record<string, ApiFieldInit>;
      additionalFields?:
        | boolean
        | string
        | DataTypeFactory.DataTypeInitArguments
        | ['error']
        | ['error', string];
    },
    ComplexType.InitArguments
  > {}

  export interface EnumTypeInit extends Combine<
    {
      _instance?: MappedType;
      base?: string | EnumTypeInit;
    },
    EnumType.InitArguments
  > {}

  export interface MappedTypeInit extends Combine<
    {
      _instance?: MappedType;
      base: string | ComplexTypeInit | MappedTypeInit | MixinTypeInit;
    },
    MappedType.InitArguments
  > {}

  export interface MixinTypeInit extends Combine<
    {
      _instance?: MixinType;
      types: (string | ComplexTypeInit | MappedTypeInit | MixinTypeInit)[];
    },
    MixinType.InitArguments
  > {}

  export interface SimpleTypeInit extends Combine<
    {
      _instance?: SimpleType;
      base?: string | SimpleTypeInit;
    },
    SimpleType.InitArguments
  > {}

  export interface UnionTypeInit extends Combine<
    {
      _instance?: MixinType;
      types: (string | ComplexTypeInit | MappedTypeInit | MixinTypeInit)[];
    },
    UnionType.InitArguments
  > {}

  export interface ApiFieldInit extends Combine<
    {
      type: string | DataTypeInitArguments;
    },
    ApiField.InitArguments
  > {}

  export type DataTypeInitArguments =
    | ComplexTypeInit
    | EnumTypeInit
    | MappedTypeInit
    | MixinTypeInit
    | SimpleTypeInit
    | UnionTypeInit
    | ArrayTypeInit;

  export interface Context extends DocumentInitContext {
    importQueue?: ResponsiveMap<any>;
    initArgsMap?: ResponsiveMap<DataTypeInitArguments>;
  }
}

const initializingSymbol = Symbol('initializing');

/**
 *
 * @class DataTypeFactory
 */
export class DataTypeFactory {
  static async createDataType(
    context: DocumentInitContext | undefined,
    owner: DocumentElement,
    thunk: DataTypeFactory.DataTypeThunk,
  ): Promise<DataType | undefined> {
    context = context || new DocumentInitContext({ maxErrors: 0 });
    const initArgs = await this._importDataTypeArgs(context, owner, thunk);
    if (initArgs) {
      if (typeof initArgs === 'string') return owner.node.getDataType(initArgs);
      return this._createDataType(context, owner, initArgs);
    }
  }

  static async resolveDataType(
    context: DocumentInitContext | undefined,
    owner: DocumentElement,
    v: any,
  ): Promise<DataType> {
    if (v) {
      const dt = owner.node.findDataType(v);
      if (dt) return dt;
    }
    if (typeof v === 'object' || typeof v === 'function') {
      const dt = await DataTypeFactory.createDataType(context, owner, v);
      if (dt) return dt;
    }
    if (v) {
      /* To throw not found error */
      const dt = owner.node.getDataType(v);
      /* istanbul ignore next */
      if (dt) return dt;
    }
    return owner.node.getDataType('any');
  }

  /**
   *
   * @param context
   * @param target
   * @param types
   */
  static async addDataTypes(
    context: DocumentInitContext | undefined,
    target: DocumentElement,
    types: DataTypeFactory.DataTypeSources,
  ) {
    const dataTypeMap = target.node[kDataTypeMap] as DataTypeMap;
    if (!dataTypeMap)
      throw new TypeError('DocumentElement should has [kDataTypeMap] property');
    const importedTypes = await this.createAllDataTypes(context, target, types);
    if (!importedTypes) return;
    for (const dataType of importedTypes) {
      if (dataType?.name) {
        dataTypeMap.set(dataType.name, dataType);
      }
    }
  }

  /**
   *
   * @param context
   * @param owner
   * @param types
   */
  static async createAllDataTypes(
    context: DocumentInitContext | undefined,
    owner: DocumentElement,
    types: DataTypeFactory.DataTypeSources,
  ): Promise<DataType[] | undefined> {
    context = context || new DocumentInitContext({ maxErrors: 0 });
    const initArgs = await this._prepareAllInitArgs(context, owner, types);
    if (!initArgs) return;
    const initArgsMap =
      new ResponsiveMap<DataTypeFactory.DataTypeInitArguments>();
    for (const initArg of initArgs) {
      initArgsMap.set(initArg.name!, initArg);
    }
    const ctx = context.extend({ initArgsMap });
    const out: DataType[] = [];
    for (const [name, initArg] of initArgsMap.entries()) {
      context.enter(`[${name}]`, () => {
        if (!initArgsMap.has(name)) return;
        const dataType = this._createDataType(ctx, owner, initArg);
        if (dataType) out.push(dataType);
      });
    }
    return out;
  }

  /**
   *
   * @param ctx
   * @param owner
   * @param types
   */
  protected static async _prepareAllInitArgs(
    ctx: DocumentInitContext,
    owner: DocumentElement,
    types: DataTypeFactory.DataTypeSources,
  ): Promise<DataTypeFactory.DataTypeInitArguments[] | void> {
    const importQueue = new ResponsiveMap<any>();
    const initArgsMap =
      new ResponsiveMap<DataTypeFactory.DataTypeInitArguments>();
    const context = ctx.extend({ owner, importQueue, initArgsMap });
    // istanbul ignore next
    if (!owner.node[kDataTypeMap])
      throw new TypeError('DocumentElement should has [kDataTypeMap] property');
    // Add type sources into typeQueue
    if (Array.isArray(types)) {
      let i = 0;
      for (let thunk of types) {
        await context.enterAsync(`$[${i++}]`, async () => {
          thunk = await resolveThunk(thunk);
          const metadata =
            Reflect.getMetadata(DATATYPE_METADATA, thunk) ||
            thunk[DATATYPE_METADATA];
          if (!(metadata && metadata.name)) {
            if (typeof thunk === 'function') {
              return context.addError(
                `Class "${thunk.name}" doesn't have a valid data type metadata`,
              );
            }
            return context.addError(
              `Object doesn't have a valid data type metadata`,
            );
          }
          importQueue.set(metadata.name, thunk);
        });
      }
    } else {
      let thunk: any;
      let name: string;
      for ([name, thunk] of Object.entries(types)) {
        thunk = await resolveThunk(thunk);
        importQueue.set(
          name,
          typeof thunk === 'object' ? { ...thunk, name } : thunk,
        );
      }
    }

    for (const name of Array.from(importQueue.keys())) {
      if (!importQueue.has(name)) continue;
      const dt = await this._importDataTypeArgs(context, owner, name);
      // istanbul ignore next
      if (dt && typeof dt !== 'string') {
        context.addError(
          `Embedded data type can't be loaded into document node directly`,
        );
      }
    }
    return Array.from(initArgsMap.values());
  }

  /**
   *
   * @param context
   * @param owner
   * @param thunk
   * @param checkCircularDeps
   * @protected
   */
  protected static async _importDataTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    thunk: string | Type | OpraSchema.DataType | object,
    checkCircularDeps?: boolean,
  ): Promise<DataTypeFactory.DataTypeInitArguments | string | void> {
    thunk = await resolveThunk(thunk);
    const { importQueue, initArgsMap } = context;

    // Check if data type already exist (maybe a builtin type or already imported)
    const dataType = owner.node.findDataType(thunk);
    if (dataType instanceof DataType) return dataType.name!;

    let metadata: any;
    let ctor: Type | undefined;
    let instance: object;

    if (typeof thunk !== 'string') {
      const _ctorTypeMap = owner.node.getDocument().types[kCtorMap];
      const name = _ctorTypeMap.get(thunk);
      if (name) thunk = name;
    }

    if (typeof thunk === 'string') {
      const name = thunk;
      thunk = importQueue?.get(name) || context.initArgsMap?.get(name);
      if (!thunk) return context.addError(`Unknown data type (${name})`);
    } else {
      //
    }

    if (typeof thunk === 'function') {
      // Check if class has metadata
      metadata = Reflect.getMetadata(DATATYPE_METADATA, thunk);
      if (!metadata)
        return context.addError(
          `Class "${thunk.name}" doesn't have a valid DataType metadata`,
        );
      ctor = thunk as Type;
    } else if (typeof thunk === 'object') {
      // It may be an enum object or enum array
      metadata = thunk[DATATYPE_METADATA];
      if (metadata) {
        instance = thunk;
        if (metadata.kind !== OpraSchema.EnumType.Kind) metadata = undefined;
      } else if (OpraSchema.isDataType(thunk)) {
        metadata = thunk;
        ctor = metadata.ctor;
      } else {
        // Or may be a DataType instance, e.g. an extended SimpleType object
        ctor = Object.getPrototypeOf(thunk).constructor;
        metadata = ctor && Reflect.getMetadata(DATATYPE_METADATA, ctor);
        if (metadata) {
          if (metadata.kind === OpraSchema.SimpleType.Kind) {
            // Prefer resolving by the instance's own registered name when
            // that name is already known here (a framework builtin like
            // `string`/`integer`, or a type this document separately
            // declares) — this reuses that type's full, already-built
            // definition (its own codec included) rather than a more
            // generic ancestor. An application-defined *named* subclass
            // that isn't itself declared under its own name (e.g. `new
            // CountryCode()` where `CountryCode` was never added to this
            // document's own `types`) can't be resolved that way — asking
            // it to be its own base just fails as "unknown"/"not
            // declared". Fall back to the real base class from the
            // prototype chain instead, exactly like a bare class reference
            // (`type: CountryCode`, no `new`) is already resolved above.
            const nameIsResolvable =
              !!metadata.name &&
              (!!owner.node.findDataType(metadata.name) ||
                !!importQueue?.get(metadata.name) ||
                !!initArgsMap?.get(metadata.name));
            const baseThunk = nameIsResolvable
              ? metadata.name
              : Object.getPrototypeOf(ctor!.prototype).constructor;
            const baseArgs = await this._importDataTypeArgs(
              context,
              owner,
              baseThunk,
            );
            if (!baseArgs) return;
            if (
              typeof baseArgs === 'object' &&
              baseArgs.kind !== OpraSchema.SimpleType.Kind
            ) {
              return context.addError('Kind of base data type is not same');
            }
            return {
              kind: OpraSchema.SimpleType.Kind,
              name: undefined,
              base: baseArgs as any,
              properties: thunk,
            } satisfies DataTypeFactory.SimpleTypeInit;
          }
        }
      }
    }
    if (!metadata) {
      return context.addError(`No DataType metadata found`);
    }

    return context.enterAsync(
      metadata.name ? `[${metadata.name}]` : '',
      async () => {
        /* Check for circular dependencies */
        if (metadata.name) {
          const curr = initArgsMap?.get(metadata.name);
          if (curr) {
            if (checkCircularDeps && curr[initializingSymbol])
              return context.addError('Circular reference detected');
            return metadata.name;
          }
        }

        const out = {
          kind: metadata.kind,
          name: metadata.name,
        } as DataTypeFactory.DataTypeInitArguments;
        /* Mark "out" object as initializing. This will help us to detect circular dependencies */
        out[initializingSymbol] = true;
        try {
          if (out.name) {
            if (importQueue?.has(out.name)) {
              initArgsMap?.set(metadata.name, out);
              out._instance = { name: metadata.name } as any;
              out[kDataTypeMap] = owner.node[kDataTypeMap];
            } else {
              return context.addError(
                `Data Type (${out.name}) must be explicitly added to type list in the document scope`,
              );
            }
          }

          switch (out.kind) {
            case OpraSchema.ArrayType.Kind:
              await this._prepareArrayTypeArgs(context, owner, out, metadata);
              break;
            case OpraSchema.ComplexType.Kind:
              out.ctor = ctor;
              await this._prepareComplexTypeArgs(context, owner, out, metadata);
              break;
            case OpraSchema.EnumType.Kind:
              out.instance = instance;
              await this._prepareEnumTypeArgs(context, owner, out, metadata);
              break;
            case OpraSchema.MappedType.Kind:
              await this._prepareMappedTypeArgs(context, owner, out, metadata);
              break;
            case OpraSchema.MixinType.Kind:
              await this._prepareMixinTypeArgs(context, owner, out, metadata);
              break;
            case OpraSchema.SimpleType.Kind:
              out.ctor = ctor;
              await this._prepareSimpleTypeArgs(context, owner, out, metadata);
              break;
            case OpraSchema.UnionType.Kind:
              await this._prepareUnionTypeArgs(context, owner, out, metadata);
              break;
            default:
              /* istanbul ignore next */
              return context.addError(
                `Invalid data type kind ${metadata.kind}`,
              );
          }
        } finally {
          if (out.name) importQueue?.delete(out.name);
          delete out[initializingSymbol];
        }
        return importQueue && out.name ? out.name : out;
      },
    );
  }

  protected static async _prepareDataTypeArgs(
    context: DataTypeFactory.Context,
    initArgs: DataTypeFactory.DataTypeInitArguments,
    metadata: OpraSchema.DataTypeBase | DataType.Metadata,
  ): Promise<void> {
    initArgs.description = metadata.description;
    initArgs.abstract = metadata.abstract;
    initArgs.examples = metadata.examples;
    initArgs.scopePattern = (metadata as DataType.Metadata).scopePattern;
  }

  protected static async _prepareArrayTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.ArrayTypeInit,
    metadata: (ArrayType.Metadata | OpraSchema.ArrayType) & { ctor?: Type },
  ): Promise<void> {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    await context.enterAsync('.type', async () => {
      const baseArgs = await this._importDataTypeArgs(
        context,
        owner,
        metadata.type as any,
      );
      if (!baseArgs) return;
      initArgs.type = preferName(baseArgs) as any;
    });
  }

  protected static async _prepareComplexTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.ComplexTypeInit,
    metadata: ComplexType.Metadata | OpraSchema.ComplexType,
  ): Promise<void> {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    initArgs.keyField = metadata.keyField;
    initArgs.discriminatorField = metadata.discriminatorField;
    initArgs.discriminatorValue = metadata.discriminatorValue;

    await context.enterAsync('.base', async () => {
      let baseArgs: any;
      if (metadata.base) {
        baseArgs = await this._importDataTypeArgs(
          context,
          owner,
          metadata.base!,
          true,
        );
      } else if (initArgs.ctor) {
        const baseClass = Object.getPrototypeOf(
          initArgs.ctor.prototype,
        ).constructor;
        if (Reflect.hasMetadata(DATATYPE_METADATA, baseClass)) {
          baseArgs = await this._importDataTypeArgs(context, owner, baseClass);
        }
      }
      if (!baseArgs) return;
      initArgs.base = preferName(baseArgs) as any;
      initArgs.ctor = initArgs.ctor || baseArgs.ctor;
    });

    // Initialize additionalFields
    if (metadata.additionalFields != null) {
      if (
        typeof metadata.additionalFields === 'boolean' ||
        Array.isArray(metadata.additionalFields)
      ) {
        initArgs.additionalFields = metadata.additionalFields;
      } else {
        await context.enterAsync('.additionalFields', async () => {
          const t = await this._importDataTypeArgs(
            context,
            owner,
            metadata.additionalFields as any,
          );
          if (t) initArgs.additionalFields = preferName(t);
        });
      }
    }

    if (metadata.fields) {
      initArgs.fields = {};
      await context.enterAsync('.fields', async () => {
        for (const [k, v] of Object.entries(metadata.fields!)) {
          await context.enterAsync(`[${k}]`, async () => {
            const fieldMeta = typeof v === 'string' ? { type: v } : v;
            if (fieldMeta.isArray && !fieldMeta.type) {
              return context.addError(
                `"type" must be defined explicitly for array fields`,
              );
            }
            const t = await this._importDataTypeArgs(
              context,
              owner,
              fieldMeta.type || 'any',
            );
            if (!t) return;
            initArgs.fields![k] = {
              ...fieldMeta,
              type: preferName(t),
            };
          });
        }
      });
    }
  }

  protected static async _prepareEnumTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.EnumTypeInit,
    metadata: EnumType.Metadata | OpraSchema.EnumType,
  ) {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    if (metadata.base) {
      await context.enterAsync('.base', async () => {
        const baseArgs = await this._importDataTypeArgs(
          context,
          owner,
          metadata.base!,
        );
        if (!baseArgs) return;
        initArgs.base = preferName(baseArgs) as any;
      });
    }
    initArgs.attributes = cloneObject(metadata.attributes);
  }

  protected static async _prepareSimpleTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.SimpleTypeInit,
    metadata: SimpleType.Metadata | OpraSchema.SimpleType,
  ): Promise<void> {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    await context.enterAsync('.base', async () => {
      let baseArgs: any;
      if (metadata.base) {
        baseArgs = await this._importDataTypeArgs(
          context,
          owner,
          metadata.base!,
          true,
        );
      } else if (initArgs.ctor) {
        const baseClass = Object.getPrototypeOf(
          initArgs.ctor.prototype,
        ).constructor;
        if (Reflect.hasMetadata(DATATYPE_METADATA, baseClass)) {
          baseArgs = await this._importDataTypeArgs(context, owner, baseClass);
        }
      }
      if (!baseArgs) return;
      initArgs.base = preferName(baseArgs) as any;
      initArgs.ctor = initArgs.ctor || baseArgs.ctor;
    });
    initArgs.properties = metadata.properties;
    initArgs.nameMappings = metadata.nameMappings;
    if (!initArgs.properties && initArgs.ctor)
      initArgs.properties = new initArgs.ctor();
    if (metadata.attributes)
      initArgs.attributes = cloneObject(metadata.attributes);
    if (typeof initArgs.properties?.[DECODER] === 'function') {
      initArgs.generateDecoder = initArgs.properties?.[DECODER].bind(
        initArgs.properties,
      );
    }
    if (typeof initArgs.properties?.[ENCODER] === 'function') {
      initArgs.generateEncoder = initArgs.properties?.[ENCODER].bind(
        initArgs.properties,
      );
    }
  }

  protected static async _prepareMappedTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.MappedTypeInit,
    metadata: DataTypeFactory.MappedTypeInit | OpraSchema.MappedType,
  ): Promise<void> {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    initArgs.discriminatorField = metadata.discriminatorField;
    initArgs.discriminatorValue = metadata.discriminatorValue;

    await context.enterAsync('.base', async () => {
      let baseArgs: any;
      if (metadata.base) {
        baseArgs = await this._importDataTypeArgs(
          context,
          owner,
          metadata.base!,
          true,
        );
      } else if (initArgs.ctor) {
        const baseClass = Object.getPrototypeOf(
          initArgs.ctor.prototype,
        ).constructor;
        if (Reflect.hasMetadata(DATATYPE_METADATA, baseClass)) {
          baseArgs = await this._importDataTypeArgs(context, owner, baseClass);
        }
      }
      if (!baseArgs) return;
      initArgs.base = preferName(baseArgs) as any;
      initArgs.ctor = initArgs.ctor || baseArgs.ctor;
    });

    if (metadata.pick) initArgs.pick = [...metadata.pick];
    else if (metadata.omit) initArgs.omit = [...metadata.omit];
    else if (metadata.partial) {
      initArgs.partial = Array.isArray(metadata.partial)
        ? [...metadata.partial]
        : metadata.partial;
    } else if (metadata.required) {
      initArgs.required = Array.isArray(metadata.required)
        ? [...metadata.required]
        : metadata.required;
    }
  }

  protected static async _prepareMixinTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.MixinTypeInit,
    metadata: (MixinType.Metadata | OpraSchema.MixinType) & { ctor?: Type },
  ): Promise<void> {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    initArgs.types = [];
    await context.enterAsync('.types', async () => {
      const _initTypes = metadata.types as any[];
      let i = 0;
      for (const t of _initTypes) {
        await context.enterAsync(`[${i++}]`, async () => {
          const baseArgs = await this._importDataTypeArgs(context, owner, t);
          if (!baseArgs) return;
          initArgs.types.push(preferName(baseArgs) as any);
        });
      }
    });
  }

  protected static async _prepareUnionTypeArgs(
    context: DataTypeFactory.Context,
    owner: DocumentElement,
    initArgs: DataTypeFactory.UnionTypeInit,
    metadata: (UnionType.Metadata | OpraSchema.UnionType) & { ctor?: Type },
  ): Promise<void> {
    await this._prepareDataTypeArgs(context, initArgs, metadata);
    initArgs.types = [];
    await context.enterAsync('.types', async () => {
      const _initTypes = metadata.types as any[];
      let i = 0;
      for (const t of _initTypes) {
        await context.enterAsync(`[${i++}]`, async () => {
          const baseArgs = await this._importDataTypeArgs(context, owner, t);
          if (!baseArgs) return;
          initArgs.types.push(preferName(baseArgs) as any);
        });
      }
    });
  }

  protected static _createDataType(
    context: DocumentInitContext & {
      initArgsMap?: ResponsiveMap<DataTypeFactory.DataTypeInitArguments>;
    },
    owner: DocumentElement,
    args: DataTypeFactory.DataTypeInitArguments | string,
  ):
    | ArrayType
    | ComplexType
    | EnumType
    | MappedType
    | MixinType
    | SimpleType
    | UnionType
    | undefined {
    let dataType = owner.node.findDataType(
      typeof args === 'string' ? args : args.name || '',
    );
    if (dataType instanceof DataType) return dataType as any;
    const initArgs =
      typeof args === 'string' ? context.initArgsMap?.get(args) : args;
    if (initArgs) {
      const dataTypeMap: DataTypeMap | undefined = initArgs[kDataTypeMap];
      if (!dataTypeMap) delete initArgs._instance;
      dataType = initArgs._instance;
      if (dataType?.name && dataTypeMap) {
        dataTypeMap.set(dataType.name, dataType);
      }

      switch (initArgs?.kind) {
        case OpraSchema.ArrayType.Kind:
          return this._createArrayType(context, owner, initArgs);
        case OpraSchema.ComplexType.Kind:
          return this._createComplexType(context, owner, initArgs);
        case OpraSchema.EnumType.Kind:
          return this._createEnumType(context, owner, initArgs);
        case OpraSchema.MappedType.Kind:
          return this._createMappedType(context, owner, initArgs);
        case OpraSchema.MixinType.Kind:
          return this._createMixinType(context, owner, initArgs);
        case OpraSchema.SimpleType.Kind:
          return this._createSimpleType(context, owner, initArgs);
        case OpraSchema.UnionType.Kind:
          return this._createUnionType(context, owner, initArgs);
        default:
          break;
      }
    }
    context.addError(`Unknown data type (${String(args)})`);
  }

  protected static _createArrayType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.ArrayTypeInit,
  ): ArrayType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, ArrayType.prototype);

    const initArgs = cloneObject(args) as unknown as ArrayType.InitArguments;
    if (args.type) {
      context.enter('.type', () => {
        initArgs.type = this._createDataType(context, owner, args.type as any)!;
      });
    }
    ArrayType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }

  protected static _createComplexType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.ComplexTypeInit,
  ): ComplexType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, ComplexType.prototype);

    const initArgs = cloneObject(args) as ComplexType.InitArguments;
    if (args.base) {
      context.enter('.base', () => {
        initArgs.base = this._createDataType(context, owner, args.base!) as any;
      });
    }
    /* Set additionalFields */
    if (args.additionalFields) {
      context.enter('.additionalFields', () => {
        if (
          typeof args.additionalFields === 'boolean' ||
          Array.isArray(args.additionalFields)
        ) {
          initArgs.additionalFields = args.additionalFields;
        } else {
          initArgs.additionalFields = this._createDataType(
            context,
            owner,
            args.additionalFields!,
          ) as any;
        }
      });
    }
    /* Add own fields */
    initArgs.fields = {};
    if (args.fields) {
      context.enter('.fields', () => {
        for (const [k, v] of Object.entries(args.fields!)) {
          context.enter(`[${k}]`, () => {
            const type = this._createDataType(context, owner, v.type);
            if (type) {
              initArgs.fields![k] = {
                ...v,
                name: k,
                type,
              };
            }
          });
        }
      });
    }
    ComplexType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }

  protected static _createEnumType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.EnumTypeInit,
  ): EnumType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, EnumType.prototype);

    const initArgs = cloneObject(args) as EnumType.InitArguments;
    if (args.base) {
      context.enter('.base', () => {
        initArgs.base = this._createDataType(context, owner, args.base!) as any;
      });
    }
    initArgs.attributes = args.attributes;
    EnumType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }

  protected static _createMappedType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.MappedTypeInit,
  ): MappedType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, MappedType.prototype);

    const initArgs = cloneObject(args) as MappedType.InitArguments;
    if (args.base) {
      context.enter('.base', () => {
        initArgs.base = this._createDataType(context, owner, args.base) as any;
      });
    }
    MappedType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }

  protected static _createMixinType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.MixinTypeInit,
  ): MixinType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, MixinType.prototype);

    const initArgs = cloneObject(args) as MixinType.InitArguments;
    if (args.types) {
      context.enter('.types', () => {
        initArgs.types = [];
        let i = 0;
        for (const t of args.types) {
          context.enter(`[${i++}]`, () => {
            const base = this._createDataType(context, owner, t);
            if (!(base instanceof ComplexTypeBase)) {
              throw new TypeError(
                `"${base?.kind}" can't be set as base for a "${initArgs.kind}"`,
              );
            }
            (initArgs as any).types.push(base);
          });
        }
      });
    }
    MixinType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }

  protected static _createSimpleType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.SimpleTypeInit,
  ): SimpleType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, SimpleType.prototype);

    const initArgs = cloneObject(args) as SimpleType.InitArguments;
    if (args.base) {
      context.enter('.base', () => {
        initArgs.base = this._createDataType(context, owner, args.base!) as any;
      });
    }
    SimpleType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }

  protected static _createUnionType(
    context: DocumentInitContext,
    owner: DocumentElement,
    args: DataTypeFactory.UnionTypeInit,
  ): UnionType {
    const dataType = args._instance || ({} as any);
    Object.setPrototypeOf(dataType, UnionType.prototype);

    const initArgs = cloneObject(args) as UnionType.InitArguments;
    if (args.types) {
      context.enter('.types', () => {
        initArgs.types = [];
        let i = 0;
        for (const t of args.types) {
          context.enter(`[${i++}]`, () => {
            const base = this._createDataType(context, owner, t);
            (initArgs as any).types.push(base);
          });
        }
      });
    }
    UnionType.apply(dataType, [owner, initArgs] as any);
    return dataType;
  }
}

function preferName(
  initArgs: DataTypeFactory.DataTypeInitArguments | string,
): DataTypeFactory.DataTypeInitArguments | string {
  return typeof initArgs === 'object'
    ? initArgs.name
      ? initArgs.name
      : initArgs
    : initArgs;
}
