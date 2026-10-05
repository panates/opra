# Changelog

<!-- rman:documented-up-to 8ed940ce0d5bb69f9378daf417381115b3e61073 -->

## v1.30.0 (2026-09-09)

### ✨ Features

- Add @opra/openapi package — generates OpenAPI 3.0/3.1 from an ApiDocument (56de27c)

### 🧹 Chores

- Upgrade `ts-gems` to ^4.0.3, `valgen` to ^7.0.0, and other dependencies across projects (2ec4488)

---

## v1.29.12 (2026-09-08)

### 🐛 Bug Fixes

- Add dynamic `multipasta` import handling for browser and Node environments in `http-bundle-observable` (b9e7e15)
- Make @opra/client's bundle() work in real browsers (12aadb4)

---

## v1.29.11 (2026-09-07)

### 🐛 Bug Fixes

- Adjust `multipasta` import and type annotations in `http-bundle-observable` (d7aad1e)

---

## v1.29.10 (2026-09-07)

### 🐛 Bug Fixes

- Remove 'multipasta' from external dependencies in esbuild config (bb6fe05)

---

## v1.29.9 (2026-09-07)

### 🧹 Chores

- Upgrade dependencies across projects to latest compatible versions (fe63bf8)

---

## v1.29.8 (2026-08-27)

### 🐛 Bug Fixes

- Align peerDependency syntax for NestJS packages to ensure consistent range formatting (c69cb90)

---

## v1.29.7 (2026-08-27)

### 🧹 Chores

- Upgrade dependencies across projects to latest versions (4a4b994)

---

## v1.29.6 (2026-08-19)

### 🐛 Bug Fixes

- Upgrade dependencies to fix anonymous EnumTypes (0a32787)

---

## v1.29.5 (2026-08-17)

### 🐛 Bug Fixes

- **sqb:** Replace `ignoreReadonlyFields` with `ignoreWriteonlyFields` in codec generation (d37a545)

---

## v1.29.4 (2026-08-17)

### 🐛 Bug Fixes

- **complex-type:** Add null check for `_fields` before accessing `size` (ad6e4d8)
- **mongodb:** Correct field assignments and codec options handling (f7e1003)
- **sqb:** Add `ignoreReadonlyFields` option to codec generation and field hooks (9ac5c7f)

### 🧹 Chores

- Update dependencies and improve `HttpMediaType` handling (2a56b6d)
- Update dependencies across projects and refine `HttpMediaType` structure (d1c671a)

---

## v1.29.3 (2026-07-17)

### 🐛 Bug Fixes

- **http:** Ensure proper parsing of `content-type` header in responses (8039835)

### 🧹 Chores

- **http:** Adjust imports and remove redundant `Readable` import (21b0f08)

---

## v1.29.2 (2026-07-17)

### ✨ Features

- **http:** Add support for `QUERY` HTTP method (a52b636)

### 🐛 Bug Fixes

- **http:** Handle readable streams and proper piping in HTTP responses (aec975a)

### 🔧 Refactoring

- **http:** Ensure synchronous cleanup of auto-deleted files on process exit (5f31f35)

---

## v1.29.1 (2026-07-16)

### 🐛 Bug Fixes

- Fixed event emitter memory leak warning (25a2e0d)

### 🧹 Chores

- Update dependencies across packages and examples to latest versions (b7dade7)

---

## v1.29.0 (2026-07-07)

### ✨ Features

- Added bundle support for HTTP protocol Refactor: Renamed HttpIncoming to HttpRequest, HttpOutgoing to HttpResponse Refactor: Refactored MultipartReader to support multipart/mixed (a731b04)
- Introduced ExecutionBundle to manage shared execution contexts across requests; updated HTTP and database modules for bundle integration (722930f)
- Add transaction support and error handling to ExecutionBundle (ff65513)
- Add events typing generics support to ExecutionContext (2289073)
- Add event typings (`before-execute`, `after-execute`, `error`, `finish`) to `HttpContext` (9b7c805)
- Add event typings (`before-execute`, `after-execute`, `error`, `finish`) to `KafkaContext` (0a3832e)
- Add event typings (`before-execute`, `after-execute`, `error`, `finish`) to `RabbitmqContext` (abd2cfd)
- **http:** add `transaction` query parameter support in `HttpBundle` (70936d5)
- **http:** Enhance bundle execution and emitting events (ef13561)
- **kafka:** Add granular lifecycle event support (`before-execute`, `after-execute`, `finish`) and update `wait-for-message` logic (d99edfe)
- **rabbitmq:** Add granular lifecycle event support (`context-before-execute`, `context-after-execute`, `context-finish`) and update `wait-for-message` logic (daef21b)
- **socketio:** Add event typings (`before-execute`, `after-execute`, `error`, `finish`) to `SocketioContext` and improve type declarations (2fd354e)
- **sqb:** Implemented bundle transactions support (9de8387)
- **mongodb:** Implemented bundle transactions support (286abf8)
- **client:** Add bundled request support and improve HTTP utils (16527f3)

### 🔧 Refactoring

- **http:** improve `cookie` method by aligning with updated `Set-Cookie` API and type definitions, update dependencies (7db5cab)
- Standardized `__bundle` to `bundle` across all packages. (9ea4adb)

### 🧹 Chores

- update dependencies across multiple packages and examples to latest versions (a8140c8)

### 💬 General Changes

- Improve README files with new structure, usage examples, and feature highlights across all packages (e556b5e)

---

## v1.28.5 (2026-05-20)

### 🐛 Bug Fixes

- Correct type definitions for Kafka subscription options (af70594)

### 🔧 Refactoring

- Remove unused `HttpFetchClient` implementation (b4575fd)

### 🧹 Chores

