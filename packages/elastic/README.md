<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/elastic

Elasticsearch data service adapter for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Elasticsearch data service adapter for the [OPRA](https://oprajs.com) framework. Translate OPRA operations directly into Elasticsearch queries — no manual query building required.

## Features

- **`ElasticService`** — Base service managing Elasticsearch client connection and error handling
- **`ElasticCollectionService`** — Collection-level CRUD service for Elasticsearch indices
- **`ElasticEntityService`** — Document-level service for single entity operations
- **`ElasticAdapter`** — Utility namespace: `prepareFilter()`, `preparePatch()`, `prepareProjection()`, `prepareSort()`, `parseRequest()`
- Automatic translation of OPRA filter DSL to Elasticsearch query DSL
- Interceptor pipeline support

## Installation

```bash
npm install @opra/elastic
```

## Usage

```typescript
import { ElasticCollectionService } from '@opra/elastic';
import { Client } from '@elastic/elasticsearch';

@HttpController({ path: 'products' })
export class ProductsController extends ElasticCollectionService<Product> {
  constructor(client: Client) {
    super(Product, client, 'products');
  }

  @HttpOperation.Entity.FindMany({ type: Product })
  findMany() {
    return super.findMany();
  }
}
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/elastic
[npm-url]: https://npmjs.org/package/@opra/elastic
[downloads-image]: https://img.shields.io/npm/dm/@opra/elastic.svg
[downloads-url]: https://npmjs.org/package/@opra/elastic
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
