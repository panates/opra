import 'reflect-metadata';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  OpraSchema,
  TranslationFileStore,
} from '@opra/common';
import { expect } from 'expect';
import express from 'express';
import supertest from 'supertest';
import { expressApiUi } from '../src/express/express-api-ui.js';

@ComplexType({ description: 'A customer' })
class Customer {
  @ApiField({ required: true })
  declare id: string;
}

describe('api-ui:expressApiUi', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [],
      },
    });
  });

  it('Should serve the rendered API reference page as text/html', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('window.__OPRA_DOCS__');
  });

  it('Should reuse the cached HTML across requests instead of re-rendering', async () => {
    const app = express();
    const handler = expressApiUi(doc, { pageTitle: 'Cached' });
    app.use('/reference', handler);
    const first = await supertest(app).get('/reference');
    const second = await supertest(app).get('/reference');
    expect(first.text).toStrictEqual(second.text);
  });

  it('Should serve the native Opra schema as JSON at /schema/root.json', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const res = await supertest(app).get('/reference/schema/root.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.info.title).toStrictEqual('TestApi');
    expect(res.body.api.transport).toStrictEqual('http');
  });

  it('Should map the document to OpenAPI as JSON at /openapi/root.json', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const res = await supertest(app).get('/reference/openapi/root.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toStrictEqual('3.0.3');
    expect(res.body.info.title).toStrictEqual('TestApi');
  });

  it('Should respond 404 for an unknown document key on either export route', async () => {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    const schemaRes = await supertest(app).get('/reference/schema/nope.json');
    const openapiRes = await supertest(app).get('/reference/openapi/nope.json');
    expect(schemaRes.status).toBe(404);
    expect(openapiRes.status).toBe(404);
  });

  it('Should respond 400 mapping a non-HTTP document to OpenAPI', async () => {
    const typesOnlyDoc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TypesOnly', version: 'v1' },
      types: [Customer],
    });
    const app = express();
    app.use('/reference', expressApiUi(typesOnlyDoc));
    const res = await supertest(app).get('/reference/openapi/root.json');
    expect(res.status).toBe(400);
  });
});

describe('api-ui:expressApiUi (languages)', () => {
  let translatedDoc: ApiDocument;

  before(async () => {
    translatedDoc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: { transport: 'http', name: 'TestApi', controllers: [] },
      translations: {
        en: { types: { Customer: { description: 'A customer (en)' } } },
        tr: { types: { Customer: { description: 'Bir müşteri (tr)' } } },
      },
    } as any);
  });

  function serve() {
    const app = express();
    app.use('/reference', expressApiUi(translatedDoc));
    return app;
  }

  it('Should serve the schema in the language given by ?lang=', async () => {
    const tr = await supertest(serve()).get(
      '/reference/schema/root.json?lang=tr',
    );
    const en = await supertest(serve()).get(
      '/reference/schema/root.json?lang=en',
    );
    expect(tr.body.types.Customer.description).toStrictEqual(
      'Bir müşteri (tr)',
    );
    expect(en.body.types.Customer.description).toStrictEqual('A customer (en)');
  });

  it('Should fall back to the default language for an unknown ?lang=', async () => {
    const res = await supertest(serve()).get(
      '/reference/schema/root.json?lang=zz',
    );
    expect(res.status).toBe(200);
    expect(res.body.types.Customer.description).toStrictEqual(
      'A customer (en)',
    );
  });

  it('Should ignore Accept-Language, so one URL always means one response', async () => {
    const res = await supertest(serve())
      .get('/reference/schema/root.json')
      .set('Accept-Language', 'tr-TR,tr;q=0.9');
    // No `?lang` at all: the document's default language, never the
    // header's.
    expect(res.body.types.Customer.description).toStrictEqual(
      'A customer (en)',
    );
  });

  it('Should cache the rendered page per language, not just per scope', async () => {
    // One handler for both requests: a cache keyed only by scope would
    // hand the second request whatever the first one rendered.
    const app = serve();
    const tr = await supertest(app).get('/reference?lang=tr');
    const en = await supertest(app).get('/reference?lang=en');
    expect(tr.text).toContain('Bir müşteri (tr)');
    expect(en.text).toContain('A customer (en)');
    expect(tr.text).toContain('"lang":"tr"');
  });

  it('Should offer document languages and interface-only languages apart', async () => {
    const res = await supertest(serve()).get('/reference');
    // The menu spans both sets; `docLanguages` is what lets the selector
    // say which of them actually change the documentation's own prose.
    expect(res.text).toContain('"docLanguages":["en","tr"]');
    expect(res.text).toContain('"ja"');
  });
});

