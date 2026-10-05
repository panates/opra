import { toInteger, type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';
import { NumberType } from './number.type.js';

@(SimpleType({
  name: 'integer',
  description: 'An integer number',
  nameMappings: {
    js: 'number',
    json: 'number',
  },
}).Example(42))
export class IntegerType extends NumberType {
  constructor(properties?: Partial<IntegerType>) {
    super(properties);
  }

  protected [DECODER](properties: Partial<this>): Validator {
    const x: Validator[] = [];
    if (properties.minValue != null) x.push(vg.isGte(properties.minValue));
    if (properties.maxValue != null) x.push(vg.isLte(properties.maxValue));
    return x.length > 0
      ? vg.pipe([toInteger, ...x], { returnIndex: 0 })
      : toInteger;
  }

  protected [ENCODER](properties: Partial<this>): Validator {
    return this[DECODER](properties);
  }
}
