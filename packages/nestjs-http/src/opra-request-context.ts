import type { ExecutionContext } from '@nestjs/common';
import type { HttpAdapter, HttpContext } from '@opra/http';
import { kOpraContexts, OPRA_HTTP_ADAPTER } from './constants.js';

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

/**
 * The `HttpContext` of the module whose route this request matched, for
 * a NestJS guard, interceptor, filter or pipe.
 *
 * A guard runs *before* the handler, and it is the handler that settles
 * which of the request's contexts is the active one. Until then
 * `req.opraContext` is whichever module's middleware happened to run
 * last — so with two modules a guard writing `ctx.user` wrote it to the
 * other API's context, and the handler then saw no user. The controller
 * class knows better: it carries the adapter that built it.
 *
 * Use this rather than reading `req.opraContext` directly:
 *
 * ```ts
 * @Injectable()
 * export class AuthGuard implements CanActivate {
 *   canActivate(executionContext: ExecutionContext) {
 *     const ctx = getOpraContext(executionContext);
 *     if (ctx) ctx.user = ...;
 *     return true;
 *   }
 * }
 * ```
 *
 * With one module the two are the same, so this is safe either way.
 *
 * @param executionContext - The NestJS execution context.
 * @returns The context built for this route's own adapter, or the active
 *   one where the route is not an OPRA controller's.
 */
export function getOpraContext(
  executionContext: ExecutionContext,
): HttpContext | undefined {
  const _req = executionContext.switchToHttp().getRequest();
  const controllerClass = executionContext.getClass?.();
  const adapter: HttpAdapter | undefined = controllerClass
    ? Reflect.getMetadata(OPRA_HTTP_ADAPTER, controllerClass)
    : undefined;
  return adapter ? getRequestContext(_req, adapter) : getActiveContext(_req);
}
