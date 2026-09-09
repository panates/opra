import type { HttpController, HttpParameter } from '@opra/common';
import type { OpenApiGenerateContext } from '../context.js';
import type { OpenApi } from '../types/openapi.types.js';
import { mapHttpOperation } from './http-operation.mapper.js';
import { mapHttpParameter } from './http-parameter.mapper.js';

/** OPRA path templates use Express-style `:name` tokens; OpenAPI uses
 * `{name}`. The literal `@` OPRA uses to join a collection path with its
 * key parameter (e.g. `Customers@:id`) is a real path character in both,
 * so it's left untouched. */
function toOpenApiPath(rawPath: string): string {
  return rawPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/**
 * Walks a controller tree (including nested sub-controllers) and fills
 * `paths` with every operation's OpenAPI Path Item.
 *
 * `.PathParam()`/`.KeyParam()` declared on a controller (e.g. the `:id` in
 * `Customers@:id`) land on `HttpController.parameters`, not on each
 * operation — so they're threaded down through `inheritedParams` and
 * merged onto every operation under that controller (and its
 * sub-controllers), rather than being missed entirely.
 */
export function mapHttpControllers(
  controllers: Iterable<HttpController>,
  ctx: OpenApiGenerateContext,
  paths: Record<string, OpenApi.PathItemObject>,
  inheritedParams: HttpParameter[] = [],
): void {
  for (const controller of controllers) {
    const ownParams = [...inheritedParams, ...controller.parameters];

    for (const operation of controller.operations.values()) {
      const mapped = mapHttpOperation(operation, ctx);
      if (!mapped) continue;

      const controllerParams = ownParams
        .map(p => mapHttpParameter(p, ctx))
        .filter((p): p is OpenApi.ParameterObject => !!p);
      if (controllerParams.length) {
        const existing = new Set(
          (mapped.operation.parameters || []).map(p => `${p.in}:${p.name}`),
        );
        mapped.operation.parameters = [
          ...controllerParams.filter(p => !existing.has(`${p.in}:${p.name}`)),
          ...(mapped.operation.parameters || []),
        ];
      }

      const path = toOpenApiPath(operation.getFullUrl());
      const pathItem = (paths[path] ||= {});
      if (pathItem[mapped.method]) {
        ctx.warn(
          `Multiple operations resolve to "${mapped.method.toUpperCase()} ${path}" — ` +
            `the earlier one was overwritten`,
        );
      }
      pathItem[mapped.method] = mapped.operation;
    }

    if (controller.controllers.size) {
      mapHttpControllers(
        controller.controllers.values(),
        ctx,
        paths,
        ownParams,
      );
    }
  }
}
