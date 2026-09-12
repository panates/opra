<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/sqb

SQL data service adapter for the OPRA framework, powered by SQB

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

SQL data service adapter for the [OPRA](https://oprajs.com) framework, powered by [SQB](https://github.com/panates/sqb). Connect your relational database to OPRA's operation model with full transaction support.

## Features

- **`SqbServiceBase`** — Base service managing SqbClient or SqbConnection with transaction support
- **`SqbCollectionService`** — Table-level CRUD service with automatic query generation
- **`SqbEntityService`** — Row-level service for single entity operations
- **`SQBAdapter`** — Utility namespace: `prepareFilter()`, `parseRequest()`
- Automatic translation of OPRA filter DSL to SQL WHERE clauses
- `withTransaction()` helper for multi-step atomic operations
- Compatible with PostgreSQL, MySQL, SQLite, and other SQB-supported databases

## Installation

```bash
npm install @opra/sqb
```

## Usage

```typescript
import { SqbCollectionService } from '@opra/sqb';
import { SqbClient } from '@sqb/connect';

@HttpController({ path: 'orders' })
export class OrdersController extends SqbCollectionService<Order> {
  constructor(client: SqbClient) {
    super(Order, client, 'orders');
  }

  @HttpOperation.Entity.FindMany({ type: Order })
  findMany() {
    return super.findMany();
  }

  @HttpOperation.Entity.Create({ type: Order })
  async create(dto: CreateOrderDto) {
    return this.withTransaction(conn =>
      super.create(dto, { connection: conn }),
    );
  }
}
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/sqb
[npm-url]: https://npmjs.org/package/@opra/sqb
[downloads-image]: https://img.shields.io/npm/dm/@opra/sqb.svg
[downloads-url]: https://npmjs.org/package/@opra/sqb
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
