<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/angular

Angular client integration for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

Angular client integration for the [OPRA](https://oprajs.com) framework. Use Angular's native HttpClient under the hood while keeping all of OPRA's type-safety and interceptor support.

## Features

- **`OpraAngularClient`** — Angular-specific HTTP client extending `HttpClientBase`
- **`AngularBackend`** — Backend implementation wrapping Angular's `HttpClient`
- Compatible with Angular's dependency injection and `HttpClientModule`
- Supports OPRA interceptors alongside Angular's own HTTP interceptors
- Works with `@opra/client` typings — same API, Angular-native transport

## Installation

```bash
npm install @opra/angular
```

## Usage

```typescript
import { OpraAngularClient } from '@opra/angular';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiClient extends OpraAngularClient {
  constructor(http: HttpClient) {
    super(http, 'https://api.example.com', { document: apiDocument });
  }
}
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/angular
[npm-url]: https://npmjs.org/package/@opra/angular
[downloads-image]: https://img.shields.io/npm/dm/@opra/angular.svg
[downloads-url]: https://npmjs.org/package/@opra/angular
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
