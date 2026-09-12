<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/nestjs-http

NestJS HTTP module for the OPRA framework

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![CI Tests][ci-test-image]][ci-test-url]
[![Test Coverage][coveralls-image]][coveralls-url]

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

NestJS HTTP module for the [OPRA](https://oprajs.com) framework. Register your OPRA API inside a NestJS application in a few lines.

## Features

- **`OpraHttpModule`** — Dynamically configurable NestJS module (`forRoot` / `forRootAsync`)
- **`OpraHttpNestjsAdapter`** — NestJS adapter integrating OPRA's HTTP handler
- **`OpraExceptionFilter`** — Global exception filter that maps OPRA errors to HTTP responses
- **`OpraMiddleware`** — Request/response middleware for the OPRA pipeline
- Full support for NestJS **dependency injection**, **interceptors**, and **guards**

## Installation

```bash
npm install @opra/nestjs-http
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { OpraHttpModule } from '@opra/nestjs-http';

@Module({
  imports: [
    OpraHttpModule.forRoot({
      name: 'MyAPI',
      basePath: 'v1',
      schemaIsPublic: true,
      controllers: [UsersController, ProductsController],
      providers: [UsersService, ProductsService],
      types: [User, Product],
    }),
  ],
})
export class AppModule {}
```

### Async configuration

```typescript
OpraHttpModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    name: config.get('API_NAME'),
    controllers: [UsersController],
  }),
  inject: [ConfigService],
});
```

## Node Compatibility

- node >= 20.x

## License

Available under [MIT](LICENSE) license.

[npm-image]: https://img.shields.io/npm/v/@opra/nestjs-http
[npm-url]: https://npmjs.org/package/@opra/nestjs-http
[downloads-image]: https://img.shields.io/npm/dm/@opra/nestjs-http.svg
[downloads-url]: https://npmjs.org/package/@opra/nestjs-http
[ci-test-image]: https://github.com/panates/opra/actions/workflows/test.yml/badge.svg
[ci-test-url]: https://github.com/panates/opra/actions/workflows/test.yml
[coveralls-image]: https://coveralls.io/repos/github/panates/opra/badge.svg?branch=dev
[coveralls-url]: https://coveralls.io/github/panates/opra?branch=main
