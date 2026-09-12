<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/http

Standalone HTTP server adapter for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Standalone HTTP server adapter for the [OPRA](https://oprajs.com) framework. Plug your existing Express (or any compatible) application into OPRA with minimal setup.

## Features

- **`HttpAdapter`** — Abstract base for all HTTP platform adapters
- **`ExpressAdapter`** — Drop-in Express.js integration
- **`HttpHandler`** — Full request lifecycle: parsing, validation, routing, response
- **`HttpContext`** — Per-request context with typed access to params, headers, and body
- **Interceptors** — Middleware pipeline at the adapter level

## Installation

```bash
npm install @opra/http
```

## Usage

```typescript
import express from 'express';
import { ExpressAdapter } from '@opra/http';

const app = express();

const adapter = new ExpressAdapter(app, apiDocument, {
  basePath: '/api/v1',
});

await adapter.initialize();

app.listen(3000);
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/http
[npm-url]: https://npmjs.org/package/@opra/http
[downloads-image]: https://img.shields.io/npm/dm/@opra/http.svg
[downloads-url]: https://npmjs.org/package/@opra/http
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
