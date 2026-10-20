export const OPRA_HTTP_API_CONFIG = 'OPRA_HTTP_API_CONFIG';

/**
 * Module-local injection token for the adapter a given `OpraHttpModule`
 * created.
 *
 * Injecting `OpraHttpNestjsAdapter` by class only ever worked while there
 * was one module: the class is the *default* value of `ModuleOptions.token`,
 * so a module configured with a `token` of its own registers no provider
 * under the class at all. Its middleware, its `onModuleDestroy` and its
 * exception filter would then resolve some *other* module's adapter — the
 * core module is `@Global()`, so the first one's leaks everywhere — or
 * throw outright when no module used the default token.
 *
 * Each dynamic module registers this symbol as `useExisting: <its token>`
 * in its own `providers` (never in `exports`), so a module-local lookup
 * always finds that module's own adapter and never another's.
 */
export const OPRA_HTTP_ADAPTER = Symbol('OPRA_HTTP_ADAPTER');

/**
 * Where a request's `HttpContext`s live, keyed by the adapter that built
 * each one.
 *
 * `req.opraContext` is a single slot, and `OpraMiddleware` is applied to
 * every route (a module does not know which paths belong to it). With two
 * modules both middlewares run on every request and the second overwrites
 * the first, so a handler of API *A* could be given a context built by
 * adapter *B* — wrong document, no operation, and an error path that
 * answered 500 instead of the status the error carries.
 *
 * A map keyed by adapter has a slot per module, so each handler finds the
 * context its own adapter built. `req.opraContext` is still written, as
 * the *active* context, for everything that reads it (including code
 * outside this package).
 */
export const kOpraContexts = Symbol.for('opra.nestjs.http.contexts');
