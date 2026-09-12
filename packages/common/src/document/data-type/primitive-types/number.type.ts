import { toNumber, type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'number',
  description: 'Both Integer as well as Floating-Point numbers',
  nameMappings: {
    js: 'number',
    json: 'number',
  },
}).Example(3.14))
export class NumberType {
  constructor(properties?: Partial<NumberType>) {
    if (properties) Object.assign(this, properties);
  }

  @SimpleType.Attribute({
    description: 'Determines the minimum value',
  })
  minValue?: number;

  @SimpleType.Attribute({
    description: 'Determines the maximum value',
  })
  maxValue?: number;

  protected [DECODER](properties: Partial<this>): Validator {
    const x: Validator[] = [];
    if (properties.minValue != null) x.push(vg.isGte(properties.minValue));
    if (properties.maxValue != null) x.push(vg.isLte(properties.maxValue));
    return x.length > 0
      ? vg.pipe([toNumber, ...x], { returnIndex: 0 })
      : toNumber;
  }

  protected [ENCODER](properties: Partial<this>): Validator {
    return this[DECODER](properties);
  }
}
