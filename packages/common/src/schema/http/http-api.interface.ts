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
 * Top-level metadata for a named section of operations, mirroring OpenAPI's
 * own top-level `tags` entries (`name` + an optional `description`) — an
 * operation joins a section by listing this `name` in its own
 * `HttpOperation.sections`. `icon` has no OpenAPI equivalent: a plain string
 * (e.g. an emoji) the UI renders as-is next to the section's title, not a
 * key into some fixed icon set.
 * @interface HttpSection
 */
export interface HttpSection {
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
  sections?: HttpSection[];
  controllers: Record<string, HttpController>;
}
