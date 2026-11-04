<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/openapi

Generate OpenAPI (Swagger) documents from an Opra `ApiDocument`

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

## Installation

```bash
npm install @opra/openapi
```

## Usage

```ts
import { OpenApiDocumentFactory } from '@opra/openapi';

const openApiDocument = OpenApiDocumentFactory.generate(apiDocument, {
  version: '3.0', // or '3.1'
});
```

`apiDocument` must be an `ApiDocument` (from `@opra/common`) whose `api.transport` is `'http'`.

## License

MIT

[npm-image]: https://img.shields.io/npm/v/@opra/openapi
[npm-url]: https://npmjs.org/package/@opra/openapi
[downloads-image]: https://img.shields.io/npm/dm/@opra/openapi.svg
[downloads-url]: https://npmjs.org/package/@opra/openapi
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=dev
