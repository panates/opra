import type { Type } from 'ts-gems';
import { type Validator, vg } from 'valgen';
import { DECODER, ENCODER } from '../../constants.js';
import { SimpleType } from '../simple-type.js';

@(SimpleType({
  name: 'datetime',
  description: 'A full datetime value',
  nameMappings: {
    js: 'string',
    json: 'string',
  },
}).Example('2021-04-18T22:30:15'))
export class DateTimeType {
  designType?: Type;

  constructor(attributes?: Partial<DateTimeType>) {
    if (attributes) Object.assign(this, attributes);
  }

  @SimpleType.Attribute({
    description:
      'Determines the minimum precision, e.g. "year", "month", "hours", "minutes", "seconds" etc. Defaults to "day".',
  })
  precisionMin?: vg.isDateString.Precision;

  @SimpleType.Attribute({
    description:
      'Determines the minimum precision, e.g. "year", "month", "hours", "minutes", "seconds" etc. Defaults to "ms".',
  })
  precisionMax?: vg.isDateString.Precision;

  protected [DECODER](properties: Partial<this>): Validator {
    let fn: Validator;
    if (properties.designType === Date) {
      fn = vg.isDate({ coerce: true });
    } else {
      fn = vg.isDateString({
        precisionMin: properties.precisionMin || 'day',
        precisionMax: properties.precisionMax || 'ms',
        trim: true,
        coerce: true,
      });
    }
    const x: Validator[] = [fn];
    if (properties.minValue != null) {
      x.push(vg.isGte(fn(properties.minValue)));
    }
    if (properties.maxValue != null) {
      x.push(vg.isLte(fn(properties.maxValue)));
    }
    return x.length > 0 ? vg.pipe(x, { returnIndex: 0 }) : fn;
  }

  protected [ENCODER](properties: Partial<this>): Validator {
    const fn: Validator = vg.isDateString({
      precisionMin: properties.precisionMin || 'day',
      precisionMax: properties.precisionMax || 'ms',
      trim: true,
      coerce: true,
    });
    const x: Validator[] = [fn];
    if (properties.minValue != null) {
      x.push(vg.isGte(fn(properties.minValue)));
    }
    if (properties.maxValue != null) {
      x.push(vg.isLte(fn(properties.maxValue)));
    }
    return x.length > 0 ? vg.pipe(x, { returnIndex: 0 }) : fn;
  }

  @SimpleType.Attribute({
    description: 'Minimum value',
  })
  minValue?: string;

  @SimpleType.Attribute({
    description: 'Maximum value',
  })
  maxValue?: string;
}
