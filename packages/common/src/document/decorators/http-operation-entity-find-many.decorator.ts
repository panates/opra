import { HttpStatusCode, MimeTypes } from '../../enums/index.js';
import { OpraSchema } from '../../schema/index.js';
import { DATATYPE_METADATA } from '../constants.js';
import { FieldPathType } from '../data-type/extended-types/index.js';
import { IntegerType } from '../data-type/primitive-types/index.js';
import { HttpOperation } from '../http/http-operation.js';
import { HttpOperationDecoratorFactory } from './http-operation.decorator.js';
import {
  createFilterDecorator,
  createSortFieldsDecorator,
  getDataTypeName,
} from './http-operation-entity.decorator.js';

/**
 * HttpOperation.Entity.FindMany
 */
HttpOperation.Entity.FindMany = function (
  arg0: any,
  arg1?: any,
): HttpOperation.Entity.FindManyDecorator {
  let args: HttpOperation.Entity.FindManyArgs;
  if (typeof arg0 === 'object' && !arg0[DATATYPE_METADATA]) {
    args = arg0;
  } else args = { ...arg1, type: arg0 };

  /* Initialize the decorator and the chain */
  const decoratorChain: Function[] = [];
  const decorator = HttpOperationDecoratorFactory(decoratorChain, {
    method: 'GET',
    ...args,
    composition: 'Entity.FindMany',
  }) as HttpOperation.Entity.FindManyDecorator;
  decorator
    .Response(HttpStatusCode.OK, {
      description:
        'Operation is successful. Returns OperationResult with "payload" field that contains list of resources.',
      contentType: MimeTypes.opra_response_json,
      type: args.type,
      partial: 'deep',
      isArray: true,
    })
    .Response(HttpStatusCode.UNPROCESSABLE_ENTITY, {
      description:
        'The request was well-formed but was unable to process operation due to one or many errors.',
      contentType: MimeTypes.opra_response_json,
    })
    .QueryParam('limit', {
      description: 'Determines number of returning instances',
      type: new IntegerType({ minValue: 1, maxValue: args.maxLimit }),
    })
    .QueryParam('skip', {
      description: 'Determines number of instances to skip before returning',
      // Zero is the first page, and `skip = page * pageSize` is how a
      // client pages: rejecting it made the very first page a 400.
      type: new IntegerType({ minValue: 0 }),
    })
    .QueryParam('count', {
      description: 'Counts all matching instances if enabled',
      type: Boolean,
    })
    .QueryParam('projection', {
      description: 'Determines fields projection',
      type: new FieldPathType({
        dataType: args.type,
        allowSigns: 'each',
      }),
      isArray: true,
      arraySeparator: ',',
    });

  decoratorChain.push((operationMeta: HttpOperation.Metadata) => {
    const compositionOptions = (operationMeta.compositionOptions =
      operationMeta.compositionOptions || {});
    compositionOptions.type = getDataTypeName(args.type);
    if (args.defaultLimit) compositionOptions.defaultLimit = args.defaultLimit;
    if (args.defaultProjection)
      compositionOptions.defaultProjection = args.defaultProjection;
    if (args.maxLimit) compositionOptions.maxLimit = args.maxLimit;
  });

  decorator.Filter = createFilterDecorator(
    decorator,
    decoratorChain,
    args.type,
  );

  /**
   *
   */
  decorator.DefaultSort = (...fields: OpraSchema.Field.QualifiedName[]) => {
    decoratorChain.push((operationMeta: HttpOperation.Metadata) => {
      const compositionOptions = (operationMeta.compositionOptions =
        operationMeta.compositionOptions || {});
      compositionOptions.defaultSort = fields;
    });
    return decorator;
  };

  decorator.SortFields = createSortFieldsDecorator(decorator, decoratorChain);

  return decorator;
};