- Update OPRA acronym meaning across project files (f93c555)
- Update copyright in LICENSE file (78a8afb)

### 💬 General Changes

- Improve README files with new structure, usage examples, and feature highlights across all packages (03c3763)

---

## v1.28.4 (2026-05-16)

### ✨ Features

- Add `allowNullOptionals` support to HTTP request body options and related handling (6a8a38a)

### 🧹 Chores

- Add graphify support and related configuration (8af4d93)
- Update dependencies to latest versions (1b6892c)

---

## v1.28.3 (2026-05-14)

### 🐛 Bug Fixes

- Correct default value check for HTTP parameters (f963a5f)

### 🧹 Chores

- Update dependencies (6786f12)

---

## v1.28.2 (2026-05-13)

### ✨ Features

- Add support for printing default values in generated JSDoc for HTTP parameters (be89b72)

### 🐛 Bug Fixes

- Ensure `vg.required` is used instead of `vg.optional` for default HTTP parameter values (d08d3a8)
- Default query parameter do not set (5124626)

### 🧹 Chores

- Update dependencies (d41d018)

---

## v1.28.1 (2026-05-12)

### ✨ Features

- Add support for default values in API fields and HTTP parameters (24c903c)

### 🔧 Refactoring

- Add generic type parameter to `withTransaction` for better type safety (1320ba2)

### 🧹 Chores

- Update dependencies for @sqb, @opra, @swc/core, and other libraries (90bc0f7)
- Remove unused Admin import in Kafka e2e test (4732bb1)
- Simplify `compile` scripts by removing redundant `tsc --noEmit` executions in all package.json files (93efe35)
- Update dependencies across multiple packages, including `expect`, `sinon`, `content-disposition`, `@elastic/elasticsearch`, and Angular packages (53a1710)

---

## v1.28.0 (2026-05-05)

### 🔧 Refactoring

- Refactor Kafka to use `@platformatic/kafka` (79d898b)

### 🧹 Chores

- update Node.js version to 24 in CI and reorganize MongoDB step (4f6e369)
- update ApiField decorator logic, add `reflect-metadata` import, and enhance test cases (f6f87c7)
- Dev (7cab395)
- Enable kafta test using bitnami/kafka:3.7 docker image (e78d854)
- Enable kafta test using apache/kafka docker image (81e0a5d)

---

## v1.27.5 (2026-04-30)

### 🧹 Chores

- Dev (8a29165)
- format import statements in global.guard.ts for consistency (fca6c8b)
- update dependencies and improve `type` imports for consistency (cd25da0)

---

## v1.27.4 (2026-04-29)

### 🧹 Chores

- update c8 and TypeScript config to refine included and excluded paths (0e56279)
- add conditional test skipping via `SKIP_*` environment variables, refactor test setup, and bump dependencies to 1.27.3 (7368f3c)
- Dev (3122f49)
- refine TypeScript build and test configuration, update dependencies, and ensure consistent use of `type` imports (b52d261)

---

## v1.27.3 (2026-04-29)

### 🔧 Refactoring

- add explicit `.js` extensions and use `type` imports for improved consistency and clarity. no-test (ca9bc05)

### 🧹 Chores

- add `SKIP_KAFKA_TESTS` environment variable and conditionally skip Kafka-related tests; bump dependencies to 1.27.2 (b94e398)

---

## v1.27.2 (2026-04-29)

### 🧹 Chores

- update SQB dependencies and peerDependencies to v5.0.1 and adjust types for compatibility (a409682)

---

## v1.27.1 (2026-04-27)

### 🧹 Chores

- update SQB peerDependencies to support version 5 and 6 (2e3d756)

---

## v1.27.0 (2026-04-27)

### ✨ Features

- enhance onError handling to include command context in SqbEntityService (bc318aa)

### 🔧 Refactoring

- migrate to `sql` namespace and update SQB dependencies to v5 across modules (a7e1fd0)

### 💬 General Changes

- Potential fix for pull request finding 'Unused variable, import, function or class' (8ef4ca0)

---

## v1.26.4 (2026-04-17)

### ✨ Features

- add --type-imports flag to support import type in generated code (2436eff)

### 🐛 Bug Fixes

- pass options to parent constructor in `SqbServiceBase` (2660668)
- throw error if OPRA metadata is missing in `DocumentNode` creation (57dcb11)

### 🔧 Refactoring

- improve documentation, added overloaded typings for methods (3237868)
- remove `useTypeImports` option and enforce explicit value in imports (27760e8)
- update `findMany` method typings to improve DTO type clarity (501353a)
- enhance service documentation and typings across MongoDB modules (75cdb1d)
- standardize documentation and simplify type annotations across MongoDB services (c5b2b36)
- enhance documentation and standardize JSDoc annotations across Elasticsearch services and utilities (96a28aa)
- enhance documentation and standardize JSDoc annotations across Kafka services and utilities (38a1201)
- enhance documentation and standardize JSDoc annotations across RabbitMQ services and utilities (d87d50d)
- standardize generic type annotations and improve interface formatting across MongoDB services (2df0b31)
- standardize comment style in MongoDB services (03e0b07)
- enhance documentation and standardize JSDoc annotations across HTTP services and utilities (e8ca3e9)
- replace JSDoc-style comments with standard block comments across MongoDB services (a0f2db6)
- replace JSDoc-style comments with standard block comments across RabbitMQ services (42adad3)
- replace JSDoc-style comments with standard block comments in Socket.IO adapter (3e3c7c3)
- replace JSDoc-style comments with standard block comments across SQL Builder services (f3bae95)
- replace JSDoc-style comments with standard block comments across Kafka services (09ae212)
- replace JSDoc-style comments with standard block comments in HTTP collection deleteMany tests (de20d78)
- replace JSDoc-style comments with standard block comments across Elastic services and utilities (87630dc)
- replace JSDoc-style comments with standard block comments in service-base module (a859d19)
- replace JSDoc-style comments with standard block comments across common module (aa04b4b)
- replace JSDoc-style comment with standard block comment in http-client-base module (4f18d65)
- replace JSDoc-style comment (36b55cb)
- replace JSDoc-style comments with standard block comments across Socket.IO context (2b8b905)
- remove unused parameters and redundant code in room-controller (146ddb4)
- replace JSDoc-style comments with standard block comments across core modules (f1d9c21)
- replace JSDoc-style comments with standard block comments across NestJS module (53e68b6)
- replace JSDoc-style comments with standard block comments across multiple modules (b729d23)
- replace JSDoc-style comments with standard block comments across multiple packages and modules (a61e0a2)

