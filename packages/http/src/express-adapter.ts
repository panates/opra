import * as nodePath from 'node:path';
import {
  ApiDocument,
  HttpApi,
  HttpController,
  NotFoundError,
} from '@opra/common';
import {
  type Application,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  Router,
} from 'express';
import http from 'http';
import { HttpAdapter } from './http-adapter.js';
import { HttpBundle } from './http-bundle.js';
import { HttpRequest } from './interfaces/http-request.interface.js';
import { HttpResponse } from './interfaces/http-response.interface.js';

/**
 * ExpressAdapter is a platform adapter for the Express.js framework.
 * It integrates Opra with Express applications and routers.
 */
export class ExpressAdapter extends HttpAdapter {
  readonly app: Application;
  protected _controllerInstances = new Map<HttpController, any>();

  constructor(
    app: Application,
    document: ApiDocument,
    options?: HttpAdapter.Options,
  ) {
    super(options);
    this.app = app;
    if (!(document.api instanceof HttpApi))
      throw new TypeError(`The document does not expose an HTTP Api`);
    this._document = document;
    for (const c of this.api.controllers.values()) this._createControllers(c);
    this._initRouter();
  }

  get platform(): string {
    return 'express';
  }

  /**
   * Closes the adapter and performs cleanup.
   *
   * @returns A promise that resolves when the adapter is closed.
   */
  async close() {
    const processInstance = async (controller: HttpController) => {
      if (controller.controllers.size) {
        const subResources = Array.from(controller.controllers.values());
        subResources.reverse();
        for (const subResource of subResources) {
          await processInstance(subResource);
        }
      }
    };
    for (const c of this.api.controllers.values()) await processInstance(c);
    this._controllerInstances.clear();
  }

  /**
   * Retrieves a controller instance by its path.
   *
   * @param controllerPath - The path of the controller.
   * @returns The controller instance, or undefined if not found.
   */
  getControllerInstance<T>(controllerPath: string): T | undefined {
    const controller = this.api.findController(controllerPath);
    return controller && this._controllerInstances.get(controller);
  }

  protected _initRouter() {
    const router = Router();
    this.app.use(this.basePath, router);

    /* Add an endpoint that returns document schema */
    if (this.schema) {
      router.get('/\\$schema', (_req, _res, next) => {
        this.createContext(_req, _res)
          .then(ctx => this.sendDocumentSchema(ctx).catch(next))
          .catch(next);
      });
    }

    /* Add an endpoint that returns an OpenAPI mapping of the document —
     * lazily loads `@opra/openapi` (see `sendOpenApiDocument`), so this
     * costs nothing when `this.openapi` is left disabled (the default). */
    if (this.openapi) {
      router.get('/\\$openapi', (_req, _res, next) => {
        this.createContext(_req, _res)
          .then(ctx => this.sendOpenApiDocument(ctx).catch(next))
          .catch(next);
      });
    }

    /* Mount the interactive API reference UI (`@opra/api-ui`) — lazily
     * imported on the *first actual request* to this path, not here at
     * construction time, since `expressApiUi()` needs to run synchronously
     * to produce an Express handler but the import itself is async. Once
     * resolved, the real handler is cached in `apiUiHandler` and every
     * later request (to this or any of its own sub-routes, e.g.
     * `$docs/schema/root.json`) is served directly. */
    if (this.apiUi) {
      const { path: apiUiPath, ...apiUiOptions } =
        typeof this.apiUi === 'object' ? this.apiUi : {};
      let apiUiHandler: RequestHandler | undefined;
      router.use(apiUiPath || '/$docs', (_req, _res, next) => {
        if (apiUiHandler) {
          apiUiHandler(_req, _res, next);
          return;
        }
        import('@opra/api-ui')
          .then(({ expressApiUi }) => {
            apiUiHandler = expressApiUi(this.document, {
              scope: this.scope,
              ...apiUiOptions,
            });
            apiUiHandler(_req, _res, next);
          })
          .catch(() => {
            _res.status(501).json({
              error:
                'The API reference UI requires the "@opra/api-ui" package to be installed',
            });
          });
      });
    }

    /* Add an endpoint that returns document schema */
    router.post('/\\$bundle', (_req, _res, next) => {
      Promise.resolve()
        .then(async () => {
          const bundle = new HttpBundle({
            __adapter: this,
            platform: _req.route ? 'express' : 'fastify',
            request: HttpRequest.create(_req),
            response: HttpResponse.create(_res),
          });
          await this.emitAsync('create-bundle', bundle);
          await this.handleBundle(bundle);
        })
        .catch(next);
    });

    /* Add operation endpoints */
    if (this.api.controllers.size) {
      const processResource = (
        controller: HttpController,
        currentPath: string,
      ) => {
        currentPath = nodePath.posix.join(currentPath, controller.path);
        for (const operation of controller.operations.values()) {
          /* `mergePath` operations continue the controller's own last path
           * segment rather than starting a new one (`Customers` +
           * `@:customerId`), which is why this can't always be a plain
           * `join`; everything else is a child segment and needs the
           * separator a bare concatenation doesn't add. Same rule as
           * `HttpOperation#getFullUrl()` and the NestJS adapter. */
          const routePath = operation.mergePath
            ? currentPath + (operation.path || '')
            : nodePath.posix.join(currentPath, operation.path || '');
          const controllerInstance = this._controllerInstances.get(controller);
          const operationHandler = controllerInstance[operation.name];
          if (!operationHandler) continue;
          /* Define router callback */
          router[operation.method.toLowerCase()](
            routePath,
            (_req: Request, _res: Response, _next: NextFunction) => {
              this.createContext(_req, _res, {
                controller,
                controllerInstance,
                operation,
                operationHandler,
              })
                .then(ctx => this.handleRequest(ctx))
                .then(() => {
                  if (!_res.headersSent) _next();
                })
                .catch((e: unknown) => this.emit('error', e));
            },
          );
        }
        if (controller.controllers.size) {
          for (const child of controller.controllers.values())
            processResource(child, currentPath);
        }
      };
      for (const c of this.api.controllers.values()) processResource(c, '/');
    }

    /* Add an endpoint that returns 404 error at last */
    router.use(
      '/{*splat}',
      (_req: Request, _res: Response, next: NextFunction) => {
        this.createContext(_req, _res)
          .then(ctx => {
            ctx.errors.push(
              new NotFoundError({
                message: `No endpoint found at [${_req.method}]${_req.baseUrl}`,
                details: {
                  path: _req.baseUrl,
                  method: _req.method,
                },
              }),
            );
            this.sendResponse(ctx).catch(next);
          })
          .catch(next);
      },
    );
  }

  protected _createControllers(controller: HttpController): void {
    let instance = controller.instance;
    if (!instance && controller.ctor) instance = new controller.ctor();
    if (instance) {
      this._controllerInstances.set(controller, instance);
      // Initialize sub resources
      for (const r of controller.controllers.values()) {
        this._createControllers(r);
      }
    }
    return instance;
  }

  handleRawRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      res.once('finish', resolve);
      res.once('error', reject);
      this.app(req, res);
    });
  }
}
