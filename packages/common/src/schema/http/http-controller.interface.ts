import type { DataTypeContainer } from '../data-type-container.interface.js';
import type { HttpOperation } from './http-operation.interface.js';
import type { HttpParameter } from './http-parameter.interface.js';

/**
 *
 * @interface HttpController
 */
export interface HttpController extends DataTypeContainer {
  kind: HttpController.Kind;
  description?: string;
  /**
   * Named sections (see `HttpApi.sections`) the operations under this
   * controller belong to. Declaring them once here says what every
   * operation of a resource is, instead of repeating the same list on each
   * one; a nested controller inherits it, and either a nested controller
   * or a single operation overrides it by naming its own.
   */
  sections?: string[];
  path?: string;
  operations?: Record<string, HttpOperation>;
  controllers?: Record<string, HttpController>;
  parameters?: HttpParameter[];
}

/**
 *
 * @namespace HttpController
 */

export namespace HttpController {
  export type Name = string;
  export const Kind = 'HttpController';
  export type Kind = 'HttpController';
}
