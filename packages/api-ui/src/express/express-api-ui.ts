import type { ApiDocument } from '@opra/common';
import type { RequestHandler } from 'express';
import { ApiUiFactory } from '../api-ui.factory.js';
import type { ApiUiOptions } from '../types.js';

/**
 * Creates an Express request handler that serves the API reference page for
 * the given `ApiDocument`. The HTML is rendered once (on first request) and
 * cached for the lifetime of the process, since it only depends on the
 * `ApiDocument` and the options passed here.
 */
export function expressApiUi(
  document: ApiDocument,
  options?: ApiUiOptions,
): RequestHandler {
  let html: string | undefined;
  return (_req, res) => {
    html ??= ApiUiFactory.render(document, options);
    res.type('text/html').send(html);
  };
}
