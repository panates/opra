import type { StrictOmit, Type, TypeThunkAsync } from 'ts-gems';
import { FilterRules } from '../../filter/filter-rules.js';
import { OpraFilter } from '../../filter/index.js';
import { OpraSchema } from '../../schema/index.js';
import { DATATYPE_METADATA } from '../constants.js';
import { FIELD_PATH_PATTERN } from '../data-type/complex-type-base.js';
import { EnumType } from '../data-type/enum-type.js';
import { FilterType } from '../data-type/extended-types/index.js';
import { HttpOperation } from '../http/http-operation.js';
import type { HttpParameter } from '../http/http-parameter.js';
import { HttpRequestBody } from '../http/http-request-body.js';
import { type HttpOperationDecorator } from './http-operation.decorator.js';

/* Augmentation **/
declare module '../http/http-operation.js' {
  /**
   * HttpOperationStatic
   */
  interface HttpOperationStatic {
    Entity: HttpOperationEntity;
  }

  interface HttpOperationEntity {
    Create(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.CreateArgs, 'type'>,
    ): HttpOperation.Entity.CreateDecorator;

    Create(
      args: HttpOperation.Entity.CreateArgs,
    ): HttpOperation.Entity.CreateDecorator;

    Delete(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.DeleteArgs, 'type'>,
    ): HttpOperation.Entity.DeleteDecorator;

    Delete(
      args: HttpOperation.Entity.DeleteArgs,
    ): HttpOperation.Entity.DeleteDecorator;

    DeleteMany(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.DeleteManyArgs, 'type'>,
    ): HttpOperation.Entity.DeleteManyDecorator;

    DeleteMany(
      args: HttpOperation.Entity.DeleteManyArgs,
    ): HttpOperation.Entity.DeleteManyDecorator;

    FindMany(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.FindManyArgs, 'type'>,
    ): HttpOperation.Entity.FindManyDecorator;

    FindMany(
      args: HttpOperation.Entity.FindManyArgs,
    ): HttpOperation.Entity.FindManyDecorator;

    Get(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.GetArgs, 'type'>,
    ): HttpOperation.Entity.GetDecorator;

    Get(args: HttpOperation.Entity.GetArgs): HttpOperation.Entity.GetDecorator;

    Replace(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.UpdateArgs, 'type'>,
    ): HttpOperation.Entity.ReplaceDecorator;

    Replace(
      args: HttpOperation.Entity.ReplaceArgs,
    ): HttpOperation.Entity.ReplaceDecorator;

    Update(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.UpdateArgs, 'type'>,
    ): HttpOperation.Entity.UpdateDecorator;

    Update(
      args: HttpOperation.Entity.UpdateArgs,
    ): HttpOperation.Entity.UpdateDecorator;

    UpdateMany(
      type: Type | string,
      options?: StrictOmit<HttpOperation.Entity.UpdateManyArgs, 'type'>,
    ): HttpOperation.Entity.UpdateManyDecorator;

    UpdateMany(
      args: HttpOperation.Entity.UpdateManyArgs,
    ): HttpOperation.Entity.UpdateManyDecorator;
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  namespace HttpOperation {
    namespace Entity {
      /* Create */
      export interface CreateDecorator extends HttpOperationDecorator {}

      export interface CreateArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
        requestBody?: Pick<
          HttpRequestBody.Options,
          'description' | 'maxContentSize'
        > & {
          type?: Type | string;
          immediateFetch?: boolean;
        };
      }

      /* Delete */
      export interface DeleteDecorator extends HttpOperationDecorator {
        KeyParam(
          name: string,
          optionsOrType?:
            | StrictOmit<HttpParameter.Options, 'location'>
            | string
            | TypeThunkAsync,
        ): this;
      }

      export interface DeleteArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
      }

      /* DeleteMany */
      export interface FilterOptions {
        mappedField?: string;
        operators?: OpraFilter.ComparisonOperator[];
        notes?: string;
        prepare?: (args: OpraFilter.ComparisonExpression.PrepareArgs) => any;
      }