### 🧹 Chores

- update dependencies to latest versions across packages (7985a54)
- revert package-lock.json changes (16fa1f1)

### 💬 General Changes

- update repository references from `oprajs` to `panates` (b1a97c7)

---

## v1.26.3 (2026-04-14)

### 🐛 Bug Fixes

- extend `SqbServiceBase.Options` from `ServiceBase.Options` and fix typo in doc comment (5b6b42a)

### 🧹 Chores

- update dependencies to latest versions across packages (b63d8e5)

---

## v1.26.2 (2026-04-14)

### 🐛 Bug Fixes

- make `args` parameter in HttpContext.getBody optional (1acd204)

### 🧹 Chores

- update dependencies across packages to latest versions and improve `ServiceBase` with optional `context` in constructor (2368ef4)

---

## v1.26.1 (2026-04-10)

### ✨ Features

- add file handling support to HttpContext.getBody with `toFile` argument (ef8d664)

---

## v1.26.0 (2026-04-10)

### ✨ Features

- add LocalFile class with auto-delete and file utility methods (6aa0ddc)
- enhance BodyReader and MultipartReader with file handling support via LocalFile (d4e0db8)

### 🧹 Chores

- update dependencies across packages to latest versions (7b4c307)

---

## v1.25.6 (2026-04-07)

### 🔧 Refactoring

- HttpContext.getBody throws BadRequestError on error (9696470)

---

## v1.25.5 (2026-04-07)

### 🔧 Refactoring

- Added "strictMode" to mobile-phone type. no-test (89b45ec)

---

## v1.25.4 (2026-04-07)

### 🔧 Refactoring

- Update readBody options argument optional (0dedf78)
- Set mobilephone default locale to "any" refactor: Removed passportnumber and varnumber types. (d034ba2)

---

## v1.25.3 (2026-04-06)

### 🧹 Chores

- Added "creditcard", "ean", "ip", "mobilephone" and "vatnumber" data types (ae13dcd)

---

## v1.25.2 (2026-04-03)

### 🐛 Bug Fixes

- Do not decode object if mime type is application/yaml (e562406)

---

## v1.25.1 (2026-04-03)

### 💬 General Changes

- Configured and updated deps to improve support new versions of TypeScript and Node (dc4e467)

---

## v1.25.0 (2026-04-03)

### 🧹 Chores

- Updated deps (d6c17a3)

### 💬 General Changes

- Moved from "madge" to "dpdm" tool (ab7c6af)

---

## v1.24.4 (2026-03-25)

### 🔧 Refactoring

- MultipartReader: Use original filename when storing to temp directory (a6b0644)

### 🧹 Chores

- Applied new eslint rules (9710787)
- Updated deps (5e1a3cf)

---

## v1.24.3 (2026-03-25)

### 🐛 Bug Fixes

- BodyReader stucks issue (ea63ce3)

### 🧹 Chores

- Updated deps (f7fa29a)

---

## v1.24.2 (2026-03-13)

### ✨ Features

- Updated sqb deps to support index hints (29d3e88)

---

## v1.24.1 (2026-03-13)

### ✨ Features

- Updated sqb deps to support query comments (44d1d66)

---

## v1.24.0 (2026-03-11)

### ✨ Features

- Added yaml and toml content encoding parsing (142ab9d)

### 💬 General Changes

- Updated paths (f11bc78)

---

## v1.23.4 (2026-03-11)

### ✨ Features

- Added parsing yaml and toml contents (3bf964f)

---

## v1.23.3 (2026-03-03)

### 🔧 Refactoring

- Changed "stack" property to string (8811908)

### 🧹 Chores

- Updated deps (20f2d5f)

---

## v1.23.2 (2026-02-12)

### ✨ Features

- Added createRootContext() method to PlatformAdapter (e99143b)

### 🐛 Bug Fixes

- Wrong wrapping DTO type of operation result with array types (a3fcbbf)

### 🧹 Chores

- Updated deps (64c367b)

---

## v1.23.1 (2026-02-04)

### 🐛 Bug Fixes

- Error stack keeps previous message when error.message updated (1a8d5b6)

---

## v1.23.0 (2026-02-02)

### 🔧 Refactoring

- Socketio controllers always returns OperationResult (e0da95e)

---

## v1.22.10 (2026-02-02)

### 🐛 Bug Fixes

- SocketIO adapter should return OperationResult for errors (3699338)

---

## v1.22.9 (2026-01-27)

### 🐛 Bug Fixes

- Sometimes Socketio adapter crashes the app (c223eeb)

---

## v1.22.8 (2026-01-27)

### 🐛 Bug Fixes

- Sometimes Socketio adapter crashes the app (fb34435)

---

## v1.22.7 (2026-01-22)

### 🐛 Bug Fixes

- OperationResult data type imports more than once (036d0be)

### 🧹 Chores

- Updated deps (6bb4acf)

---

## v1.22.6 (2026-01-19)

### 🐛 Bug Fixes