describe('api-ui:expressApiUi (interface language)', () => {
  let doc: ApiDocument;

  before(async () => {
    // Deliberately *untranslated*: the overwhelmingly common case, and the
    // one where `ApiDocument#resolveLanguage` resolves to nothing at all.
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: { transport: 'http', name: 'TestApi', controllers: [] },
    } as any);
  });

  function serve() {
    const app = express();
    app.use('/reference', expressApiUi(doc));
    return app;
  }

  it('Should localize the interface even when the document has no translations', async () => {
    const res = await supertest(serve()).get('/reference?lang=tr');
    expect(res.text).toContain('"overview":"Genel bakış"');
  });

  it('Should set <html lang> and <html dir> from the interface language', async () => {
    const tr = await supertest(serve()).get('/reference?lang=tr');
    const ar = await supertest(serve()).get('/reference?lang=ar');
    expect(tr.text).toContain('lang="tr" dir="ltr"');
    expect(ar.text).toContain('lang="ar" dir="rtl"');
  });

  it('Should fall back to English for a language it does not ship', async () => {
    const res = await supertest(serve()).get('/reference?lang=zz');
    expect(res.status).toBe(200);
    expect(res.text).toContain('lang="en" dir="ltr"');
    expect(res.text).toContain('"overview":"Overview"');
  });

  it('Should cache the page per interface language', async () => {
    // Both requests share one handler. With an untranslated document the
    // document's own language is always '', so a cache key built from that
    // alone would serve the first reader's interface to everyone after.
    const app = serve();
    const tr = await supertest(app).get('/reference?lang=tr');
    const ja = await supertest(app).get('/reference?lang=ja');
    expect(tr.text).toContain('"overview":"Genel bakış"');
    expect(ja.text).toContain('"overview":"概要"');
  });
});

@ComplexType({ description: 'A record with a db-only field' })
class ScopedRecord {
  @ApiField({ required: true })
  declare id: string;

  // Only visible when exported/rendered under the "db" scope — the same
  // `scopePattern` mechanism `examples/_lib/customer-mongo`'s own models
  // use for their real db-only fields.
  @ApiField({ scopePattern: 'db' })
  declare secret?: string;
}

describe('api-ui:expressApiUi (scopes)', () => {
  let scopedDoc: ApiDocument;

  before(async () => {
    scopedDoc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'ScopedApi', version: 'v1' },
      types: [ScopedRecord],
      api: { transport: 'http', name: 'ScopedApi', controllers: [] },
    });
  });

  it('Should 301-redirect a bare mount root to the given default scope', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(301);
    expect(res.headers.location).toStrictEqual('/reference/api');
  });

  it('Should fall back to scopes[0] when no default scope is given', async () => {
    const app = express();
    app.use('/reference', expressApiUi(scopedDoc, { scopes: ['db', 'api'] }));
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(301);
    expect(res.headers.location).toStrictEqual('/reference/db');
  });

  it('Should respond 404 for an unrecognized scope segment', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const res = await supertest(app).get('/reference/nope');
    expect(res.status).toBe(404);
  });

  it('Should embed the requested scope (not just the default) in window.__OPRA_UI__', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const res = await supertest(app).get('/reference/db');
    expect(res.status).toBe(200);
    expect(res.text).toContain('"scope":"db"');
    expect(res.text).toContain('"scopes":["api","db"]');
    expect(res.text).toContain('"basePath":"/reference"');
  });

  it('Should not embed a "scopes" list at all when only one scope is configured', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api'] }),
    );
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('"scopes"');
  });

  it('Should filter fields by the URL scope segment, not just the configured default', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );

    const apiRes = await supertest(app).get('/reference/api/schema/root.json');
    expect(apiRes.body.types.ScopedRecord.fields.secret).toBeUndefined();

    const dbRes = await supertest(app).get('/reference/db/schema/root.json');
    expect(dbRes.body.types.ScopedRecord.fields.secret).toBeDefined();
  });

  it('Should cache rendered HTML separately per scope', async () => {
    const app = express();
    app.use(
      '/reference',
      expressApiUi(scopedDoc, { scope: 'api', scopes: ['api', 'db'] }),
    );
    const apiRes = await supertest(app).get('/reference/api');
    const dbRes = await supertest(app).get('/reference/db');
    expect(apiRes.text).not.toStrictEqual(dbRes.text);
    expect(apiRes.text).toContain('"scope":"api"');
    expect(dbRes.text).toContain('"scope":"db"');
  });
});

