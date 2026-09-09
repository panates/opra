<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/openapi

Generate OpenAPI (Swagger) documents from an Opra `ApiDocument`

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
