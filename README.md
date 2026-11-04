<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

A TypeScript framework for rich APIs: define the schema once and get validation, documentation and a typed client, over HTTP, WebSocket, Kafka, RabbitMQ or Socket.IO.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

## What is OPRA?

OPRA is a TypeScript framework for building **RICH APIs** — APIs that go beyond simple REST endpoints. Define your schema once and get validation, documentation, and a fully typed client for free. Run the same service over HTTP, WebSocket, Kafka, RabbitMQ, or Socket.io without changing your business logic.

```typescript
@ComplexType({ description: 'Application user' })
export class User {
  @ApiField({ type: 'integer' }) declare id: number;
  @ApiField() declare name: string;
  @ApiField() declare email: string;
}

@HttpController({ path: 'users' })
export class UsersController {
  @HttpOperation.Entity.FindMany({ type: User })
  async findMany() { }

  @HttpOperation.Entity.GetOne({ type: User })
  @HttpOperation.PathParam('id', 'integer')
  async getOne(id: number) { }
}
```

That's it — schema, validation, docs, and a typed client are all derived automatically.

---

## Why OPRA?

| Without OPRA | With OPRA |
|---|---|
| Define models, write OpenAPI spec, add validation — keep all three in sync | Define once. Everything else is derived. |
| Handwrite an HTTP client. Update it every time something changes | Run `oprimp`. Get a fully typed client. |
| Implement pagination, filtering, sorting for every entity | Extend a base service class — it's built in |
| Separate implementations for HTTP, WebSocket, Kafka, RabbitMQ | One schema. All transports. |
| Write docs separately. Watch them drift | Docs are always correct — they can't not be |

---

## Packages

OPRA is a monorepo. Pick what you need:

| Package | Description |
|---|---|
| [`@opra/common`](packages/common) | Core schema model, decorators, type system, filter DSL |
| [`@opra/core`](packages/core) | Runtime engine — request lifecycle, validation, routing |
| [`@opra/http`](packages/http) | Standalone HTTP adapter |
| [`@opra/client`](packages/client) | Auto-generated type-safe HTTP client |
| [`@opra/cli`](packages/cli) | CLI tools — `oprimp` for client generation |
| [`@opra/nestjs`](packages/nestjs) | NestJS integration |
| [`@opra/nestjs-http`](packages/nestjs-http) | NestJS HTTP adapter |
| [`@opra/nestjs-kafka`](packages/nestjs-kafka) | NestJS + Kafka transport |
| [`@opra/nestjs-rabbitmq`](packages/nestjs-rabbitmq) | NestJS + RabbitMQ transport |
| [`@opra/nestjs-socketio`](packages/nestjs-socketio) | NestJS + Socket.io transport |
| [`@opra/kafka`](packages/kafka) | Standalone Kafka transport |
| [`@opra/rabbitmq`](packages/rabbitmq) | Standalone RabbitMQ transport |
| [`@opra/socketio`](packages/socketio) | Standalone Socket.io transport |
| [`@opra/mongodb`](packages/mongodb) | MongoDB data service base |
| [`@opra/elastic`](packages/elastic) | Elasticsearch data service base |
| [`@opra/sqb`](packages/sqb) | SQL (SQB) data service base |
| [`@opra/angular`](packages/angular) | Angular client integration |
| [`@opra/testing`](packages/testing) | Testing utilities |

---

## Quick Start

```bash
npm install @opra/common @opra/core @opra/nestjs-http
```

See the [Getting Started guide](https://oprajs.com/docs/introduction) for a complete walkthrough.

---

## Node Compatibility

- node >= 20.x

---

## Support

Found a bug or have a question? Open an issue on the [GitHub issues](https://github.com/panates/opra/issues) page. Please include your Node.js version when reporting bugs.

---

## License

OPRA is available under the [MIT](LICENSE) license.

---

[npm-image]: https://img.shields.io/npm/v/@opra/core.svg
[npm-url]: https://npmjs.org/package/@opra/core
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=dev
[downloads-image]: https://img.shields.io/npm/dm/@opra/core.svg
[downloads-url]: https://npmjs.org/package/@opra/core
