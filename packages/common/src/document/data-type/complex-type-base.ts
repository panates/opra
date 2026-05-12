import hashObject from 'object-hash';
import { asMutable, type StrictOmit, type Type } from 'ts-gems';
import { type Validator, validator, vg } from 'valgen';
import {
  FieldsProjection,
  parseFieldsProjection,
  ResponsiveMap,
} from '../../helpers/index.js';
import { OpraSchema } from '../../schema/index.js';
import type { DocumentElement } from '../common/document-element.js';
import { DocumentInitContext } from '../common/document-init-context.js';
import type { ApiField } from './api-field.js';
import type { ComplexType } from './complex-type.js';
import { DataType } from './data-type.js';

export const FIELD_PATH_PATTERN = /^([+-])?([a-z$_][\w.]*)$/i;

/**
 * Type definition of class constructor for ComplexTypeBase
 * @class ComplexTypeBase
 */
interface ComplexTypeBaseStatic {
  /**
   * Class constructor of MappedType
   *
   * @param owner
   * @param initArgs
   * @param context
   * @constructor
   */
  new (
    owner: DocumentElement,
    initArgs: DataType.InitArguments,
    context?: DocumentInitContext,
  ): ComplexTypeBase;

  prototype: ComplexTypeBase;
}

/**
 * Type definition of ComplexTypeBase prototype
 * @interface ComplexTypeBase
 */
export interface ComplexTypeBase extends ComplexTypeBaseClass {}

/**
 *
 * @constructor
 */
export const ComplexTypeBase = function (
  this: ComplexTypeBase | void,
  ...args: any[]
) {
  if (!this)
    throw new TypeError('"this" should be passed to call class constructor');
  // Constructor
  const [owner, initArgs, context] = args as [
    DocumentElement,
    ComplexType.InitArguments,
    DocumentInitContext | undefined,
  ];
  DataType.call(this, owner, initArgs, context);
  const _this = asMutable(this);
  (_this as any)._fields = new ResponsiveMap();
} as Function as ComplexTypeBaseStatic;

/**
 *
 */
abstract class ComplexTypeBaseClass extends DataType {
  readonly ctor?: Type;
  declare protected _fields: ResponsiveMap<ApiField>;
  readonly additionalFields?:
    | boolean
    | DataType
    | ['error']
    | ['error', string];
  readonly keyField?: OpraSchema.Field.Name;

