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
 * HTTP Api
 * @interface HttpApi
 */
export interface HttpApi extends Api {
  transport: 'http';
  description?: string;
  url?: string;
  servers?: HttpServer[];
  controllers: Record<string, HttpController>;
}
