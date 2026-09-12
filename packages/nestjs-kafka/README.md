<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/nestjs-kafka

NestJS Kafka module for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

NestJS Kafka module for the [OPRA](https://oprajs.com) framework. Wire up Kafka consumers in your NestJS application using OPRA's decorator-driven operation model.

## Features

- **`OpraKafkaModule`** — Dynamically configurable NestJS module (`forRoot` / `forRootAsync`)
- Full NestJS dependency injection and provider support
- Interceptor middleware pipeline
- Shares the same operation model as your HTTP and WebSocket services

## Installation

```bash
npm install @opra/nestjs-kafka
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { OpraKafkaModule } from '@opra/nestjs-kafka';

@Module({
  imports: [
    OpraKafkaModule.forRoot({
      name: 'MyKafkaAPI',
      client: {
        clientId: 'my-service',
        bootstrapBrokers: ['localhost:9092'],
      },
      consumers: {
        'my-group': { sessionTimeout: 30000 },
      },
      controllers: [OrdersController],
      providers: [OrdersService],
    }),
  ],
})
export class AppModule {}
```

### Async configuration

```typescript
OpraKafkaModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    client: { bootstrapBrokers: [config.get('KAFKA_BROKER')] },
    controllers: [OrdersController],
  }),
  inject: [ConfigService],
});
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/nestjs-kafka
[npm-url]: https://npmjs.org/package/@opra/nestjs-kafka
[downloads-image]: https://img.shields.io/npm/dm/@opra/nestjs-kafka.svg
[downloads-url]: https://npmjs.org/package/@opra/nestjs-kafka
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
