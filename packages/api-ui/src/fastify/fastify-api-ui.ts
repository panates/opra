import type { ApiDocument } from '@opra/common';
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { serveApiUi } from '../api-ui-handler.js';
import type { ApiUiOptions } from '../types.js';

/**
 * Mounts the API reference page (and the documentation studio, when
 * `options.studio` is on) as a Fastify plugin.
 *
 * ```ts
 * app.register(fastifyApiUi(document, { scopes: ['api'] }), {
 *   prefix: '/ui',
 * });
 * ```
 *
 * Everything it serves is `serveApiUi`'s - this only translates between
 * Fastify's request and the `node:http` one underneath it. Three things need
 * translating, and each is a thing Express happens to do on its own:
 *
 * - **The mount prefix is not stripped.** Fastify routes a prefixed plugin by
 *   the full path, so the handler is handed a `url` cut down to the mount and
 *   the prefix separately. `instance.prefix` is the whole of it, parents
 *   included.
 * - **The response is taken over.** `reply.hijack()` tells Fastify this
 *   request is answered on the raw socket and that it must not serialize a
 *   reply of its own afterwards.
 * - **The body is already parsed.** Fastify reads and parses it before any
 *   handler runs, leaving the raw stream consumed - so the studio's own save
 *   route would wait for bytes that never come. The parsed value is handed
 *   over on the raw request, which is where the studio looks for one.
 */
export function fastifyApiUi(
  document: ApiDocument,
  options?: ApiUiOptions,
): FastifyPluginAsync {
  const serve = serveApiUi(document, options);
  return async (instance: FastifyInstance) => {
    const handler = (request: FastifyRequest, reply: FastifyReply) => {
      const prefix = instance.prefix || '';
      const raw = request.raw;
      const full = raw.url || '/';
      let remainder =
        prefix && full.startsWith(prefix) ? full.slice(prefix.length) : full;
      if (!remainder.startsWith('/')) remainder = '/' + remainder;
      raw.url = remainder;
      (raw as { body?: unknown }).body = request.body;
      reply.hijack();
      serve(raw, reply.raw, prefix);
    };
    /* Two routes rather than one: `/*` does not match the mount root itself,
     * and the root is the page. */
    instance.all('/', handler);
    instance.all('/*', handler);
  };
}
