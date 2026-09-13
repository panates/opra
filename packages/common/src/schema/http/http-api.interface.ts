import type { Api } from '../api.interface.js';
import type { HttpController } from './http-controller.interface.js';

/**
 * A base server URL an HTTP api can be reached at, mirroring OpenAPI's own
 * `servers` entries (`url` + an optional human-readable `description`).
 * @interface HttpServer
 */
export interface HttpServer {
  url: string;
  description?: string;
}

/**
 * Top-level metadata for a named group of operations, mirroring OpenAPI's
 * own top-level `tags` entries (`name` + an optional `description`) — an
 * operation joins a group by listing this `name` in its own
 * `HttpOperation.groups`. `icon` has no OpenAPI equivalent: a plain string
 * (e.g. an emoji) the UI renders as-is next to the group's title, not a
 * key into some fixed icon set.
 * @interface HttpGroup
 */
export interface HttpGroup {
  name: string;
  description?: string;
  icon?: string;
}

/**
 * HTTP Api
 * @interface HttpApi
 */
export interface HttpApi extends Api {
  transport: 'http';
  description?: string;
  url?: string;
  servers?: HttpServer[];
  groups?: HttpGroup[];
  controllers: Record<string, HttpController>;
}
