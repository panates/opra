<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/core

Runtime engine of the OPRA framework — request lifecycle, validation, and routing

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Core runtime package of the [OPRA](https://oprajs.com) framework. Provides the execution engine, platform adapter base classes, service patterns, and infrastructure utilities that all OPRA adapters and services depend on.

## Features

- **Platform Adapter Base** — Abstract foundation for HTTP, Socket.IO, Kafka, RabbitMQ, and other transport adapters
- **Execution Context** — Request-scoped context carrying adapter, document, transport, and platform references
- **Service Pattern** — `ServiceBase` with context propagation and immutable `.for()` cloning
- **i18n Support** — Built-in internationalization with lazy-loading of resource bundles and localized error messages
- **Asset Cache** — WeakMap-based cache for automatic memory-safe asset lifecycle management
- **Event-Driven** — `AsyncEventEmitter`-based lifecycle hooks on both adapters and execution contexts

## Installation

```bash
npm install @opra/core
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/core
[npm-url]: https://npmjs.org/package/@opra/core
[downloads-image]: https://img.shields.io/npm/dm/@opra/core.svg
[downloads-url]: https://npmjs.org/package/@opra/core
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=dev
