import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter, ModuleRef } from '@nestjs/core';
import { OPRA_HTTP_ADAPTER } from './constants.js';
import { OpraHttpNestjsAdapter } from './opra-http-nestjs-adapter.js';
import { getActiveContext, getRequestContext } from './opra-request-context.js';

/**
 * OpraExceptionFilter
 *
 * NestJS exception filter that catches errors during OPRA HTTP requests
 * and returns responses according to OPRA standards.
 */
@Catch()
export class OpraExceptionFilter extends BaseExceptionFilter {
  constructor(private moduleRef: ModuleRef) {
    super();
  }

  /**
   * Processes the caught exception.
   * If the request has an OPRA context, it responds by converting the error to the OPRA error format.
   * Otherwise, it uses the default NestJS exception handling mechanism.
   *
   * @param exception - The caught exception object.
   * @param host - The arguments host.
   */
  catch(exception: any, host: ArgumentsHost) {
    /* `.raw` for Fastify, where the middleware that built this context ran
     * on the `node:http` request rather than on the wrapper a handler sees. */
    const req = host.switchToHttp().getRequest();
    const adapter = this._resolveAdapter(host, req);
    /* The context this adapter built, not merely the last one written: a
     * second module's middleware runs on this route too and would
     * otherwise be the one answering, with its own (wrong) document. */
    const ctx =
      (adapter && getRequestContext(req, adapter)) || getActiveContext(req);
    if (ctx && adapter) {
      ctx.errors.push(exception);
      return adapter.sendResponse(ctx);
    }
    super.catch(exception, host);
  }

  /**
   * The adapter that owns the route this request hit.
   *
   * Taken from the controller class first, because that is known even when
   * nothing of ours has run yet — a global guard rejecting the request
   * throws before any handler, and the request then carries one context
   * per module with nothing to say which module's route was matched.
   *
   * `moduleRef.get()` is the last resort and no longer the first: it looks
   * only in the module hosting *this* filter instance, and a module
   * configured with a `token` of its own registers nothing under the
   * adapter class — the lookup threw, and that throw (inside `catch`) was
   * itself the 500 that replaced the status the error carried.
   */
  protected _resolveAdapter(
    host: ArgumentsHost,
    req: any,
  ): OpraHttpNestjsAdapter | undefined {
    /* `getClass` belongs to `ExecutionContext`; an `ArgumentsHost` that
     * came from a route, a guard or an interceptor is one, and the
     * optional call covers the hosts that are not. */
    const controllerClass = (host as any).getClass?.();
    if (controllerClass) {
      const owner = Reflect.getMetadata(OPRA_HTTP_ADAPTER, controllerClass);
      if (owner) return owner;
    }
    const active = getActiveContext(req);
    if (active?.__adapter) return active.__adapter as OpraHttpNestjsAdapter;
    try {
      return this.moduleRef.get(OpraHttpNestjsAdapter, { strict: false });
    } catch {
      return undefined;
    }
  }
}
