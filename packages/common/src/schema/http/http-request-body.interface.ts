import type { HttpMediaType } from './http-media-type.interface.js';

/**
 *
 * @interface HttpRequestBody
 */
export interface HttpRequestBody {
  /**
   * A brief description.
   * [CommonMark](https://commonmark.org/) syntax MAY be used for rich text representation
   */
  description?: string;

  /**
   * Alternatives of media types
   */
  content: HttpMediaType[];

  /**
   * Determines if the request body is required.
   * Default `true` for POST and PATCH operations, `false` for other methods
   */
  required?: boolean;

  /**
   * Maximum accepted content size in bytes.
   */
  maxContentSize?: number;

  /**
   * Determines if the request body object is partial
   */
  partial?: boolean | 'deep';

  /**
   *
   */
  allowPatchOperators?: boolean;

  /**
   * Determines if optional fields can be null
   */
  allowNullOptionals?: boolean;
}
