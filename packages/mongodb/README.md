<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/mongodb

MongoDB data service adapter for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

MongoDB data service adapter for the [OPRA](https://oprajs.com) framework. Connects your MongoDB collections to OPRA's operation model — pagination, filtering, sorting, and projections work out of the box.

## Features

- **`MongoService`** — Base service with MongoClient or database integration and transaction support
- **`MongoCollectionService`** — Ready-made CRUD service for a MongoDB collection
- **`MongoEntityService`** — Entity-level service for single-document operations
- **`MongoAdapter`** — Utility namespace: `prepareFilter()`, `prepareSort()`, `prepareProjection()`, `prepareKeyValues()`
- Automatic translation of OPRA filter DSL to MongoDB query objects
- ObjectId handling and schema-aware field projection

## Installation

```bash
npm install @opra/mongodb
```

## Usage

```typescript
import { MongoCollectionService } from '@opra/mongodb';

@HttpController({ path: 'users' })
export class UsersController extends MongoCollectionService<User> {
  constructor(db: Db) {
    super(User, db.collection('users'));
  }

  @HttpOperation.Entity.FindMany({ type: User })
  findMany() {
    return super.findMany();
  }

  @HttpOperation.Entity.GetOne({ type: User })
  @HttpOperation.PathParam('id', 'objectId')
  getOne(id: ObjectId) {
    return super.getOne(id);
  }
}
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/mongodb
[npm-url]: https://npmjs.org/package/@opra/mongodb
[downloads-image]: https://img.shields.io/npm/dm/@opra/mongodb.svg
[downloads-url]: https://npmjs.org/package/@opra/mongodb
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
