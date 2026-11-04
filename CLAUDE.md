# opra

OPRA is a TypeScript framework for rich APIs, published to npm as `@opra/*` packages that release
together under one version (lockstep, `v*` tags).

## Layout

- `packages/common`: the schema, decorators and `ApiDocument`. `packages/core`, `packages/http`:
  the server side. `packages/client`, `packages/angular`: the clients.
- Transports: `kafka`, `rabbitmq`, `socketio` and their `nestjs-*` modules, plus `nestjs` and
  `nestjs-http`. Data adapters: `mongodb`, `sqb`, `elastic`. Tools: `cli`, `openapi`, `api-ui`,
  `testing`.
- `packages/angular` builds with `ng build` (ng-packagr writes its exports), not with rman's
  TypeScript build.
- `examples/` and `examples/_lib/` are workspace members that are never published.
- `support/test/global-setup.ts` prepares the test databases when mocha runs from the root.

## Tests

CI starts Kafka, PostgreSQL, RabbitMQ, MongoDB and Elasticsearch (`.github/workflows/test.yml`).
Running mocha from the root sets `INIT_MONGODB`, `INIT_SQB`, `INIT_ELASTIC` and `INIT_KAFKA`
(`.mocharc.cjs`), so the global setup fills those databases first; a package's own `.mocharc.cjs`
sets only its own. Locally, suites for a server that is not running fail with connection errors.
The root `test` script type-checks with `tsc -b tsconfig-test.json` before mocha.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Before every push

Check for dependency updates first, and push only once they are in and verified:

1. `pnpm exec rman deps` - lists the dependencies that have a newer version. If it lists none, push.
   It needs rman >= 2.40.0: 2.39 verifies an upgrade with npm (`.rmanrc` pins npm for publishing),
   fails on `workspace:` ranges and rolls the upgrade back. While the repository's own rman is
   older, run `npx -y rman@latest deps` instead.
2. Otherwise `rman deps -u` to upgrade them (with verification on), then `pnpm install` and
   `pnpm dedupe`. Dedupe matters: a wide peer range otherwise keeps an old copy of a package beside
   the new one, and NestJS's DI breaks on two copies of @nestjs/core.
3. Verify:
   - `tsc -p tsconfig-test.json --noEmit`. Use `-p`, not `-b`: `tsc -b` can trust a stale
     tsconfig-test.tsbuildinfo and check nothing.
   - `rman check`, `rman lint`, `pnpm run build` and `pnpm run citest`. The tests need MongoDB,
     Elasticsearch, Kafka, RabbitMQ and PostgreSQL running locally.
4. Commit the manifests and the lockfile as a `chore(deps)` commit, then push.

pnpm-workspace.yaml sets `minimumReleaseAge: 0` on purpose: upgrades take releases as soon as
they are published, in CI as well. Do not reintroduce a minimum age or `minimumReleaseAgeExclude`
entries without asking.

If verification fails, fix it or stop and report; do not push an upgrade that breaks the build
or the tests.
