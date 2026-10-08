import type { DataTypeContainer } from '../data-type-container.interface.js';
import type { HttpMethod } from '../types.js';
import type { HttpOperationResponse } from './http-operation-response.interface.js';
import type { HttpParameter } from './http-parameter.interface.js';
import type { HttpRequestBody } from './http-request-body.interface.js';

/**
 * @interface HttpOperation
 */
export interface HttpOperation extends DataTypeContainer {
  kind: HttpOperation.Kind;
  method: HttpMethod;
  title?: string;
  description?: string;
  /**
   * Named sections (see `HttpApi.sections`) this operation belongs to —
   * mirrors OpenAPI's per-operation `tags`. An operation can list more
   * than one; one with none at all falls into the UI's "Ungrouped"
   * bucket rather than being left out of the sectioned view entirely.
   *
   * An operation that declares none inherits its controller's
   * (`HttpController.sections`), so this is always the whole answer for
   * one operation and a reader never has to walk up the tree. Declaring
   * any here replaces the inherited list rather than adding to it.
   */
  sections?: string[];
  path?: string;
  /**
   * Determines if the `path` will be joined or merged to parent path.
   */
  mergePath?: boolean;
  parameters?: HttpParameter[];
  responses?: HttpOperationResponse[];
  requestBody?: HttpRequestBody;
  composition?: string;
  compositionOptions?: Record<string, any>;
}

export namespace HttpOperation {
  export const Kind = 'HttpOperation';
  export type Kind = 'HttpOperation';
}
