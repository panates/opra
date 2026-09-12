<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/socketio

Standalone Socket.IO transport adapter for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Standalone Socket.IO transport adapter for the [OPRA](https://oprajs.com) framework. Bring real-time WebSocket operations into the same schema-driven model as your HTTP API.

## Features

- **`SocketioAdapter`** — Platform adapter managing the Socket.IO server and event routing
- **`SocketioContext`** — Per-event context with typed access to socket instance, event name, and parameters
- Unified operation model across HTTP and WebSocket transports
- Interceptor and validation pipeline support

## Installation

```bash
npm install @opra/socketio
```

## Usage

```typescript
import { SocketioAdapter } from '@opra/socketio';
import { Server } from 'socket.io';

const io = new Server(httpServer);

const adapter = new SocketioAdapter(apiDocument, { server: io });

await adapter.initialize();
```

> For NestJS integration use [`@opra/nestjs-socketio`](../nestjs-socketio).

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/socketio
[npm-url]: https://npmjs.org/package/@opra/socketio
[downloads-image]: https://img.shields.io/npm/dm/@opra/socketio.svg
[downloads-url]: https://npmjs.org/package/@opra/socketio
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