- Array parameters do not parse well when using ArrayType (c6498b0)
- Fixed datetime data type issues (664aec8)

### 🔧 Refactoring

- Improved typings issues (3442abf)
- Throw error except return undefined when ctor with same name exists (fdaba58)

### 🧹 Chores

- Updated deps (ac7c0e7)

---

## v1.22.5 (2026-01-14)

### 🐛 Bug Fixes

- Should sort ws api operation arguments by parameter index (72c511a)
- Return errors in "errors" property except "error" (d1282f6)

### 🧹 Chores

- Updated deps (77ff511)

---

## v1.22.4 (2026-01-05)

### 🧹 Chores

- Updated deps (1e950d0)

---

## v1.22.3 (2026-01-02)

### 🐛 Bug Fixes

- cli bin path correction (066f714)

### 💬 General Changes

- Build fix (a06f869)

---

## v1.22.2 (2026-01-02)

### ✨ Features

- Generates documentation for SimpleType attributes (7bdc5c9)

### 🐛 Bug Fixes

- Should not use JSON.stringify(x) for Socketio responses (548b956)

---

## v1.22.1 (2025-12-29)

### 🧹 Chores

- Updated deps (0a34669)

---

## v1.22.0 (2025-12-22)

### ✨ Features

- Added "required" option to WsParam decorator (b36ed61)

### 🐛 Bug Fixes

- __docNode property not set in NestJS http adapter (19081fe)
- ArrayType decorator do not accept enum types (d74cfdc)

### 🔧 Refactoring

- Dropped cjs support. All packages now build for esm only (c6835bf)

### 🧹 Chores

- Updated deps (1e5d26b)

---

## v1.21.0 (2025-12-08)

### ✨ Features

- Added NestJS Socket.io module refactor: Improvements and minor fixes (ff8359e)

### 🐛 Bug Fixes

- Generic type variable not passed to superclass. (1386d86)

### 🧹 Chores

- Code formatting (e1674a0)
- Updated deps (2ce4fcf)
- Added publicConfig (d728f18)

---

## v1.20.0 (2025-12-05)

### ✨ Features

- Added ArrayType, deprecated isArray flags (cdb3cdb)

### 🐛 Bug Fixes

- Data types like Date, Buffer do decode as string (f3e6801)

### 🔧 Refactoring

- Refactored ExecutionContext properties (af22a93)
- Minor code imporovements (82b1b50)

### 🧹 Chores

- Updated deps (45f1660)

### 💬 General Changes

- Starting ArrayType implementation (94457f8)

---

## v1.19.7 (2025-11-03)

### 🐛 Bug Fixes

- No type name issue (ce495ee)

### 🧹 Chores

- Move checkout and setup enviroment to the first (98aa913)

---

## v1.19.6 (2025-10-27)

### 🐛 Bug Fixes

- Joined url paths are invalid in Windows (7be79a5)
- No type name issue (b7e38f0)

---

## v1.19.5 (2025-10-24)

### ✨ Features

- Added additional property support to ErrorIssue (e03cfb0)
- Added WebSocket api support to api document (b2738cf)

### 🐛 Bug Fixes

- EnumTypes should ignore numbered keys which added by typescript chore: Updated deps (bf8deba)
- Invalid code generation of union array fields (e72d6fc)

### 🔧 Refactoring

- Created separate namespace (mq) for message queue protocols. Renamed all classes from RpcXX to MQXX (1246e73)

### 🧹 Chores

- Updated dependencies (671f4c0)

---

## v1.19.4 (2025-08-15)

### ✨ Features

- Added additional property support to ErrorIssue (f861900)

---

## v1.19.3 (2025-08-14)

### 🧹 Chores

- updated dependencies (4c73333)

---

## v1.19.2 (2025-07-30)

### 🐛 Bug Fixes

- "date" type now exporting as string (b40d9bc)

---

## v1.19.1 (2025-07-29)

### 🐛 Bug Fixes

- Fixed date and datetime data type issues (5427d05)

---

## v1.19.0 (2025-07-24)

### ✨ Features

- Added partialdate data type (8c631af)

### 🧹 Chores

- Updated dependencies (01a82dd)

### 💬 General Changes

- Fixed build issues (73224d2)

---

## v1.18.0 (2025-07-24)

### ✨ Features

- Added datetimetz data type refactor: Refactored date, datetime data types, removed datestring and datetimestring data types. date, datetime, base64 not supports convertToNative parameter to decode string to native objects. (d62e886)

### 🧹 Chores

- Updated deps (4ff2306)

---

## v1.17.7 (2025-07-11)

### 🐛 Bug Fixes

- Changed overloading to fixed typing issues for OmitType and PartialType (92ea731)

### 🧹 Chores

- Updated deps (28936ed)

### 💬 General Changes

- Removed generateSchemaHook (9105ea4)

---

## v1.17.6 (2025-06-23)

### 🧹 Chores

- Downgraded angular dev versions doe to build error (9d7d9e4)

### 💬 General Changes

- Fixed ncurc file (b138bcf)
- Fixed wrong codec generation (fieldCache issue) (170d194)

---

## v1.17.5 (2025-06-19)

### 🐛 Bug Fixes

- Fixed typing issues (581f90d)
- Maximum call stack error when generating codec for complex types which has filed that points to itself (circular dep) (d79f021)

### 🧹 Chores

- Updated dependencies (807d0af)

---

## v1.17.4 (2025-06-13)

### 🐛 Bug Fixes

- Fixed circular reference error issue (920cb45)

### 🧹 Chores

- Updated dependencies (7c9ed62)

---

## v1.17.3 (2025-05-22)

### 🔧 Refactoring

- Removed isNotEmpty validation rule for required fields (f9258db)

---

## v1.17.2 (2025-05-09)

