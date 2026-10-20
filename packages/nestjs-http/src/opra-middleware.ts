import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { HttpRequest, HttpResponse } from '@opra/http';
import type { NextFunction, Request, Response } from 'express';
import { OPRA_HTTP_ADAPTER } from './constants.js';
import type { OpraHttpNestjsAdapter } from './opra-http-nestjs-adapter.js';
import { setRequestContext } from './opra-request-context.js';

/**
 * OpraMiddleware
 *
 * NestJS middleware that creates an OPRA context (HttpContext) for each HTTP request
 * and adds it to the request.
 */
@Injectable()
export class OpraMiddleware implements NestMiddleware {
  /**
   * The adapter of the module this middleware was applied by — resolved
   * through the module-local {@link OPRA_HTTP_ADAPTER} token rather than
   * by class, which with several modules would hand every one of them the
   * first module's adapter.
   */
  constructor(
    @Inject(OPRA_HTTP_ADAPTER) protected opraAdapter: OpraHttpNestjsAdapter,
  ) {}

  /**
   * Processes requests and creates the OPRA context.
   *
   * @param req - Express request object.
   * @param res - Express response object.
   * @param next - Function that calls the next middleware.
   */
  use(req: Request, res: Response, next: NextFunction) {
    const request = HttpRequest.create(req);
    const response = HttpResponse.create(res);
    this.opraAdapter
      .createContext(request, response)
      .then(async context => {
        // @ts-ignore
        context.platform = req.route ? 'express' : 'fastify';
        /* Keyed by adapter: every module's middleware runs on every route,
         * so a single slot would only ever hold the last one's context. */
        setRequestContext(req, this.opraAdapter, context);
        await this.opraAdapter
          .emitAsync('createContext', context)
          .then(() => next());
      })
      .catch(next);
  }
}
