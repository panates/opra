<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/common

Shared foundation of the OPRA framework — schema model, decorators, type system, and filter DSL

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Shared foundation package of the [OPRA](https://oprajs.com) framework. Provides the API document model, schema types, decorators, exception hierarchy, filter DSL, and utilities used by all OPRA adapters and services.

## Features

- **API Document Model** — `ApiDocument` with `HttpApi`, `MQApi`, and `WSApi` transport layers in a single schema
- **Rich Type System** — Simple, Complex, Array, Enum, Union, and a full set of utility types (`PartialType`, `PickType`, `OmitType`, `MixinType`, …)
- **Decorator-Driven API** — `@HttpController`, `@HttpOperation`, `@MQOperation`, `@WSOperation` and parameter/response decorators
- **Filter DSL** — ANTLR4-based query language (`OpraFilter.parse()`) for flexible server-side filtering
- **Exception Hierarchy** — `OpraException` and `OpraHttpError` subclasses (`NotFoundError`, `ForbiddenError`, …) with severity levels
- **`ResponsiveMap`** — Case-insensitive ordered Map with well-known key support
- **i18n Support** — Built-in internationalization with a `translate()` helper and lazy-loaded resource bundles
- **HTTP & MIME Constants** — `HttpStatusCodes`, `HttpHeaderCodes`, `MimeTypes` enumerations

## Installation

```bash
npm install @opra/common
```

## Usage

### Define Models

```typescript
import { ApiField, ComplexType } from '@opra/common';

@ComplexType({ description: 'Application user' })
export class User {
  @ApiField({ type: 'integer' })
  declare id: number;

  @ApiField()
  declare name: string;

  @ApiField()
  declare email: string;

  @ApiField({ type: 'boolean' })
  declare active: boolean;
}
```

### Define an HTTP API with decorators

```typescript
import { HttpController, HttpOperation } from '@opra/common';

@HttpController({ path: 'users' })
export class UsersController {
  @HttpOperation.Entity.FindMany({ type: User })
  async findMany() {}

  @HttpOperation.Entity.GetOne({ type: User })
  @HttpOperation.PathParam('id', 'integer')
  async getOne(id: number) {}
}
```

### Build an API document

```typescript
import { ApiDocumentFactory } from '@opra/common';

const document = await ApiDocumentFactory.createDocument({
  spec: '1.0',
  info: { title: 'My API', version: '1.0.0' },
  types: [User],
  api: { transport: 'http', controllers: [UsersController] },
});
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/common
[npm-url]: https://npmjs.org/package/@opra/common
[downloads-image]: https://img.shields.io/npm/dm/@opra/common.svg
[downloads-url]: https://npmjs.org/package/@opra/common
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=dev