### 🐛 Bug Fixes

- Setting minValue=0 of some simple types (BigInt, Number, Integer) types ignores the value. (b230bcb)

### 🧹 Chores

- Updated dependencies (d461034)

### 💬 General Changes

- Removed unnecessary dependencies (ea60696)

---

## v1.17.1 (2025-05-06)

### ✨ Features

- Exposed Connection of RabbitmqAdapter (7e16d8a)

### 🧹 Chores

- Minor change (8a995dd)

---

## v1.17.0 (2025-05-05)

### 🐛 Bug Fixes

- Cli generator should export "date" data type "string" (9e0d3de)

### 🔧 Refactoring

- Moved to rabbitmq-client (116307c)

### 🧹 Chores

- Updated dependencies (ec93912)

---

## v1.16.1 (2025-04-30)

### 🐛 Bug Fixes

- Fixed test (e16a0c1)
- Fixed channel setup issue (b5d6c27)

### 🔧 Refactoring

- Removed unused cppzst module (7dce547)
- Changed typing (58c138a)

---

## v1.16.0 (2025-04-30)

### 🐛 Bug Fixes

- Fixed tests (f30defc)

### 🔧 Refactoring

- Implemented amqp-connection-manager (bc749b8)

### 🧹 Chores

- Updated dependencies (c5c9b4b)

---

## v1.15.1 (2025-04-29)

### 🔧 Refactoring

- Updated elastic version (1067dc0)
- Removed path filter (0930274)
- Improved typing for adapters chore: Updated dependencies (cf3898d)

---

## v1.15.0 (2025-04-25)

### ✨ Features

- Added UnionType data type (e7f1cac)

### 🐛 Bug Fixes

- Fixed invalid build issue (f5dd20f)

### 🔧 Refactoring

- Updated dependencies (0e73f11)
- Refactored MixinType arguments. Other Improvements (c3df30c)

### 🤖 Continuous Integration

- Added release workflow ci: Updated test and qc workflows (2ef67cb)

### 💬 General Changes

- Added missing coverage config (37092fc)
- Minor changes for npm warns (c5a3caf)

---

## v1.14.0 (2025-04-12)

### 🐛 Bug Fixes

- Fixed major bugs refactor: Moved from jest to mocha refactor: Moved from ts-node to swc refactor: Moved to c8 for coverage (f324adb)

### 💬 General Changes

- Minor dev changes (7295020)

---

## v1.13.0 (2025-04-10)

### 🐛 Bug Fixes

- Fixed missing "expect" imports (493c204)

### 🔧 Refactoring

- Updated express to v5 (ac69025)

### 🧹 Chores

- Updated dependencies (38df580)

### 💬 General Changes

- Minor dev changes (ff3ff01)

---

## v1.12.6 (2025-03-27)

### ✨ Features

- Added protected raw crud methods. (355e1ea)

---

## v1.12.5 (2025-03-27)

### 🐛 Bug Fixes

- Should send ack when message is not valid but logged. (b322a4a)

---

## v1.12.4 (2025-03-27)

### ✨ Features

- Added message, ack() and nack() to RabbitmqContext chore: Updated dependencies (2ab5bd5)

### 🔧 Refactoring

- Improved amqp connection error message handling (0b10785)

### 🤖 Continuous Integration

- Updated workflows (5e38da1)
- Updated workflow (4e4a748)

### 🧹 Chores

- Updated dependencies (3f6df60)

---

## v1.12.3 (2025-03-17)

### 🐛 Bug Fixes

- Fixed _getInputCodec issue (9116f13)

### 🧹 Chores

- Updated dependencies (5dea8bb)

---

## v1.12.2 (2025-03-14)

### 🐛 Bug Fixes

- Fixed typings (11391d2)

### 🔧 Refactoring

- Check isNotEmpty rule for required fields (cea83e5)

### 🧹 Chores

- Updated dependencies (2f98ed3)

---

## v1.12.1 (2025-03-11)

### 🔧 Refactoring

- Exposed elastic types (e1a5e33)

---

## v1.12.0 (2025-03-06)

### ✨ Features

- Added replaceIfExists option to ElasticEntityService.create() (4f92aeb)

### 🐛 Bug Fixes

- Fixed error emit issue (89ef7fe)
- Fixed error event emitting with wrong params (4b101c4)

### 🔧 Refactoring

- Removed i18n translations (bf08919)
- Updated dependencies and implemented changes (6be7455)

### 🧹 Chores

- Updated dependencies (1e60cfd)

---

## v1.11.1 (2025-03-01)

### 🔧 Refactoring

- Moved opra dependencies to "peerDependencies" (846a6c9)
- Added "queue" to RabbitmqContext (77a3a64)

### 🧹 Chores

- Updated dependencies (65c0e39)

### 💬 General Changes

- Updated github workflows (ee72b1f)
- Updated rman and build configuration (5a00c9b)

---

## v1.11.0 (2025-02-26)

### 🔧 Refactoring

- Moved NestJS support for http, kafka and rabbitmq to separate modules. (61329e1)

### 🧹 Chores

- Updated dependencies (2d5af1e)
- Minor fix (6d17267)

---

## v1.10.0 (2025-02-24)

### ✨ Features

- Added RabbitMQ adapter and NestJS module (99aa6fa)

### 🧪 Tests

- Minor fixes (832f34d)

### 🧹 Chores

- Updated dependencies (2ac2997)

### 💬 General Changes

- Minor fixes (21c3865)

---

## v1.9.4 (2025-02-10)

### 🐛 Bug Fixes

- Fixed invalid esm import of nestjs package (3305fae)

### 🔧 Refactoring

- Updated dependencies (6ee125b)

---

## v1.9.3 (2025-02-04)

### 🐛 Bug Fixes