      export interface DeleteManyDecorator extends HttpOperationDecorator {
        Filter(
          field: string,
          operators?: OpraFilter.ComparisonOperator[] | string,
        ): this;

        Filter(field: string, options?: FilterOptions): this;
      }

      export interface DeleteManyArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
      }

      /* FindMany */
      export interface FindManyDecorator extends HttpOperationDecorator {
        SortFields(
          ...fields: OpraSchema.Field.QualifiedName[]
        ): FindManyDecorator;

        SortFields(
          fieldsMap: Record<
            OpraSchema.Field.QualifiedName,
            OpraSchema.Field.QualifiedName
          >,
        ): FindManyDecorator;

        DefaultSort(
          ...fields: OpraSchema.Field.QualifiedName[]
        ): FindManyDecorator;

        Filter(
          field: OpraSchema.Field.QualifiedName,
          operators?: OpraFilter.ComparisonOperator[] | string,
        ): this;

        Filter(field: string, options?: FilterOptions): this;
      }

      export interface FindManyArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
        defaultLimit?: number;
        defaultProjection?: string[];
        maxLimit?: number;
      }

      /* Get */
      export interface GetDecorator extends HttpOperationDecorator {
        KeyParam(
          name: string,
          optionsOrType?:
            | StrictOmit<HttpParameter.Options, 'location'>
            | string
            | TypeThunkAsync,
        ): this;
      }

      export interface GetArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
      }

      /* Replace */
      export interface ReplaceDecorator extends HttpOperationDecorator {
        KeyParam(
          name: string,
          optionsOrType?:
            | StrictOmit<HttpParameter.Options, 'location'>
            | string
            | TypeThunkAsync,
        ): this;
      }

      export interface ReplaceArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
      }

      /* Update */
      export interface UpdateDecorator extends HttpOperationDecorator {
        KeyParam(
          name: string,
          optionsOrType?:
            | StrictOmit<HttpParameter.Options, 'location'>
            | string
            | TypeThunkAsync,
        ): this;

        Filter(
          field: OpraSchema.Field.QualifiedName,
          operators?: OpraFilter.ComparisonOperator[] | string,
        ): this;

        Filter(field: string, options?: FilterOptions): this;
      }

      export interface UpdateArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
        requestBody?: Pick<
          HttpRequestBody.Options,
          'description' | 'maxContentSize'
        > & {
          type?: Type | string;
          immediateFetch?: boolean;
          allowPatchOperators?: boolean;
          allowNullOptionals?: boolean;
        };
      }

      /* UpdateMany */
      export interface UpdateManyDecorator extends HttpOperationDecorator {
        Filter(
          field: OpraSchema.Field.QualifiedName,
          operators?: OpraFilter.ComparisonOperator[] | string,
        ): this;

        Filter(field: string, options?: FilterOptions): this;
      }

      export interface UpdateManyArgs extends StrictOmit<
        HttpOperation.Options,
        'method' | 'requestBody'
      > {
        type: Type | string;
        requestBody?: Pick<
          HttpRequestBody.Options,
          'description' | 'maxContentSize'
        > & {
          type?: Type | string;
          immediateFetch?: boolean;
          allowPatchOperators?: boolean;
          allowNullOptionals?: boolean;
        };
      }
    }
  }
}

/* Implementation **/

HttpOperation.Entity = {} as any;

/**
 *
 * @param typ
 */
export function getDataTypeName(typ: Type | string): string {
  if (typeof typ === 'string') return typ;
  const metadata = Reflect.getMetadata(DATATYPE_METADATA, typ);
  if (!metadata)
    throw new TypeError(
      `Type (${typ}) is not decorated with any datatype decorators`,
    );
  if (metadata?.name) return metadata.name;
  throw new TypeError(
    `You should provide named data type but embedded one found`,
  );
}

/**
 *
 */
