<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/nestjs-rabbitmq

NestJS RabbitMQ module for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

NestJS RabbitMQ module for the [OPRA](https://oprajs.com) framework. Integrate RabbitMQ message consumers into your NestJS application with OPRA's schema-driven operation model.

## Features

- **`OpraRabbitmqModule`** — Dynamically configurable NestJS module (`forRoot` / `forRootAsync`)
- Full NestJS dependency injection and provider support
- Interceptor middleware pipeline
- Content-type parsing, compression support, and dead-letter exchange handling

## Installation

```bash
npm install @opra/nestjs-rabbitmq
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { OpraRabbitmqModule } from '@opra/nestjs-rabbitmq';

@Module({
  imports: [
    OpraRabbitmqModule.forRoot({
      name: 'MyMQAPI',
      url: 'amqp://localhost',
      queues: [{ name: 'orders', prefetch: 10 }],
      controllers: [OrdersController],
      providers: [OrdersService],
    }),
  ],
})
export class AppModule {}
```

### Async configuration

```typescript
OpraRabbitmqModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    url: config.get('RABBITMQ_URL'),
    controllers: [OrdersController],
  }),
  inject: [ConfigService],
});
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/nestjs-rabbitmq
[npm-url]: https://npmjs.org/package/@opra/nestjs-rabbitmq
[downloads-image]: https://img.shields.io/npm/dm/@opra/nestjs-rabbitmq.svg
[downloads-url]: https://npmjs.org/package/@opra/nestjs-rabbitmq
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