- Fixed MappedType excludes scoped fields issue (2d05f84)

### 🧹 Chores

- Updated dependencies (363a7d4)

---

## v1.9.2 (2025-02-03)

### ✨ Features

- Added field mapping ability to filter (61912e1)

---

## v1.9.1 (2025-02-01)

### 🔧 Refactoring

- Refactored Filter prepare arguments feat: Implemented prepare callback to mongodb and sqb adapters fix: Fixed tests (52a2ee3)

### 🧹 Chores

- Updated dependencies (848a4c6)

---

## v1.9.0 (2025-01-31)

### ✨ Features

- Adding field mapping support to "sort" query parameter (bddab73)
- Added "prepare" callback option to Filter decorator (d4b4ca3)

### 🧹 Chores

- Typo changes (887826f)

---

## v1.8.0 (2025-01-28)

### ✨ Features

- Added Field.isNestedEntity option (5ed60df)

### 🐛 Bug Fixes

- Added missing DateTimeLiteral to filter parser (56f0908)

### 🧹 Chores

- Updated dependencies (d3ec024)
- Typo changes (f8edd88)

---

## v1.7.4 (2025-01-24)

### 🐛 Bug Fixes

- Array parameters splits string with many delimiters (77c320c)

### 🧹 Chores

- Update dependencies dev: Added ncu for dependency updates (52d6d0f)

---

## v1.7.3 (2025-01-20)

### 🧹 Chores

- Updated dependencies (ceb9520)

---

## v1.7.2 (2025-01-17)

### 🧹 Chores

- Updated dependencies (2a62da5)

---

## v1.7.1 (2025-01-13)

### 🔧 Refactoring

- Renamed search method to searchRaw (62528ff)

### 🧹 Chores

- Updated dependencies (9db7143)

---

## v1.7.0 (2025-01-11)

### ✨ Features

- Added keepKeyFields option for codec generation (80dd5d6)

### 🧹 Chores

- Updated dependencies (6faf33e)

### 💬 General Changes

- Refactored typings (d6f7e18)

---

## v1.6.0 (2025-01-06)

### ✨ Features

- Added keepKeyFields option for codec generation (8866088)

### 🐛 Bug Fixes

- Fixed error message (ca2c2d5)

### 🔧 Refactoring

- Minor refactors (3988e41)

### 🧹 Chores

- Formatting (ffe4130)
- Updated dependencies (28d7c37)

### 💬 General Changes

- Prevent "the path must exist in the document in order to apply array updates" error (432760f)

---

## v1.5.7 (2024-12-23)

### 🐛 Bug Fixes

- Fixed projection bugs based on scope support (07954f9)

---

## v1.5.6 (2024-12-20)

### 🐛 Bug Fixes

- Fixed bugs based on scope support (ab094b5)

---

## v1.5.5 (2024-12-19)

### ✨ Features

- Added override feature for fields (18c5254)

### 🐛 Bug Fixes

- Fixed bugs related to Scope (3f73c81)

---

## v1.5.4 (2024-12-19)

### 💬 General Changes

- Codec cache should implement scopes (1c41cc3)

---

## v1.5.3 (2024-12-19)

### 🔧 Refactoring

- Improved scope support (04f702e)

---

## v1.5.2 (2024-12-18)

### 🔧 Refactoring

- Improved scope support (98b602d)

---

## v1.5.1 (2024-12-18)

### ✨ Features

- Added scope support refactored: Removed hidden option in ApiField (4db354e)

### 🔧 Refactoring

- Improved scope support (e37f20c)

---

## v1.5.0 (2024-12-16)

### ✨ Features

- Added scope support refactored: Removed hidden option in ApiField (b94c6f3)

### 🧹 Chores

- - (9655f1e)

---

## v1.4.4 (2024-12-09)

### 🐛 Bug Fixes

- DataTypeMap returns unexpected instance when same data type name exists in any reference in document (3ee7255)

### 🧹 Chores

- Updated dependencies (2c18973)

### 💬 General Changes

- Migrated to ESLint 9 (2c8c100)

---

## v1.4.3 (2024-12-05)

### 🐛 Bug Fixes

- Minor typing fixes (b9b5b3b)

### 🧹 Chores

- Updated dependencies (168af3d)

---

## v1.4.2 (2024-12-03)

### 🐛 Bug Fixes

- Fixed tests (846ce6e)
- Fixed kafka nestjs adapter (fcefb16)

### 🧹 Chores

- Updated dependencies (b813799)

---

## v1.4.1 (2024-12-02)

### ✨ Features

- Added allowPatchOperators to HttpOperator options (7b3edb8)

---

## v1.4.0 (2024-11-28)

### ✨ Features

- Added $add operator to MongoPatchGenerator (6d6ea88)
- Improvements and optimizations for MongoDB (dcf7259)

### 🧹 Chores

- Updated dependencies (0429a82)

---

## v1.3.1 (2024-11-27)

### ✨ Features

- Added $add operator to MongoPatchGenerator (1cc7923)

---

## v1.3.0 (2024-11-27)

### ✨ Features

- Added MongoPatchGenerator (e1ddb6d)

---

## v1.2.3 (2024-11-26)

### 🔧 Refactoring

- Added protected _prepareUpdate method (6a5a1e9)
- Minor typing change (1c86c08)

### 🧹 Chores

- Updated dependencies (5f1d5c2)

---

## v1.2.2 (2024-11-25)

### ✨ Features

- Added defining pre-stages and post-stages for MongoNestedService (293b519)

### 🔧 Refactoring

- Move to @jsopen/objects package according to putil-merge (a65d5db)

### 🧹 Chores

- updated dependencies (c17fb13)

---

## v1.2.1 (2024-11-19)

### 🐛 Bug Fixes

- Renamed localisation to localization (1d710b6)