export function createKeyParamDecorator<T extends HttpOperationDecorator>(
  decorator: T,
  decoratorChain: Function[],
) {
  return (
    name: string,
    prmOptions?: StrictOmit<HttpParameter.Options, 'location'> | string | Type,
  ) => {
    const paramMeta: HttpParameter.Metadata =
      typeof prmOptions === 'string' || typeof prmOptions === 'function'
        ? {
            name,
            location: 'path',
            type: prmOptions,
            keyParam: true,
          }
        : {
            ...prmOptions,
            name,
            location: 'path',
            keyParam: true,
          };
    decorator.PathParam(name, paramMeta);
    decoratorChain.push((meta: HttpOperation.Metadata): void => {
      if (!meta.path?.includes(':' + name))
        meta.path = (meta.path || '') + '@:' + name;
      meta.mergePath = true;
    });
    return decorator;
  };
}

/**
 *
 */
export function createSortFieldsDecorator<T extends HttpOperationDecorator>(
  decorator: T,
  decoratorChain: Function[],
) {
  return (...varargs: any[]) => {
    const defObj: Record<
      OpraSchema.Field.QualifiedName,
      OpraSchema.Field.QualifiedName
    > =
      typeof varargs[0] === 'object'
        ? varargs[0]
        : varargs.reduce((acc, k: string) => {
            const a = k.split(':');
            acc[a[0]] = a[1] || a[0];
            return acc;
          }, {});
    const fieldsMap = Object.keys(defObj).reduce((acc, k) => {
      const m1 = FIELD_PATH_PATTERN.exec(k);
      const m2 = FIELD_PATH_PATTERN.exec(defObj[k]);
      if (m1 && m2) {
        acc[m1[2]] = m2[2];
      }
      return acc;
    }, {});
    const prmEnum = Object.keys(defObj).reduce((acc, k) => {
      const m = FIELD_PATH_PATTERN.exec(k);
      if (m) {
        if (m[1] != '-') acc[m[2]] = m[2];
        if (m[1] != '+') acc['-' + m[2]] = '-' + m[2];
      }
      return acc;
    }, {});
    decoratorChain.push((operationMeta: HttpOperation.Metadata) => {
      const compositionOptions = (operationMeta.compositionOptions =
        operationMeta.compositionOptions || {});
      compositionOptions.sortFields = fieldsMap;
    });
    decorator.QueryParam('sort', {
      description: 'Determines sort fields',
      type: EnumType(prmEnum),
      isArray: true,
      arraySeparator: ',',
      parser: (v: string[]) =>
        v.map(x => {
          const m = FIELD_PATH_PATTERN.exec(x);
          return m ? (m[1] || '') + fieldsMap[m[2]] : x;
        }),
    });
    return decorator;
  };
}

/**
 *
 */
export function createFilterDecorator<T extends HttpOperationDecorator>(
  decorator: T,
  decoratorChain: Function[],
  dataType: string | Type,
) {
  let filterRules: FilterRules = Reflect.getMetadata('FilterRules', decorator);
  if (!filterRules) {
    filterRules = new FilterRules();
    Reflect.defineMetadata('FilterRules', filterRules, decorator);
  }
  let filterType: FilterType = Reflect.getMetadata('FilterType', decorator);
  if (!filterType) {
    filterType = new FilterType({ dataType });
    filterType.rules = {};
    Reflect.defineMetadata('FilterType', filterType, decorator);
  }

  return (
    field: string,
    arg0?:
      | OpraFilter.ComparisonOperator[]
      | string
      | HttpOperation.Entity.FilterOptions,
  ) => {
    const filterOptions: HttpOperation.Entity.FilterOptions | undefined =
      (Array.isArray(arg0)
        ? { operators: arg0 }
        : typeof arg0 === 'string'
          ? {
              operators: arg0.split(
                /\s*,\s*/,
              ) as OpraFilter.ComparisonOperator[],
            }
          : arg0) || {};
    filterOptions.operators = filterOptions.operators || ['=', '!='];
    if (field.includes(':')) {
      const a = field.split(':');
      field = a[0];
      filterOptions.mappedField = a[1];
    }

    decoratorChain.push(() => {
      filterRules.set(field, filterOptions);
      filterType.rules = filterRules.toJSON();
    });
    decorator.QueryParam('filter', {
      type: filterType,
      description: 'Determines filter fields',
    });
    return decorator;
  };
}
