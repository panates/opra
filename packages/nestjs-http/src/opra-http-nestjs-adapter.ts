import * as http from 'node:http';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import nodePath from 'node:path';
import { isConstructor } from '@jsopen/objects';
import {
  All,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  Next,
  Options,
  Patch,
  Post,
  Put,
  Req,
  Res,
  Search,
  type Type,
} from '@nestjs/common';
import {
  HTTP_CONTROLLER_METADATA,
  HttpApi,
  HttpController,
  HttpOperation,
  NotFoundError,
} from '@opra/common';
import {
  HttpAdapter,
  HttpBundle,
  HttpContext,
  HttpRequest,
  HttpResponse,
} from '@opra/http';
import { OpraNestUtils, Public } from '@opra/nestjs';
import { asMutable } from 'ts-gems';

/**
 * OpraHttpNestjsAdapter
 *
 * HTTP adapter used to integrate OPRA APIs with the NestJS framework.
 * This adapter converts OPRA controllers into NestJS controllers and
 * exports the OPRA documentation ($schema).
 */
export class OpraHttpNestjsAdapter extends HttpAdapter {
  /** List of controller classes to be registered with NestJS */
  readonly nestControllers: Type[] = [];
  /** Platform identifier */
  readonly platform = 'nestjs';
  /**
   * Which HTTP platform NestJS is running on, because the two do not accept
   * the same route patterns and the reference UI needs a wildcard.
   *
   * Measured: Express 5 registers `/$docs/*splat` and refuses a bare `*`
   * (`Missing parameter name`); Fastify registers `/$docs/*` and refuses the
   * named form (`Wildcard must be the last character in the route`). One
   * pattern cannot serve both, and routes are built here in the constructor -
   * long before `HttpAdapterHost` exists to be asked - so the application
   * states it.
   */
  readonly httpPlatform: 'express' | 'fastify';

  /**
   * Creates a new instance of OpraHttpNestjsAdapter.
   *
   * @param options - Adapter configuration options.
   */
  constructor(
    options: HttpAdapter.Options & {
      /** Indicates whether the schema is public */
      schemaIsPublic?: boolean;
      /** Manually added NestJS controllers */
      controllers?: Type[];
      /** Which NestJS platform this application runs on. @default 'express' */
      platform?: 'express' | 'fastify';
    },
  ) {
    super(options);
    this.httpPlatform = options.platform || 'express';
    this._addRootController(options.schemaIsPublic);
    /* Disable default error handler. Errors will be handled by OpraExceptionFilter */
    this.on('error', (error: Error) => {
      throw error;
    });
    if (options.controllers) {
      for (const c of options.controllers) {
        this._addToNestControllers(c, this.basePath, []);
      }
    }
  }

  /**
   * Closes the adapter.
   * @returns {Promise<void>}
   */
  async close() {
    //
  }

  async createContext(
    _req: any,
    _res: any,
    args?: {
      controller?: HttpController;
      controllerInstance?: any;
      operation?: HttpOperation;
      operationHandler: Function;
    },
  ): Promise<HttpContext> {
    const ctx = await super.createContext(_req, _res, args);
    // @ts-ignore
    ctx.platform = _req.route ? 'express' : 'fastify';
    return ctx;
  }

  protected _httpHandler?: (req: IncomingMessage, res: ServerResponse) => void;

  setHttpHandler(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): void {
    this._httpHandler = handler;
  }