### 🧹 Chores

- Updated dependencies (2995b93)

---

## v1.2.0 (2024-11-19)

### ✨ Features

- Added defining pre-stages and post-stages for MongoDB find operations (998565d)

### 🔧 Refactoring

- Renamed translatable to localisation (3e459d0)

---

## v1.1.1 (2024-11-18)

### ✨ Features

- Added "replace" method to MongoCollectionService (a8b87cb)
- Added "Replace" operation (1ca5ca9)
- Added "arrayIdField" property to Field (90ab2cc)
- Renamed "arrayIdField" to 'keyField' (1d395a7)

### 🐛 Bug Fixes

- keyField property is missing (462ce42)

---

## v1.0.10 (2024-11-15)

### ✨ Features

- Added documentNode to ExecutionContext (cd7cd1b)

### 🔧 Refactoring

- Use context.documentNode to determine DataType instance (684cf1d)
- Minor refactors (b550769)

### 🧹 Chores

- Updated versions (e02b856)
- Updated dependencies (a19e3fb)

---

## v1.0.8 (2024-10-18)

### 🐛 Bug Fixes

- withTransaction method duplication (9d061d6)

---

## v1.0.7 (2024-10-18)

### ✨ Features

- Added SqbServiceBase as a base class (bea562d)

### 🐛 Bug Fixes

- Fixed KafkaAdapter error message handling (bbc8bad)
- Server never response if not context created yet (83a2e17)

### 🔧 Refactoring

- generateId callback will be called if input._id is an empty string also. (df54720)

---

## v1.0.6 (2024-10-17)

### 🐛 Bug Fixes

- Fixed KafkaAdapter error message handling (9bf5066)

---

## v1.0.5 (2024-10-17)

### 🔧 Refactoring

- Improved adapter initialization logic (d87305e)

### 🧹 Chores

- updated versions (e02c231)
- updated workflow name (7180bf5)
- Updated dependencies (8a3aa1b)

---

## v1.0.4 (2024-10-15)

### 🐛 Bug Fixes

- Do not set consumer groupId (136b305)

### 🧹 Chores

- format (2d16bef)

---

## v1.0.3 (2024-10-15)

### 🐛 Bug Fixes

- KafkaAdapter do not create consumers (b6f8988)

---

## v1.0.2 (2024-10-11)

### ✨ Features

- alpha 10 release (101c6e3)
- Added kafka package feat: Added http package refactor: Removed http server from core package fix: Fixed many bugs (06c0dc0)

### 🐛 Bug Fixes

- Circular dependencies (a57e71d)
- toJSON() do not export types (10a6d8f)
- Do not commit transaction on successful execution of withTransaction() function (05a6cac)
- Fixed bugs, improvements (d73d9fd)
- Fixed kafka test (6583e42)
- Do not allow '*value*' for 'like' filters. Data validation prevents. (010f0d2)

### 🔧 Refactoring

- enabled "verbatimModuleSyntax" in tsconfig and fixed all codes to run with this flag (846cd52)
- Moved http server features to @opra/http module (e1f9aae)
- Renamed "msg" api to "rpc" add: Added Kafka NestJS module (initial) (989d2ef)
- Improved withTransaction support (252c999)
- Improved Kafka adapter (e8ee45c)
- Improved Kafka nestjs (3fec64a)

### 🧹 Chores

- Added lint:fix script (c204b4b)
- Updated dependencies (06b800f)
- Removed slashes from paths (d66a2c0)
- Update version 1.0.0-alpha.13 (598f01a)
- Updated version to alpha.17 (af34ef8)
- Typing (c379430)
- updated version to 1.0.0-alpha.21 (5003eb5)
- Updated version to 1.0.0-alpha.23 (4e7a1ea)
- Updated postgrejs (79041a1)
- Updated version (191f6fc)
- Lint fixes (6bc5bc5)
- Removed "error" from event arguments (de002c2)
- Update dependencies (2eacdd4)
- Made RequestOptions partial (249a3c3)
- Set "strictPropertyInitialization" option in tsconfig to get ready for ES2022. Added "declare" modifiers to classes to clean type errors. (cd55409)
- Minor typing fix (d8fe5b4)
- updated dependencies (d240011)
- Minor improvements (5113af1)
- fix ElasticSearch issue (c8596ff)
- updated versions (85463b9)
- Updated config (b5e5a83)
- Enabled Kafka tests, Enabled coveralls (3fed7f4)
- Updated versions (f437be4)
- Updated build config (a7f09c1)
- Updated version to 1.0.0-beta.4 (791e3d9)
- Updated SQB (793c958)
- Fixed npm i (19a8a80)
- Added logging for kafka tests (da67767)
- Kafka test timeout fix #1 (c43e0a6)
- Kafka test timeout fix #2 (c622888)
- Kafka test timeout fix #3 (0258416)
- Kafka test timeout fix #4 (076596a)
- Kafka test timeout fix #5 (25e2f4f)
- Kafka test timeout fix #6 (c859540)
- Kafka test timeout fix #7 (6b3b5eb)
- Kafka test timeout fix #8 (062adf5)
- Kafka test timeout fix #9 (433f74a)
- npm cache (97e98cc)
- Released 1.0.1 (5811cb2)

### 💬 General Changes

