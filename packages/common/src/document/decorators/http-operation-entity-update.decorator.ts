import { HttpStatusCode, MimeTypes } from '../../enums/index.js';
import { DATATYPE_METADATA } from '../constants.js';
import { FieldPathType } from '../data-type/extended-types/index.js';
import { HttpOperation } from '../http/http-operation.js';
import { HttpOperationDecoratorFactory } from './http-operation.decorator.js';
import {
  createFilterDecorator,
  createKeyParamDecorator,
  getDataTypeName,
} from './http-operation-entity.decorator.js';

/**
 * HttpOperation.Entity.Update
 */
HttpOperation.Entity.Update = function (
  arg0: any,
  arg1?: any,
): HttpOperation.Entity.UpdateDecorator {
  let args: HttpOperation.Entity.UpdateArgs;
  if (typeof arg0 === 'object' && !arg0[DATATYPE_METADATA]) {
    args = arg0;
  } else args = { ...arg1, type: arg0 };

  /* Initialize the decorator and the chain */
  const decoratorChain: Function[] = [];

  const decorator = HttpOperationDecoratorFactory(decoratorChain, {
    method: 'PATCH',
    ...args,
    composition: 'Entity.Update',
    requestBody: {
      partial: 'deep',
      immediateFetch: true,
      allowPatchOperators: true,
      allowNullOptionals: true,
      keepKeyFields: true,
      ...args.requestBody,
      required: true,
    },
  }) as HttpOperation.Entity.UpdateDecorator;
  decorator
    .QueryParam('projection', {
      description: 'Determines fields projection',
      type: new FieldPathType({
        dataType: args.type,
        allowSigns: 'each',
      }),
      isArray: true,
      arraySeparator: ',',
    })
    .RequestContent(args.requestBody?.type || args.type)
    .Response(HttpStatusCode.OK, {
      description:
        'Operation is successful. Returns OperationResult with "payload" field that contains updated resource.',
      contentType: MimeTypes.opra_response_json,
      type: args.type,
      partial: 'deep',
    })
    .Response(HttpStatusCode.NO_CONTENT, {
      description: 'Operation is successful but no resource found',
    })
    .Response(HttpStatusCode.UNPROCESSABLE_ENTITY, {
      description:
        'The request was well-formed but was unable to process operation due to one or many errors.',
      contentType: MimeTypes.opra_response_json,
    });

  decoratorChain.push((operationMeta: HttpOperation.Metadata) => {
    const compositionOptions = (operationMeta.compositionOptions =
      operationMeta.compositionOptions || {});
    compositionOptions.type = getDataTypeName(args.type);
  });

  decorator.KeyParam = createKeyParamDecorator(decorator, decoratorChain);

  decorator.Filter = createFilterDecorator(
    decorator,
    decoratorChain,
    args.type,
  );

  return decorator;
};
