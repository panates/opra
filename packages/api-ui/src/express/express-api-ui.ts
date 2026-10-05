import type { ApiDocument } from '@opra/common';
import type { RequestHandler } from 'express';
import { serveApiUi } from '../api-ui-handler.js';
import type { ApiUiOptions } from '../types.js';

/**
 * Mounts the API reference page (and the documentation studio, when
 * `options.studio` is on) as an Express handler.
 *
 * Everything it serves is `serveApiUi`'s — see there for the routes and for
 * why the page is rendered once per scope and language. What is Express's
 * here is one fact: a handler mounted with `.use(path, …)` is given a `url`
 * with the mount prefix already stripped and the prefix itself on
 * `req.baseUrl`, which is exactly the pair the handler asks for.
 */
export function expressApiUi(
  document: ApiDocument,
  options?: ApiUiOptions,
): RequestHandler {
  const serve = serveApiUi(document, options);
  return (req, res) => serve(req, res, req.baseUrl);
}