- Code documentation (1705ee1)
- Added RegExp support for Http request query parameters (6d618c4)
- Renamed Operation to ApiOperation, Action to ApiAction (eadc6e1)
- Implemented ApiResponse (abc8045)
- Renamed Resource to ApiResource (0647967)
- Renamed ResourceDecorator to ApiResourceDecorator (de3bb46)
- Fixed throws error if no update made (8a590c6)
- New Resource system. Replaced all resource interfaces (Collection,Singleton,Storage) with single Resource interface. (alpha) (9271221)
- New Resource system vol2 (f59390f)
- Implemented multi service api document (78e1a8c)
- Implemented multi protocol api document (a5683cc)
- Renamed HttpResponse to HttpEndpointResponse (1884eaa)
- Moved TypeThunk, TypeThunkAsync, ThunkThunkAsync, DTO, PartialDTO to ts-gems package (f223ce7)
- Replaced "pick", "omit" and "include" parameters with single "fields" parameter (96637f1)
- Added missing "description" property to HttpParameter (892066b)
- Split "parameters" and "headers" in schema (37962b4)
- Fixed missing "headers" (bd53f06)
- new data type implementation (66a4bec)
- Bulk update for new major release (507beb1)
- Rename "children" property of HttpController to "controllers" (02b2d0e)
- Removed "root" property of HttpApi, added "controllers" property (db5d805)
- Re designer adapters (4ecf2e8)
- Bulk update for v1.0 release (9c4526b)
- alpha.1 release (d9b4cfa)
- Throws error if nameOrCtor property is null or undefined (a7735e2)
- Added "ns" and "references" query parameter option to sendDocumentSchema() method (f6e3df8)
- Format (5a0b8bc)
- Added "id" to ApiDocument (c3ea348)
- Added "findDocument" method which finds document by id (660b6a7)
- Added ability to return document schema by id (69e8af2)
- Fixed several bugs (0e8cf84)
- Added "readonly" and "writeonly" fields support (6248fad)
- Added "nameMappings" to SimpleType (45df2d8)
- DataTypeFactory creates multiple copies of types (3960934)
- Implemented cli tool (71e535d)
- Fixed. Error issue not sent back to client (9addc66)
- Released 1.0.0-alpha.7 (51f100d)
- Migrated eslint config to @panates/eslint-config (1c9e707)
- Migrated to @panates/tsconfig (67ff5b6)
- Added root (98134ee)
- Fixed circleci config (3cdf3ca)
- Not returning schema with /$schema root (976d8af)
- Minor change (9f01f95)
- Remove dev branch (adc85f0)
- Updated dependencies (011a024)
- schemaRouteIsPublic option (62b97c4)
- CLI Generating invalid code (77b0c35)
- Does not export "path" property in to schema (413cd52)
- Update only generates invalid encoder (9c8cd04)
- Fixed tests (10bc893)
- Alpha 11 release (caa110b)
- Fixed bugs (64e6fa5)
- Added `mergeParam` option to HttpOperation (d24e1f3)
- Improvements and bug fixes (0a98f55)
- Must return OperationResult type (8ea638f)
- Does not call guards and interceptors of parent controllers (c5556be)
- chore: (2a0bc6b)
- Implement better intercept algorithm (71de9bf)
- Updated all dependencies compatible to TypeScript 5.5.3 Reformatted code with prettier 3.3.3 Fixed lint problems Implemented better interceptor algorithm for mongodb and sqb packages (6adc71a)
- Dependency injection bug (7b77d71)
- Do not merge serviceUrl and request path well in browsers (3bc3ac3)
- do not replace all "*" characters with "&" (1090428)
- Does not add path parameter of parent controllers (b8f9533)
- chore. Updated version (c309f53)
- Interceptor function is calling multiple times (5c00519)
- Do not copy decorator metadata from third parent (6d2c3b7)
- Invalid JSDoc generation for @param. Also includes improvements to generate JSDoc for parameters and adds additional fields for query parameters. (fd52fd6)
- This commit fixes the adapter to correctly copy decorator metadata from parent controllers to child controllers. (5858199)
- Optimized browser build (9ab7348)
- Improved MultipartReader Improved adapter logging Improved NestJS adapter Bug fixes (187ee3b)
- defaultLimit and defaultSort do nothing. Added defaultProjection (6acb022)
- Do not copy isPublic metadata to child controllers (a76c1c5)
- Improved Interceptors Improved NestJS support (fea6159)
- Do not allow empty paths (958e5e8)
- Typings (31c2b75)
- NestJS sets statusCode to 201 by default for POST methods (9052712)
- Multipart reader ignores exclusive fields on decode (24411b4)
- Added "tslib" to dependencies (faef841)
- ES2022 class fields "declare" issues (69e8749)
- Replaced "node:crypto" module with "super-fast-md5" for browser support (7cb30dc)
- Added "referenceNamespaces" option to cli tool (d067379)
- Implemented better typings for resource services (d4d5021)
- Fixed exports in package.json for Node16 and NodeNext module resolutions (d049066)
- Fixed dependencies (44afe79)
- Removed Collection|Singleton|Resource from CLASS_NAME_PATTERN (8144290)
- Now commonFilter can be an array (d1d0daa)
- Now documentFilter can be an array (9ef4c4a)
- Updated esbuild-tsc package (698c214)
- Fixed codes according to eslint rules (4ff40c0)
- Fixed compatibility for "Node16" and "NodeNext" moduleResolution options (7e3c69c)
- Fixed browser build Added before[X] and after[X] hooks to SqbEntityService (6062c3e)
- Added before[X] and after[X] hooks (72bd7bf)
- Added missing generic param to CreateCommand (6684361)
- Stopped using esbuild-tsc because of a typescript bug (987522a)
- Encoder cache issue (642ae6d)
- generateCodec issue (56794c1)
- Some bug fixes (2095004)
- Added "elastic" support (6e22a2f)
- Minor fixes and improvements (1cb80aa)
- Creates multiple instances of same document (7ff5b2b)
- Improvements and optimizations (8a2c84f)
- Added ElasticSearch image (ae13bd2)
- fixed typings (2b2187e)

---

## v1.0.1 (2023-05-16)

### 💬 General Changes

- Updated dependencies (25c88a4)
