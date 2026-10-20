import type { HttpAdapter, HttpContext } from '@opra/http';
import { kOpraContexts } from './constants.js';

/**
 * The object a context is stored on.
 *
 * Express hands the middleware and the route handler the same request;
 * Fastify does not — middleware runs on the `node:http` request and a
 * handler is given Fastify's wrapper around it, one `.raw` away. Both
 * sides go through here so neither has to remember which it is holding.
 */
function slotsOf(_req: any): any {
  return _req?.raw ?? _req;
}

/**
 * Records the context `adapter` built for this request, and makes it the
 * active one.
 *
 * Keyed by adapter, because every `OpraHttpModule` applies its middleware
 * to every route: with two modules the single `opraContext` slot holds
 * whichever middleware ran last, which is not necessarily the one whose
 * controller is about to handle the request. See {@link kOpraContexts}.
 */
export function setRequestContext(
  _req: any,
  adapter: HttpAdapter,
  context: HttpContext,
): void {
  const slots = slotsOf(_req);
  if (!slots) return;
  let map: Map<HttpAdapter, HttpContext> | undefined = slots[kOpraContexts];
  if (!map) {
    map = new Map();
    Object.defineProperty(slots, kOpraContexts, {
      value: map,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  map.set(adapter, context);
  /* The last one to run stays the active context, as it was before there
   * was a map — the handler below replaces it with its own. */
  slots.opraContext = context;
}

/**
 * The context `adapter` built for this request, if it built one.
 *
 * Falls back to the active context when it belongs to this adapter (or
 * when nothing recorded an owner at all), so a context put there by
 * anything other than {@link setRequestContext} still works.
 */
export function getRequestContext(
  _req: any,
  adapter: HttpAdapter,
): HttpContext | undefined {
  const slots = slotsOf(_req);
  const own = (slots?.[kOpraContexts] as Map<HttpAdapter, HttpContext>)?.get(
    adapter,
  );
  if (own) return own;
  const active = slots?.opraContext as HttpContext | undefined;
  if (active && (!active.__adapter || active.__adapter === adapter))
    return active;
  return undefined;
}

/**
 * Marks `context` as the one this request is actually being handled with,
 * so whatever runs after the handler — the exception filter above all —
 * reads the right document and the right adapter.
 */
export function setActiveContext(_req: any, context: HttpContext): void {
  const slots = slotsOf(_req);
  if (slots) slots.opraContext = context;
}

/** The active context, whichever of the two shapes the request has. */
export function getActiveContext(_req: any): HttpContext | undefined {
  return _req?.opraContext ?? _req?.raw?.opraContext;
}
