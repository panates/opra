import { combineRanges, parse } from 'range-parser';

/**
 * A byte range with inclusive `start` and `end` positions.
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * The parsed ranges, with the range unit (such as "bytes") as `type`.
 */
export interface Ranges extends Array<Range> {
  type: string;
}

/**
 * `-1` means the ranges are unsatisfiable, `-2` means the header is malformed.
 */
export type ParseRangeResult = -1 | -2;

export interface ParseRangeOptions {
  /**
   * Combines overlapping and adjacent ranges. Defaults to `false`.
   */
  combine?: boolean;
}

/**
 * Parses a "Range" header value relative to the given `size`.
 * Keeps the results of range-parser 1.x on top of range-parser 2.
 *
 * @param size - The size of the representation.
 * @param header - The "Range" header value.
 * @param options - Parse options.
 * @returns The ranges, `-1` when they are unsatisfiable or `-2` when the header is malformed.
 */
export function parseRange(
  size: number,
  header: string,
  options?: ParseRangeOptions,
): Ranges | ParseRangeResult {
  size = Math.floor(size);
  if (!Number.isSafeInteger(size) || size < 0) return -1;
  const result = parse(size, header);
  if (result.code & 1) return -2;
  if (!result.ranges.length) return -1;
  const ranges = options?.combine
    ? combineRanges(result.ranges)
    : result.ranges;
  return Object.assign(
    ranges.map(({ start, end }) => ({ start, end })),
    { type: result.type },
  );
}
