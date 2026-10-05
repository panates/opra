import { type DynamicModule, Logger, Module, type Type } from '@nestjs/common';
import type { ApiDocumentFactory } from '@opra/common';
import type { HttpAdapter } from '@opra/http';
import { OpraHttpCoreModule } from './opra-http-core.module.js';

export namespace OpraHttpModule {
  /**
   * Synchronous configuration options for OpraHttpModule.
   */
  export interface ModuleOptions extends BaseModuleOptions, ApiConfig {}

  /**
   * Asynchronous configuration options for OpraHttpModule.
   */
  export interface AsyncModuleOptions extends BaseModuleOptions {
    /** Providers to be injected into the factory function */
    inject?: any[];
    /** Factory function that returns the ApiConfig object asynchronously */
    useFactory?: (...args: any[]) => Promise<ApiConfig> | ApiConfig;
  }

  /**
   * Base configuration options for the module.
   */
  interface BaseModuleOptions extends Pick<
    DynamicModule,
    'imports' | 'providers' | 'exports' | 'controllers' | 'global'
  > {
    /** Custom token for the module */
    token?: any;
    /** Base path for the API */
    basePath?: string;
    /** Whether the API schema is public */
    schemaIsPublic?: boolean;
    /** Interceptor list for the HTTP adapter */
    interceptors?: (
      | HttpAdapter.InterceptorFunction
      | HttpAdapter.IHttpInterceptor
      | Type<HttpAdapter.IHttpInterceptor>
    )[];
    /** Whether to publish the native Opra schema at `GET $schema` (and
     *  accept `$bundle` multipart batch requests). @default true */
    schema?: HttpAdapter.Options['schema'];
    /** Whether to publish an OpenAPI 3.0/3.1 mapping at `GET $openapi`.
     *  Requires the optional `@opra/openapi` package. @default false */
    openapi?: HttpAdapter.Options['openapi'];
    /** Whether to publish the interactive API reference UI (`@opra/api-ui`).
     *  Requires the optional `@opra/api-ui` package; only works when this
     *  application runs on the Express platform. @default false */
    apiUi?: HttpAdapter.Options['apiUi'];
    /** Whether that page also publishes the documentation studio, reached
     *  by the button in its header and by `?edit=1`. Requires `apiUi`, and
     *  a document whose `translationStore` can be written to — see
     *  `ApiConfig.translationStore`. A write endpoint with no
     *  authentication of its own; off by default. @default false */
    enableStudio?: HttpAdapter.Options['enableStudio'];
    /**
     * Which NestJS platform this application runs on.
     *
     * Only the reference UI needs to know, and only because the two routers
     * will not accept the same wildcard: Express 5 registers `*splat` and
     * refuses a bare `*`, Fastify registers `*` and refuses the named form.
     * The routes are built while the module is being defined, before there
     * is an `HttpAdapterHost` to ask, so an application running on
     * `@nestjs/platform-fastify` states it here.
     *
     * @default 'express'
     */
    platform?: 'express' | 'fastify';
  }

  /**
   * OPRA API configuration details.
   */
  export interface ApiConfig extends Pick<
    ApiDocumentFactory.InitArguments,
    | 'types'
    | 'references'
    | 'info'
    /* Where this API's documentation texts come from, and which language
     * answers when a request asks for one there is no bundle for. Without
     * these a module could only ever publish what its decorators declare —
     * and `enableStudio` had nowhere to write, since the studio writes
     * through the store the document reads from. */
    | 'translations'
    | 'translationStore'
    | 'defaultLanguage'
  > {
    /** API name */
    name: string;
    /** API description */
    description?: string;
    /** API scope */
    scope?: string;
    /** Logger to be used */
    logger?: Logger;
  }
}

/**
 * OpraHttpModule
 *
 * Module that integrates OPRA HTTP support into the NestJS application.
 */
@Module({})
export class OpraHttpModule {
  /**
   * Configures the module synchronously and imports it at the root level.
   *
   * @param init - Module configuration options.
   * @returns {DynamicModule} NestJS dynamic module.
   */
  static forRoot(init: OpraHttpModule.ModuleOptions): DynamicModule {
    return {
      module: OpraHttpModule,
      imports: [OpraHttpCoreModule.forRoot(init)],
    };
  }

  /**
   * Configures the module asynchronously and imports it at the root level.
   *
   * @param options - Asynchronous module configuration options.
   * @returns {DynamicModule} NestJS dynamic module.
   */
  static forRootAsync(
    options: OpraHttpModule.AsyncModuleOptions,
  ): DynamicModule {
    return {
      module: OpraHttpModule,
      imports: [OpraHttpCoreModule.forRootAsync(options)],
    };
  }
}
