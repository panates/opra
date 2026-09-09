/**
 * Minimal OpenAPI 3.0 / 3.1 type definitions — only the shapes this package
 * actually emits, not a full spec model. The two versions differ in very
 * few places that matter here (nullable representation, the `openapi`
 * version string, `jsonSchemaDialect`), so a single shared `SchemaObject`
 * shape is used rather than duplicating near-identical interfaces per
 * version — see `mappers/data-type.mapper.ts` for where the two diverge.
 */
export namespace OpenApi {
  export type SchemaType =
    'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

  export interface SchemaObject {
    $ref?: string;
    type?: SchemaType | SchemaType[];
    format?: string;
    description?: string;
    default?: any;
    example?: any;
    examples?: any[];
    deprecated?: boolean;
    readOnly?: boolean;
    writeOnly?: boolean;
    nullable?: boolean; // 3.0 only
    enum?: (string | number)[];
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    items?: SchemaObject;
    properties?: Record<string, SchemaObject>;
    required?: string[];
    additionalProperties?: boolean | SchemaObject;
    allOf?: SchemaObject[];
    oneOf?: SchemaObject[];
    discriminator?: { propertyName: string; mapping?: Record<string, string> };
    [x: `x-${string}`]: any;
  }

  export interface ContactObject {
    name?: string;
    url?: string;
    email?: string;
  }

  export interface LicenseObject {
    name: string;
    url?: string;
  }

  export interface InfoObject {
    title: string;
    description?: string;
    termsOfService?: string;
    contact?: ContactObject;
    license?: LicenseObject;
    version: string;
  }

  export interface ServerObject {
    url: string;
    description?: string;
  }

  export interface ParameterObject {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    style?: string;
    explode?: boolean;
    schema?: SchemaObject;
  }

  export interface MediaTypeObject {
    schema?: SchemaObject;
    example?: any;
    examples?: Record<string, { value: any }>;
  }

  export interface RequestBodyObject {
    description?: string;
    content: Record<string, MediaTypeObject>;
    required?: boolean;
  }

  export interface ResponseObject {
    description: string;
    headers?: Record<string, { description?: string; schema?: SchemaObject }>;
    content?: Record<string, MediaTypeObject>;
  }

  export interface OperationObject {
    summary?: string;
    description?: string;
    operationId?: string;
    deprecated?: boolean;
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject;
    responses: Record<string, ResponseObject>;
  }

  export type HttpMethodKey =
    'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

  export type PathItemObject = Partial<Record<HttpMethodKey, OperationObject>>;

  export interface ComponentsObject {
    schemas?: Record<string, SchemaObject>;
  }

  export interface Document {
    openapi: string;
    info: InfoObject;
    servers?: ServerObject[];
    paths: Record<string, PathItemObject>;
    components?: ComponentsObject;
  }
}