  async handleRawRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (!this._httpHandler)
      throw new Error(
        'HTTP handler is not initialized. Call setHttpHandler() first.',
      );
    return new Promise<void>((resolve, reject) => {
      res.once('finish', resolve);
      res.once('error', reject);
      this._httpHandler!(req, res);
    });
  }

  /**
   * Adds the root controller that serves the OPRA schema, OpenAPI mapping
   * and the reference UI, and accepts `$bundle` multipart batch requests —
   * the NestJS counterpart of `ExpressAdapter._initRouter()`.
   *
   * `$schema` and `$openapi` are added via `Object.defineProperty` +
   * imperative decorator calls (`Get(path)(prototype, key, descriptor)`)
   * rather than `@Get()` literal syntax, since whether they exist at all
   * depends on `this.schema`/`this.openapi` — the same technique
   * `_addToNestControllers` below already uses to attach one HTTP-method
   * decorator per operation depending on its own `method`. `$bundle`
   * stays a plain literal method — it's unconditional, same as in
   * `ExpressAdapter`.
   *
   * @param isPublic - Whether the schema is accessible without authentication.
   * @protected
   */
  protected _addRootController(isPublic?: boolean) {
    const _this = this;
    /* The context `OpraMiddleware` built for this request.
     *
     * Express hands the middleware and the route handler the same request
     * object, so it is simply there. Fastify does not: middleware runs on
     * the `node:http` request, a route handler is given Fastify's own
     * wrapper around it, and what the middleware wrote is one `.raw` away.
     * Reading it wrong is silent - the handler is called with `undefined`
     * and the request is never answered at all. */
    const contextOf = (_req: any) =>
      _req?.opraContext ?? _req?.raw?.opraContext;
    /* `$` is a reserved character in Express 5's path syntax and has to be
     * escaped; Fastify's router has no such syntax and would take the
     * backslash literally, so `/\$schema` there is a path with a backslash
     * in it and nothing ever matches it. Same split as the wildcard above. */
    const $ = this.httpPlatform === 'fastify' ? '$' : '\\$';

    @Controller({
      path: this.basePath,
    })
    class RootController {
      @HttpCode(200)
      bundle(@Req() _req: any, @Res() _res, @Next() next: Function) {
        Promise.resolve()
          .then(async () => {
            const bundle = new HttpBundle({
              __adapter: _this,
              platform: _req.route ? 'express' : 'fastify',
              request: HttpRequest.create(_req),
              response: HttpResponse.create(_res),
            });
            await _this.emitAsync('create-bundle', bundle);
            await _this.handleBundle(bundle);
          })
          .catch(() => next());
      }
    }
    /* Registered imperatively like the two below it, because its path now
     * depends on the platform. */
    Post('/' + $ + 'bundle')(
      RootController.prototype,
      'bundle',
      Object.getOwnPropertyDescriptor(RootController.prototype, 'bundle')!,
    );

    if (this.schema) {
      Object.defineProperty(RootController.prototype, 'schema', {
        writable: true,
        configurable: true,
        value(_req: any, next: Function) {
          _this.sendDocumentSchema(contextOf(_req)).catch(() => next());
        },
      });
      Req()(RootController.prototype, 'schema', 0);
      Next()(RootController.prototype, 'schema', 1);
      const schemaDescriptor = Object.getOwnPropertyDescriptor(
        RootController.prototype,
        'schema',
      )!;
      Get('/' + $ + 'schema')(
        RootController.prototype,
        'schema',
        schemaDescriptor,
      );
      if (isPublic) {
        Public()(RootController.prototype, 'schema', schemaDescriptor);
      }
    }

    if (this.openapi) {
      Object.defineProperty(RootController.prototype, 'openapi', {
        writable: true,
        configurable: true,
        value(_req: any, next: Function) {
          _this.sendOpenApiDocument(contextOf(_req)).catch(() => next());
        },
      });
      Req()(RootController.prototype, 'openapi', 0);
      Next()(RootController.prototype, 'openapi', 1);
      const openapiDescriptor = Object.getOwnPropertyDescriptor(
        RootController.prototype,
        'openapi',
      )!;
      Get('/' + $ + 'openapi')(
        RootController.prototype,
        'openapi',
        openapiDescriptor,
      );
    }

    if (this.apiUi) this._addApiUiRoutes(RootController);

    this.nestControllers.push(RootController);
  }

  /**
   * Adds two wildcard routes forwarding into `@opra/api-ui`'s
   * `expressApiUi()` — a plain Express `(req, res, next) => void` handler
   * that expects to be mounted the way `ExpressAdapter` mounts it, via
   * `router.use(path, handler)`: it reads `req.path` relative to, and
   * `req.baseUrl` as, its own mount point. NestJS controller routes get
   * neither for free (unlike Express's own `.use()`, a Nest/Express route
   * match — even a wildcard `@All()` one — never rewrites `req.url`/
   * `req.baseUrl`), so this reconstructs both by hand from the *known*
   * matched suffix (`req.params.splat`, populated by the `/*splat`
   * wildcard below) rather than trying to predict the mount point's own
   * absolute path up front — which would otherwise have to account for
   * Nest's global prefix, versioning, etc. Subtracting the (known)
   * suffix's length off the end of `req.path` yields the real absolute
   * mount path regardless of any of that.
   *
   * Works on both platforms. What differs is what each router will accept
   * and what each hands a handler: the wildcard's spelling, whether the
   * mount prefix is stripped from the url (neither does, here - a Nest route
   * is not an Express `.use()`), and whether the framework still intends to
   * send a reply of its own afterwards. `serveApiUi` is written against the
   * `node:http` request and response underneath both.
   *
   * @protected
   */
  protected _addApiUiRoutes(RootController: Type) {
    const _this = this;
    const { path: apiUiPathOpt, ...apiUiOptions } =
      typeof this.apiUi === 'object' ? this.apiUi : ({} as any);
    const apiUiPath = String(apiUiPathOpt || '$docs').replace(/^\/+/, '');
    let apiUiHandler:
      ((req: any, res: any, basePath?: string) => void) | undefined;

    const serve = (
      _req: any,
      _res: any,
      next: any,
      mountPath: string,
      remainder: string,
    ) => {
      /* The `node:http` request and response underneath whichever framework
       * object NestJS handed us. Fastify wraps both; Express's own are those
       * objects. */
      const raw = _req.raw || _req;
      const rawRes = _res.raw || _res;
      /* Fastify still means to serialize a reply of its own after the
       * handler returns; this says the socket is answered already. Express
       * needs nothing, because `@Res()` alone puts Nest in library mode. */
      if (typeof _res.hijack === 'function') _res.hijack();
      /* The body, when something already parsed it - Fastify always does,
       * and Nest installs a parser on Express by default. A parser leaves
       * the stream consumed, so the studio's save route would wait for bytes
       * that never arrive. */
      if (_req.body !== undefined) raw.body = _req.body;
      let newUrl = remainder.charAt(0) === '/' ? remainder : '/' + remainder;
      const qIdx = String(raw.url).indexOf('?');
      if (qIdx !== -1) newUrl += String(raw.url).slice(qIdx);
      raw.url = newUrl;
      if (apiUiHandler) {
        apiUiHandler(raw, rawRes, mountPath);
        return;
      }
      import('@opra/api-ui')
        .then(({ serveApiUi }) => {
          const handler = serveApiUi(_this.document, {
            scope: _this.scope,
            studio: _this.enableStudio,
            ...apiUiOptions,
          });
          apiUiHandler = handler;
          handler(raw, rawRes, mountPath);
        })
        .catch((e: Error) => {
          /* The import failing and the page refusing to build are different
           * problems with different answers - a studio enabled for a
           * document whose translations cannot be written says so, and that
           * sentence is the whole fix. */
          _res.status(501).json({
            error:
              e?.message ||
              'The API reference UI requires the "@opra/api-ui" package to be installed',
          });
        });
    };

    Object.defineProperty(RootController.prototype, 'apiUiRoot', {
      writable: true,
      configurable: true,
      value(_req: any, _res: any, next: Function) {
        /* `req.path` is Express's; the raw url minus its query is both
         * frameworks'. At the mount root the remainder is just `/`. */
        const raw = _req.raw || _req;
        serve(_req, _res, next, String(raw.url).split('?')[0], '/');
      },
    });
    Req()(RootController.prototype, 'apiUiRoot', 0);
    Res()(RootController.prototype, 'apiUiRoot', 1);
    Next()(RootController.prototype, 'apiUiRoot', 2);
    All('/' + apiUiPath)(
      RootController.prototype,
      'apiUiRoot',
      Object.getOwnPropertyDescriptor(RootController.prototype, 'apiUiRoot')!,
    );

    Object.defineProperty(RootController.prototype, 'apiUiRest', {
      writable: true,
      configurable: true,
      value(_req: any, _res: any, next: Function) {
        /* Express 5 names its wildcard and hands back the segments;
         * Fastify's is anonymous and hands back the rest of the path whole. */
        const params = _req.params || {};
        const remainder =
          '/' +
          (Array.isArray(params.splat)
            ? params.splat.join('/')
            : params.splat || params['*'] || '');
        const raw = _req.raw || _req;
        const fullPath = String(raw.url).split('?')[0];
        const mountPath =
          fullPath.slice(0, fullPath.length - remainder.length) || '/';
        serve(_req, _res, next, mountPath, remainder);
      },
    });
    Req()(RootController.prototype, 'apiUiRest', 0);
    Res()(RootController.prototype, 'apiUiRest', 1);
    Next()(RootController.prototype, 'apiUiRest', 2);
    /* Spelled for whichever router will register it — see `httpPlatform`. */
    const wildcard = this.httpPlatform === 'fastify' ? '*' : '*splat';
    All('/' + apiUiPath + '/' + wildcard)(
      RootController.prototype,
      'apiUiRest',
      Object.getOwnPropertyDescriptor(RootController.prototype, 'apiUiRest')!,
    );
  }

  /**
   * Adds the specified class and its sub-controllers to the NestJS controller list.
   *
   * @param sourceClass - Source OPRA controller class.
   * @param currentPath - Current URL path.
   * @param parentTree - List of parent controller classes.
   * @protected
   * @throws {@link NotFoundError} Thrown when no suitable endpoint is found for the operation.
   * @throws {@link TypeError} Thrown when the controller is not a class.
   */
  protected _addToNestControllers(
    sourceClass: Type,
    currentPath: string,
    parentTree: Type[],
  ) {
    const metadata: HttpController.Metadata = Reflect.getMetadata(
      HTTP_CONTROLLER_METADATA,
      sourceClass,
    );
    if (!metadata) return;
    /* Create a new controller class */
    const newClass = {
      [sourceClass.name]: class extends sourceClass {},
    }[sourceClass.name];
    /* Copy metadata keys from source class to new one */
    OpraNestUtils.copyDecoratorMetadata(newClass, ...parentTree);
    Controller()(newClass);

    const newPath = metadata.path
      ? nodePath.posix.join(currentPath, metadata.path)
      : currentPath;
    const adapter = this;

    this.nestControllers.push(newClass);
    let metadataKeys: any[];
    if (metadata.operations) {
      for (const [k, v] of Object.entries(metadata.operations)) {
        const operationHandler = sourceClass.prototype[k];
        Object.defineProperty(newClass.prototype, k, {
          writable: true,
          /* NestJS handler method */
          async value(this: any, _req: any, _res) {
            _res.statusCode = 200;
            const api = adapter.document.api as HttpApi;
            const controller = api.findController(sourceClass);
            const operation = controller?.operations.get(k);
            const context = asMutable<HttpContext>(
              _req.opraContext ?? _req.raw?.opraContext,
            );
            if (!(
              context &&
              operation &&
              typeof operationHandler === 'function'
            )) {
              throw new NotFoundError({
                message: `No endpoint found for [${_req.method}]${_req.baseUrl}`,
                details: {
                  path: _req.baseUrl,
                  method: _req.method,
                },
              });
            }
            /* Configure the HttpContext */
            context.__docNode = operation.node;
            context.__oprDef = operation;
            context.__contDef = operation.owner;
            context.__controller = this;
            context.__handler = operationHandler;
            /* Handle request */
            await adapter.handleRequest(context);
          },
        });

        /* Copy metadata keys from source function to new one */
        metadataKeys = Reflect.getOwnMetadataKeys(operationHandler);
        const newFn = newClass.prototype[k];
        for (const key of metadataKeys) {
          const m = Reflect.getMetadata(key, operationHandler);
          Reflect.defineMetadata(key, m, newFn);
        }

        Req()(newClass.prototype, k, 0);
        Res()(newClass.prototype, k, 1);

        const descriptor = Object.getOwnPropertyDescriptor(
          newClass.prototype,
          k,
        )!;
        const operationPath = v.mergePath
          ? newPath + (v.path || '')
          : nodePath.posix.join(newPath, v.path || '');
        switch (v.method || 'GET') {
          case 'DELETE':
            /* Call @Delete decorator over new property */
            Delete(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'GET':
            /* Call @Get decorator over new property */
            Get(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'HEAD':
            /* Call @Head decorator over new property */
            Head(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'OPTIONS':
            /* Call @Options decorator over new property */
            Options(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'PATCH':
            /* Call @Patch decorator over new property */
            Patch(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'POST':
            /* Call @Post decorator over new property */
            Post(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'PUT':
            /* Call @Put decorator over new property */
            Put(operationPath)(newClass.prototype, k, descriptor);
            break;
          case 'SEARCH':
            /* Call @Search decorator over new property */
            Search(operationPath)(newClass.prototype, k, descriptor);
            break;
          default:
            break;
        }
      }
    }
    if (metadata.controllers) {
      for (const child of metadata.controllers) {
        if (!isConstructor(child))
          throw new TypeError('Controllers should be injectable a class');
        this._addToNestControllers(child, newPath, [
          ...parentTree,
          sourceClass,
        ]);
      }
    }
  }
}
