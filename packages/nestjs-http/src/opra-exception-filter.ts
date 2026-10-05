import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter, ModuleRef } from '@nestjs/core';
import { OpraHttpNestjsAdapter } from './opra-http-nestjs-adapter.js';

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
    const ctx = req?.opraContext ?? req?.raw?.opraContext;
    if (ctx) {
      const adapter = this.moduleRef.get(OpraHttpNestjsAdapter);
      ctx.errors.push(exception);
      return adapter.sendResponse(ctx);
    }
    super.catch(exception, host);
  }
}
