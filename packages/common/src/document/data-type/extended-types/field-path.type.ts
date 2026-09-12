import type { Type } from 'ts-gems';
import { toString, type Validator, validator, vg } from 'valgen';
import type { ApiDocument } from '../../api-document.js';
import { DocumentElement } from '../../common/document-element.js';
import { DECODER, ENCODER } from '../../constants.js';
import { DataType } from '../data-type.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'fieldpath',
  description: 'Field path',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('address.city'))
export class FieldPathType {
  constructor(attributes?: Partial<FieldPathType>) {
    if (attributes) Object.assign(this, attributes);
  }

  @SimpleType.Attribute({
    description: 'Data type which field belong to',
  })
  dataType?: Type | string;

  @SimpleType.Attribute({
    description:
      'Determines if signs (+,-) are allowed. ' +
      'If set "first" signs are allowed only beginning of the field path' +
      'If set "each" signs are allowed at each field in the path',
  })
  allowSigns?: 'first' | 'each';

  [DECODER](
    properties: Partial<this>,
    {
      element,
      scope,
    }: {
      element: DocumentElement;
      scope?: string;
    },
  ): Validator {
    const dataType = properties.dataType
      ? element.node.getComplexType(properties.dataType)
      : element.node.getComplexType('object');
    const allowSigns = properties.allowSigns;
    const decodeFieldPath = validator('decodeFieldPath', (input: string) =>
      dataType.normalizeFieldPath(input, { allowSigns, scope }),
    );
    return vg.pipe([toString, decodeFieldPath]);
  }

  [ENCODER](properties: Partial<this>, args): Validator {
    return this[DECODER](properties, args);
  }

  toJSON(
    properties: Partial<FieldPathType>,
    element: DocumentElement,
    options?: ApiDocument.ExportOptions,
  ) {
    const dataType = properties.dataType
      ? element.node.getComplexType(properties.dataType)
      : element.node.getComplexType('object');
    /* Test scope */
    DataType.prototype.toJSON.call(dataType, options);

    const typeName = dataType
      ? element.node.getDataTypeNameWithNs(dataType)
      : undefined;
    return {
      dataType: typeName ? typeName : dataType.toJSON(options),
      allowSigns: properties.allowSigns,
    };
  }
}
