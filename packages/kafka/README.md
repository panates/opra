<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/kafka

Standalone Kafka transport adapter for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Standalone Kafka transport adapter for the [OPRA](https://oprajs.com) framework. Define message queue operations with the same decorator-driven model used for HTTP — no separate consumer/handler boilerplate.

## Features

- **`KafkaAdapter`** — Platform adapter managing Kafka consumer groups and message routing
- **`KafkaContext`** — Per-message context with typed access to topic, key, payload, partition, and headers
- Consumer group configuration with session timeouts and concurrency settings
- Seamless integration with OPRA's `@MQOperation` decorators and validation pipeline

## Installation

```bash
npm install @opra/kafka
```

## Usage

```typescript
import { KafkaAdapter } from '@opra/kafka';

const adapter = new KafkaAdapter(apiDocument, {
  client: {
    clientId: 'my-service',
    bootstrapBrokers: ['localhost:9092'],
  },
  consumers: {
    'my-group': { sessionTimeout: 30000 },
  },
});

await adapter.initialize();
await adapter.start();
```

> For NestJS integration use [`@opra/nestjs-kafka`](../nestjs-kafka).

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/kafka
[npm-url]: https://npmjs.org/package/@opra/kafka
[downloads-image]: https://img.shields.io/npm/dm/@opra/kafka.svg
[downloads-url]: https://npmjs.org/package/@opra/kafka
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
