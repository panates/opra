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
  }

  /**
   * OPRA API configuration details.
   */
  export interface ApiConfig extends Pick<
    ApiDocumentFactory.InitArguments,
    'types' | 'references' | 'info'
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
