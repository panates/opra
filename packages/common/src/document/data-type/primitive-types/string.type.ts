import { toString, type Validator, vg } from 'valgen';
import { DATATYPE_METADATA, DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'string',
  description: 'A sequence of characters',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example(' '))
export class StringType {
  constructor(properties?: Partial<StringType>) {
    if (properties) Object.assign(this, properties);
  }

  @SimpleType.Attribute({
    description: 'Regex pattern to be used for validation',
  })
  pattern?: string | RegExp;

  @SimpleType.Attribute({
    description: 'Name of the pattern',
  })
  patternName?: string;

  @SimpleType.Attribute({
    description: 'Minimum number of characters',
  })
  minLength?: number;

  @SimpleType.Attribute({
    description: 'Maximum number of characters',
  })
  maxLength?: number;

  protected [DECODER](properties: Partial<this>): Validator {
    const x: Validator[] = [];
    if (properties.pattern) {
      let formatName: string | undefined = properties.patternName;
      if (!formatName) {
        const meta = Reflect.getMetadata(
          DATATYPE_METADATA,
          Object.getPrototypeOf(this).constructor,
        );
        formatName = meta.name;
      }
      x.push(vg.matches(properties.pattern, { formatName }));
    }
    if (properties.minLength) x.push(vg.lengthMin(properties.minLength));
    if (properties.maxLength) x.push(vg.lengthMax(properties.maxLength));
    return x.length > 0
      ? vg.pipe([toString, ...x], { returnIndex: 0 })
      : toString;
  }

  protected [ENCODER](properties: Partial<this>): Validator {
    return this[DECODER](properties);
  }
}
