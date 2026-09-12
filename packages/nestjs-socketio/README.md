<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/nestjs-socketio

NestJS Socket.IO module for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

NestJS Socket.IO module for the [OPRA](https://oprajs.com) framework. Add real-time WebSocket operations to your NestJS application using the same OPRA schema you use for HTTP.

## Features

- **`OpraSocketioModule`** — Dynamically configurable NestJS module (`forRoot` / `forRootAsync`)
- Configurable Socket.IO server options (port, CORS, etc.)
- Full NestJS dependency injection and provider support
- Interceptor middleware pipeline
- Unified operation model shared with HTTP endpoints

## Installation

```bash
npm install @opra/nestjs-socketio
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { OpraSocketioModule } from '@opra/nestjs-socketio';

@Module({
  imports: [
    OpraSocketioModule.forRoot({
      name: 'MyWSAPI',
      port: 3001,
      serverOptions: { cors: { origin: '*' } },
      controllers: [NotificationsController],
      providers: [NotificationsService],
    }),
  ],
})
export class AppModule {}
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/nestjs-socketio
[npm-url]: https://npmjs.org/package/@opra/nestjs-socketio
[downloads-image]: https://img.shields.io/npm/dm/@opra/nestjs-socketio.svg
[downloads-url]: https://npmjs.org/package/@opra/nestjs-socketio
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
