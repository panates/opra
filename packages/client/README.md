<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/client

Type-safe HTTP client for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Type-safe HTTP client for the [OPRA](https://oprajs.com) framework. Built from your API document — no manual client code required.

## Features

- **`OpraHttpClient`** — Ready-to-use HTTP client backed by the Fetch API
- **`HttpClientBase`** — Extensible base class for custom client implementations
- **`FetchBackend`** — Configurable fetch backend with default headers and options
- **Interceptors** — Request/response middleware pipeline
- **Type-safe requests** — All calls are typed from the server API document

## Installation

```bash
npm install @opra/client
```

## Usage

```typescript
import { OpraHttpClient } from '@opra/client';

const client = new OpraHttpClient('https://api.example.com', {
  document: apiDocument,
});

const body = await client.request('users/findMany').getBody();
```

### With interceptors

```typescript
const client = new OpraHttpClient(baseUrl, {
  document: apiDocument,
  interceptors: [
    async (req, next) => {
      req.headers.set('Authorization', `Bearer ${token}`);
      return next(req);
    },
  ],
});
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/client
[npm-url]: https://npmjs.org/package/@opra/client
[downloads-image]: https://img.shields.io/npm/dm/@opra/client.svg
[downloads-url]: https://npmjs.org/package/@opra/client
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
