<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/nestjs

Core NestJS integration for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Core NestJS integration for the [OPRA](https://oprajs.com) framework. Bridges OPRA controllers and NestJS's dependency injection and module system.

## Features

- **`RpcControllerFactory`** — Wraps OPRA RPC controllers as NestJS-compatible classes
- **`MQControllerFactory`** — NestJS wrapper for OPRA message queue controllers
- **`WsControllerFactory`** — NestJS wrapper for OPRA WebSocket controllers
- **`RpcParamsFactory`** — Parameter extraction and validation from NestJS execution context
- **`@Public()`** — Decorator to mark endpoints as publicly accessible
- **`OpraNestUtils`** — Shared utilities for NestJS adapter packages

## Installation

```bash
npm install @opra/nestjs
```

> This package is a shared foundation. For transport-specific modules use [`@opra/nestjs-http`](../nestjs-http), [`@opra/nestjs-kafka`](../nestjs-kafka), [`@opra/nestjs-rabbitmq`](../nestjs-rabbitmq), or [`@opra/nestjs-socketio`](../nestjs-socketio).

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/nestjs
[npm-url]: https://npmjs.org/package/@opra/nestjs
[downloads-image]: https://img.shields.io/npm/dm/@opra/nestjs.svg
[downloads-url]: https://npmjs.org/package/@opra/nestjs
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
