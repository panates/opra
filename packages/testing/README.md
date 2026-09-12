<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/testing

Testing utilities for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Testing utilities for the [OPRA](https://oprajs.com) framework. Write clean, expressive API tests with a fluent assertion API designed for OPRA services.

## Features

- **`OpraTestClient`** — Test client that accepts an HTTP server or request listener directly — no running server needed
- **`ApiExpect`** — Chainable assertion class for response validation
- **`TestBackend`** — Lightweight fetch-based backend for test requests
- Works with any test runner (Jest, Vitest, Mocha, etc.)

## Installation

```bash
npm install --save-dev @opra/testing
```

## Usage

```typescript
import { OpraTestClient } from '@opra/testing';

describe('UsersController', () => {
  let client: OpraTestClient;

  beforeAll(() => {
    client = new OpraTestClient(app);
  });

  it('should return users', async () => {
    await client.get('/users').expect(200).toSuccess().toMatchSchema(User);
  });

  it('should return 404 for unknown user', async () => {
    await client.get('/users/999').expect(404).toError('NotFound');
  });
});
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/testing
[npm-url]: https://npmjs.org/package/@opra/testing
[downloads-image]: https://img.shields.io/npm/dm/@opra/testing.svg
[downloads-url]: https://npmjs.org/package/@opra/testing
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
