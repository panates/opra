<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/rabbitmq

Standalone RabbitMQ transport adapter for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Standalone RabbitMQ transport adapter for the [OPRA](https://oprajs.com) framework. Handle queue messages with OPRA's operation model — validation, content-type parsing, and routing included.

## Features

- **`RabbitmqAdapter`** — Platform adapter for RabbitMQ connection and queue subscription management
- **`RabbitmqContext`** — Per-message context with typed access to queue, consumer, content, headers, and reply function
- Content-type aware message parsing (JSON, plain text, binary)
- Compression support: gzip, deflate, brotli
- Queue configuration and dead-letter exchange support

## Installation

```bash
npm install @opra/rabbitmq
```

## Usage

```typescript
import { RabbitmqAdapter } from '@opra/rabbitmq';

const adapter = new RabbitmqAdapter(apiDocument, {
  url: 'amqp://localhost',
  queues: [{ name: 'orders', prefetch: 10 }],
});

await adapter.initialize();
await adapter.start();
```

> For NestJS integration use [`@opra/nestjs-rabbitmq`](../nestjs-rabbitmq).

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/rabbitmq
[npm-url]: https://npmjs.org/package/@opra/rabbitmq
[downloads-image]: https://img.shields.io/npm/dm/@opra/rabbitmq.svg
[downloads-url]: https://npmjs.org/package/@opra/rabbitmq
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