  fieldCount(scope?: string): number {
    if (scope === '*') return this._fields.size;
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const i of this.fields(scope)) count++;
    return count;
  }

  fieldEntries(scope?: string): IterableIterator<[string, ApiField]> {
    let iterator: IterableIterator<[string, ApiField]> | undefined =
      this._fields.entries();
    if (scope === '*') return iterator;
    let r: IteratorResult<[string, ApiField]>;
    return {
      next() {
        while (iterator) {
          r = iterator.next();
          if (r.done) break;
          if (r.value && r.value[1].inScope(scope)) break;
        }
        if (r.done) return { done: r.done, value: undefined };
        return {
          done: r.done,
          value: [r.value[0], r.value[1].forScope(scope)],
        };
      },
      return(value?: [string, ApiField]) {
        iterator = undefined;
        return { done: true, value };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  }

  fields(scope?: string): IterableIterator<ApiField> {
    let iterator: IterableIterator<[string, ApiField]> | undefined =
      this.fieldEntries(scope);
    let r: IteratorResult<[string, ApiField]>;
    return {
      next() {
        if (!iterator) return { done: true, value: undefined };
        r = iterator!.next();
        return { done: r.done, value: r.value?.[1] };
      },
      return(value?: ApiField) {
        iterator = undefined;
        return { done: true, value };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  }

  fieldNames(scope?: string): IterableIterator<string> {
    if (scope === '*') return this._fields.keys();
    let iterator: IterableIterator<[string, ApiField]> | undefined =
      this.fieldEntries(scope);
    let r: IteratorResult<[string, ApiField]>;
    return {
      next() {
        if (!iterator) return { done: true, value: undefined };
        r = iterator!.next();
        return { done: r.done, value: r.value?.[0] };
      },
      return(value?: string) {
        iterator = undefined;
        return { done: true, value };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  }

  /**
   *
   */
  findField(nameOrPath: string, scope?: string | '*'): ApiField | undefined {
    if (nameOrPath.includes('.')) {
      const fieldPath = this.parseFieldPath(nameOrPath, { scope });
      if (fieldPath.length === 0)
        throw new Error(
          `Field "${nameOrPath}" does not exist in scope "${scope}"`,
        );
      const lastItem = fieldPath.pop();
      return lastItem?.field;
    }
    const field = this._fields.get(nameOrPath);
    if (field && field.inScope(scope)) return field.forScope(scope);
  }

  /**
   *
   */
  getField(nameOrPath: string, scope?: string): ApiField {
    const field = this.findField(nameOrPath, '*');
    if (field && !field.inScope(scope))
      throw new Error(
        `Field "${nameOrPath}" does not exist in scope "${scope || 'null'}"`,
      );
    if (!field) {
      throw new Error(`Field (${nameOrPath}) does not exist`);
    }
    return field.forScope(scope);
  }

  /**
   *
   */
  parseFieldPath(
    fieldPath: string,
    options?: {
      allowSigns?: 'first' | 'each';
      scope?: string | '*';
    },
  ): ComplexType.ParsedFieldPath[] {
    let dataType: DataType | undefined = this;
    let field: ApiField | undefined;
    const arr = fieldPath.split('.');
    const len = arr.length;
    const out: ComplexType.ParsedFieldPath[] = [];
    const objectType = this.owner.node.getDataType('object');
    const allowSigns = options?.allowSigns;
    const getStrPath = () => out.map(x => x.fieldName).join('.');

    for (let i = 0; i < len; i++) {
      const item: ComplexType.ParsedFieldPath = {
        fieldName: arr[i],
        dataType: objectType,
      };
      out.push(item);

      const m = FIELD_PATH_PATTERN.exec(arr[i]);
      if (!m) throw new TypeError(`Invalid field name (${getStrPath()})`);
      if (m[1]) {
        if ((i === 0 && allowSigns === 'first') || allowSigns === 'each')
          item.sign = m[1] as any;
        item.fieldName = m[2];
      }

      if (dataType) {
        if (dataType instanceof ComplexTypeBase) {
          field = dataType.findField(item.fieldName, options?.scope);
          if (field) {
            item.fieldName = field.name;
            item.field = field;
            item.dataType = field.type;
            dataType = field.type;
            continue;
          }
          if (dataType.additionalFields?.[0] === true) {
            item.additionalField = true;
            item.dataType = objectType;
            dataType = undefined;
            continue;
          }
          if (
            dataType.additionalFields?.[0] === 'type' &&
            dataType.additionalFields?.[1] instanceof DataType
          ) {
            item.additionalField = true;
            item.dataType = dataType.additionalFields[1];
            dataType = dataType.additionalFields[1];
            continue;
          }
          throw new Error(
            `Unknown field (${out.map(x => x.fieldName).join('.')})`,
          );
        }
        throw new TypeError(
          `"${out.map(x => x.fieldName).join('.')}" field is not a complex type and has no child fields`,
        );
      }
      item.additionalField = true;
      item.dataType = objectType;
    }
    return out;
  }

  /**
   *
   */
  normalizeFieldPath(
    fieldPath: string,
    options?: {
      allowSigns?: 'first' | 'each';
      scope?: string;
    },
  ): string {
    return this.parseFieldPath(fieldPath, options)
      .map(x => (x.sign || '') + x.fieldName)
      .join('.');
  }

  /**
   *
   */
  generateCodec(
    codec: 'encode' | 'decode',
    options?: DataType.GenerateCodecOptions,
  ): Validator {
    const context: GenerateCodecContext = (options as any)?.cache
      ? (options as GenerateCodecContext)
      : {
          ...options,
          projection: Array.isArray(options?.projection)
            ? parseFieldsProjection(options.projection)
            : options?.projection,
          currentPath: '',
        };

    const schema = this._generateSchema(codec, context);

    let additionalFields: any;
    if (this.additionalFields instanceof DataType) {
      additionalFields = this.additionalFields.generateCodec(codec, options);
    } else if (typeof this.additionalFields === 'boolean')
      additionalFields = this.additionalFields;
    else if (Array.isArray(this.additionalFields)) {
      if (this.additionalFields.length < 2) additionalFields = 'error';
      else {
        const message = additionalFields[1] as string;
        additionalFields = validator((input, ctx, _this) =>
          ctx.fail(_this, message, input),
        );
      }
    }

    const fn = vg.isObject(schema, {
      ctor: this.name === 'object' ? Object : this.ctor,
      additionalFields,
      name: this.name,
      coerce: true,
      caseInSensitive: options?.caseInSensitive,
      onFail: options?.onFail,
    });
    if (context.level === 0 && context.forwardCallbacks?.size) {
      for (const cb of context.forwardCallbacks) {
        cb();
      }
    }
    return fn;
  }

  protected _generateSchema(
    codec: 'encode' | 'decode',
    context: GenerateCodecContext,
  ): vg.isObject.Schema {
    context.fieldCache = context.fieldCache || new Map();
    context.level = context.level || 0;
    context.forwardCallbacks = context.forwardCallbacks || new Set();
    const schema: vg.isObject.Schema = {};
    const { currentPath, projection } = context;
    const pickList = !!(
      projection && Object.values(projection).find(p => !p.sign)
    );
    // Process fields
    let fieldName: string;
    for (const field of this.fields('*')) {
      if (
        /* Ignore field if required scope(s) do not match field scopes */
        !field.inScope(context.scope) ||
        (!(context.keepKeyFields && this.keyField) &&
          /* Ignore field if readonly and ignoreReadonlyFields option true */
          ((context.ignoreReadonlyFields && field.readonly) ||
            /* Ignore field if writeonly and ignoreWriteonlyFields option true */
            (context.ignoreWriteonlyFields && field.writeonly)))
      ) {
        schema[field.name] = vg.isUndefined({ coerce: true });
        continue;
      }
      fieldName = field.name;
      let p: any;
      if (projection !== '*') {
        p = projection?.[fieldName.toLowerCase()];
        if (
          /* Ignore if field is omitted */
          p?.sign === '-' ||
          /* Ignore if default fields ignored and field is not in projection */
          (pickList && !p) ||
          /* Ignore if default fields enabled and fields is exclusive */
          (!pickList && field.exclusive && !p)
        ) {
          schema[field.name] = vg.isUndefined({ coerce: true });
          continue;
        }
      }
      const subProjection =
        typeof projection === 'object'
          ? projection[fieldName]?.projection || '*'
          : projection;
      let cacheItem = context.fieldCache.get(field);
      const cacheKey =
        typeof subProjection === 'string'
          ? subProjection
          : hashObject(subProjection || {});
      if (!cacheItem) {
        cacheItem = {};
        context.fieldCache.set(field, cacheItem);
      }
      let fn = cacheItem[cacheKey];
      /* If in progress (circular) */
      if (fn === null) {
        // Temporary set any
        fn = vg.isAny();
        context.forwardCallbacks.add(() => {
          fn = cacheItem[cacheKey];
          schema[fieldName] =
            context.partial || !field.required
              ? vg.optional(fn!)
              : vg.required(fn!);
        });
      } else if (!fn) {
        const defaultGenerator = () => {
          cacheItem[cacheKey] = null;
          const xfn = field.generateCodec(codec, {
            ...context,
            partial: context.partial === 'deep' ? context.partial : undefined,
            projection: subProjection,
            currentPath: currentPath + (currentPath ? '.' : '') + fieldName,
            level: context.level! + 1,
          } as GenerateCodecContext);
          cacheItem[cacheKey] = xfn;
          return xfn;
        };
        if (context.fieldHook)
          fn = context.fieldHook(field, context.currentPath, defaultGenerator);
        else fn = defaultGenerator();
      }
      schema[fieldName] =
        context.partial || !(field.required || fn.id === 'required')
          ? vg.optional(fn)
          : fn.id === 'required'
            ? fn
            : vg.required(fn);
    }
    if (context.allowPatchOperators) {
      schema._$pull = vg.optional(vg.isAny());
      schema._$push = vg.optional(vg.isAny());
    }
    return schema;
  }
}

ComplexTypeBase.prototype = ComplexTypeBaseClass.prototype;

type GenerateCodecContext = StrictOmit<
  DataType.GenerateCodecOptions,
  'projection'
> & {
  currentPath: string;
  projection?: FieldsProjection | '*';
  level?: number;
  fieldCache?: Map<ApiField, Record<string, Validator | null>>;
  forwardCallbacks?: Set<Function>;
};
