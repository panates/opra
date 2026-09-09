import type { DataType } from '@opra/common';
import type { OpenApi } from './types/openapi.types.js';

/**
 * Shared, mutable state threaded through every mapper call while generating
 * a single OpenAPI document: the target version, the `components.schemas`
 * map being filled in, name-collision bookkeeping for `$ref`s, and warnings
 * collected for OPRA constructs that have no exact OpenAPI equivalent.
 */
export class OpenApiGenerateContext {
  readonly version: '3.0' | '3.1';
  readonly scope?: string;
  readonly schemas: Record<string, OpenApi.SchemaObject> = {};
  readonly warnings: string[] = [];
  private readonly _schemaNames = new Map<DataType, string>();
  private readonly _namesInUse = new Set<string>();

  constructor(options?: { version?: '3.0' | '3.1'; scope?: string }) {
    this.version = options?.version || '3.0';
    this.scope = options?.scope;
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Returns the `$ref`-safe component name for a named DataType, registering
   * it (and reserving the name) on first use. Anonymous types (no `.name`)
   * return `undefined` — callers should inline those instead of referencing.
   */
  getSchemaName(dataType: DataType): string | undefined {
    if (!dataType.name) return undefined;
    const existing = this._schemaNames.get(dataType);
    if (existing) return existing;
    let name = dataType.name;
    let i = 1;
    while (this._namesInUse.has(name)) {
      name = `${dataType.name}${++i}`;
    }
    this._namesInUse.add(name);
    this._schemaNames.set(dataType, name);
    return name;
  }

  hasSchema(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.schemas, name);
  }
}