describe('api-ui:expressApiUi (codegen bundle)', () => {
  let doc: ApiDocument;
  let app: ReturnType<typeof express>;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: { transport: 'http', name: 'TestApi', controllers: [] },
    });
    app = express();
    app.use('/reference', expressApiUi(doc));
  });

  // esbuild bundling takes real, noticeable time — high enough for a
  // single test run to occasionally need more than mocha's own default.
  it('Should serve the codegen bundle entry file', async function () {
    this.timeout(30_000);
    const res = await supertest(app).get('/reference/codegen/browser-entry.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/javascript');
    expect(res.text).toContain('generateTypeScriptClientZip');
  });

  it('Should respond 404 for an unknown codegen file', async () => {
    const res = await supertest(app).get('/reference/codegen/nope.js');
    expect(res.status).toBe(404);
  });

  it('Should actually generate a working TypeScript client zip from the served bundle', async function () {
    this.timeout(30_000);
    const { buildClientCodegenBundle } =
      await import('../src/client-codegen-bundle.js');
    const files = await buildClientCodegenBundle();
    const entry = files.get('browser-entry.js');
    expect(entry).toBeDefined();

    // The bundle is code-split into several files importing each other by
    // relative name — write every one of them into the same temp
    // directory so those relative imports resolve. Executed via a
    // genuinely separate `node` process (not a dynamic `import()` from
    // right here) — this test file itself runs under mocha's own
    // CJS/ESM-interop test loader, which doesn't reliably support
    // synchronously importing a *multi-chunk* ESM graph like this one;
    // a real browser loading this bundle wouldn't have that problem
    // either, so a plain child process is both the fix and the more
    // realistic way to exercise it.
    const { execFileSync } = await import('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-codegen-test-'));
    try {
      for (const [filename, file] of files) {
        fs.writeFileSync(path.join(dir, filename), file.contents);
      }
      fs.writeFileSync(
        path.join(dir, 'schema.json'),
        JSON.stringify(doc.export()),
      );
      fs.writeFileSync(
        path.join(dir, 'verify.mjs'),
        `
import fs from 'node:fs';
import { generateTypeScriptClientZip } from './browser-entry.js';
const schema = JSON.parse(fs.readFileSync('./schema.json', 'utf-8'));
const zipBytes = await generateTypeScriptClientZip(schema);
fs.writeFileSync('./output.zip', Buffer.from(zipBytes));
`,
      );
      execFileSync(process.execPath, ['verify.mjs'], {
        cwd: dir,
        stdio: 'pipe',
      });

      const zipBytes = fs.readFileSync(path.join(dir, 'output.zip'));
      expect(zipBytes.length).toBeGreaterThan(0);
      // Zip local file header signature ("PK\x03\x04") — confirms fflate
      // actually produced a real zip, not just arbitrary bytes.
      expect(Array.from(zipBytes.subarray(0, 4))).toEqual([
        0x50, 0x4b, 0x03, 0x04,
      ]);

      const { unzipSync, strFromU8 } = await import('fflate');
      const unzipped = unzipSync(new Uint8Array(zipBytes));
      expect(unzipped['index.ts']).toBeDefined();
      const typesFile = Object.keys(unzipped).find(f =>
        f.endsWith('Customer.ts'),
      );
      expect(typesFile).toBeDefined();
      expect(strFromU8(unzipped[typesFile!])).toContain('Customer');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('api-ui:expressApiUi studio', () => {
  let dir: string;
  let doc: ApiDocument;
  let app: express.Express;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-studio-express-'));
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      translationStore: new TranslationFileStore(dir),
    });
    app = express();
    app.use('/reference', expressApiUi(doc, { studio: true }));
  });

  afterEach(() => fs.rmSync(dir, { force: true, recursive: true }));

  it('Should refuse to publish a studio for a document it cannot write', async () => {
    const plain = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Unstored' },
      types: [Customer],
    });
    // At mount time, not at the first click: an application that asked for a
    // studio and cannot have one should hear about it while it is starting.
    expect(() => expressApiUi(plain, { studio: true })).toThrow(
      /no translation store/,
    );
  });

  it('Should leave the reader page exactly as it was', async () => {
    const res = await supertest(app).get('/reference');
    expect(res.status).toBe(200);
    // Nothing of the studio ships to a reader - not its code, not its
    // stylesheet, not the authoring stamps on the schema.
    expect(res.text).not.toContain('The authoring layer');
    expect(res.text).not.toContain('CodeMirror');
    // The embedded payload only - `app.js` is inlined into this page too,
    // and its own source names every one of these.
    const from = res.text.indexOf('window.__OPRA_DOCS__');
    const payload = res.text.slice(from, res.text.indexOf('</script>', from));
    expect(payload).not.toContain('_docKey');
    expect(payload).not.toContain('_docOwner');
    // Only the one fact the header's button needs.
    expect(res.text).toContain('"studioParam":"edit"');
  });

  it('Should serve the studio when the request asks for it', async () => {
    const res = await supertest(app).get('/reference?edit=1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('The authoring layer');
    expect(res.text).toContain('__OPRA_STUDIO_BUNDLE__');
    // Never cached: the point of the tool is seeing an edit immediately.
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('Should write an edit through the document own store', async () => {
    const saved = await supertest(app)
      // Relative to where the handler is mounted, like every other route it
      // serves.
      .post('/reference/_studio/save')
      .send({
        owner: doc.id,
        key: ['types', 'Customer'],
        field: 'description',
        value: 'A customer (edited)',
        lang: 'en',
      });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ ok: true });
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).types
        .Customer.description,
    ).toStrictEqual('A customer (edited)');
  });

  it('Should save through a body the application already parsed', async () => {
    /* `express.json()` is the first line of most applications, and NestJS
     * installs one by default. A parser leaves the stream consumed, so
     * waiting for `'data'` on it yields no chunks and no `'end'` - the
     * request never gets an answer and the save hangs until it times out. */
    const parsed = express();
    parsed.use(express.json());
    parsed.use('/reference', expressApiUi(doc, { studio: true }));
    const saved = await supertest(parsed)
      .post('/reference/_studio/save')
      .send({
        owner: doc.id,
        key: ['types', 'Customer'],
        field: 'description',
        value: 'A customer (parsed body)',
        lang: 'en',
      });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ ok: true });
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).types
        .Customer.description,
    ).toStrictEqual('A customer (parsed body)');
  });

  it('Should serve neither the studio nor its routes when it is off', async () => {
    const plain = express();
    plain.use('/reference', expressApiUi(doc));
    // `?edit=1` is an unknown query parameter and nothing more.
    const page = await supertest(plain).get('/reference?edit=1');
    expect(page.text).not.toContain('The authoring layer');
    expect(page.text).not.toContain('"studioParam":"edit"');
    /* The handler answers any unmatched path with the page itself - its
     * navigation is entirely `location.hash`-based - so what matters here is
     * not the status but that the request is a page view and writes nothing. */
    const save = await supertest(plain)
      .post('/reference/_studio/save')
      .send({
        owner: doc.id,
        key: ['types', 'Customer'],
        field: 'description',
        value: 'A customer (edited)',
        lang: 'en',
      });
    expect(save.body.ok).toBeUndefined();
    expect(fs.existsSync(path.join(dir, 'en.json'))).toBe(false);
  });
});
