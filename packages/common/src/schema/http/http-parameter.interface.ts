import type { HttpParameterLocation } from '../types.js';
import type { Value } from '../value.interface.js';

/**
 *
 * @interface HttpParameter
 */
export interface HttpParameter extends Value {
  /**
   * Defines the location of the parameter
   */
  location: HttpParameterLocation;

  /**
   * Name of the parameter. RegExp pattern can be used matching parameter name
   */
  name: string | RegExp;

  /**
   * Determines if parameter is key
   */
  keyParam?: boolean;

  /**
   * Default value
   */
  default?: any;

  /**
   * Defines array separator
   */
  arraySeparator?: string;

  /**
   * Indicates if parameter value required
   */
  required?: boolean;

  /**
   * Indicates if the parameter is deprecated and can be removed in the next
   */
  deprecated?: boolean | string;
}
