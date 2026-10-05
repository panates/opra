import { isPlainObject, merge } from '@jsopen/objects';
import { DATATYPE_METADATA } from '../document/constants.js';

export function cloneObject<T extends {}>(obj: T, jsonOnly?: boolean): T {
  return merge({}, obj, {
    /* **The cast is on the symbol index, not on the guard.** `@jsopen/objects` 2.3.2 turned
     * `isPlainObject(obj: any): boolean` into a type predicate - `obj is Record<string, any>` -
     * in a patch release. The predicate is right, and it narrows `v` to a type whose index
     * signature is `string` only, so reading a `unique symbol` off it is `TS2538: Type 'unique
     * symbol' cannot be used as an index type`. Under 2.3.1 `v` stayed `any` and the same line
     * compiled. Measured: clean on 2.3.1, one error on 2.3.4, with `packages/common` failing first
     * and every package depending on it failing after it with `Cannot find module '@opra/core'`. */
    deep: v =>
      isPlainObject(v) && !(v as Record<symbol, any>)[DATATYPE_METADATA],
    symbolKeys: true,
    copyDescriptors: true,
    ignoreUndefined: true,
    filter(key, source) {
      const v = source[key];
      return (
        !jsonOnly ||
        (typeof v !== 'function' &&
          (typeof v !== 'object' || isPlainObject(v) || Array.isArray(v)))
      );
    },
  }) as T;
}
