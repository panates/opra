<div align="center">

<a href="https://oprajs.com">
  <img src="https://oprajs.com/img/opra-header-block.webp" width="880" alt="OPRA — Open Platform for Rich APIs" />
</a>

# @opra/api-ui

Modern, interactive API reference UI rendering an Opra `ApiDocument`'s native schema

[🌐 Documentation](https://oprajs.com) · [🚀 Getting Started](https://oprajs.com/docs/introduction) · [📦 Packages](https://github.com/panates/opra#packages) · [💬 Issues](https://github.com/panates/opra/issues)

</div>

---

## Installation

```bash
npm install @opra/api-ui
```

## Usage

```ts
import { ApiUiFactory } from '@opra/api-ui';

const html = ApiUiFactory.render(apiDocument, {
  pageTitle: 'My API',
});
```

### Express

```ts
import { expressApiUi } from '@opra/api-ui';

app.use('/reference', expressApiUi(apiDocument, { pageTitle: 'My API' }));
```

Unlike Swagger UI or Scalar, this package renders Opra's own native schema directly — controllers (with nested sub-controllers), operations, and data types (complex, simple, enum, union, mixin, mapped) — with no conversion to OpenAPI and no external UI dependency. The whole client-side renderer is a small, dependency-free vanilla JS/CSS bundle inlined into the page.

The reference UI is organized as separate pages (not one long scrolling document): an overview page, one page per controller, one page per operation, and one page per named model, all linked from a sidebar tree that mirrors the controller hierarchy and groups models by kind.

If the `ApiDocument` has `references` to other documents, a document switcher in the header lets the viewer jump to any of them — the referenced document's schema is fetched on demand from the server's `$schema?id=...` endpoint the first time it's selected.
