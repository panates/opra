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
import Fastify, { type FastifyInstance } from 'fastify';
import { fastifyApiUi } from '../src/fastify/fastify-api-ui.js';

@ComplexType({ description: 'A customer' })
class Customer {
  @ApiField({ required: true })
  declare id: string;
}

describe('api-ui:fastifyApiUi', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Customer],
      api: { transport: 'http', name: 'TestApi', controllers: [] },
    });
  });

  async function serve(
    document: ApiDocument,
    options?: Parameters<typeof fastifyApiUi>[1],
    prefix = '/reference',
  ): Promise<FastifyInstance> {
    const app = Fastify();
    await app.register(fastifyApiUi(document, options), { prefix });
    await app.ready();
    return app;
  }

  it('Should serve the rendered page at the mount root', async () => {
    const app = await serve(doc);
    const r = await app.inject({ method: 'GET', url: '/reference' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.body).toContain('window.__OPRA_DOCS__');
    await app.close();
  });

  it("Should serve the page's own sub-routes relative to the mount", async () => {
    const app = await serve(doc);
    const r = await app.inject({
      method: 'GET',
      url: '/reference/schema/root.json',
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('application/json');
    expect(JSON.parse(r.body).info).toBeDefined();
    await app.close();
  });

  it('Should build its links from the mount prefix, which Fastify does not strip', async () => {
    // The whole difference from Express: the handler is given the full path
    // and has to be told where it is mounted.
    const app = await serve(doc, undefined, '/deeply/nested/ui');
    const r = await app.inject({ method: 'GET', url: '/deeply/nested/ui' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('"basePath":"/deeply/nested/ui"');
    await app.close();
  });

  it('Should redirect the mount root to a scope when there are several', async () => {
    const app = await serve(doc, { scopes: ['api', 'db'], scope: 'api' });
    const r = await app.inject({ method: 'GET', url: '/reference' });
    expect(r.statusCode).toBe(301);
    expect(r.headers.location).toStrictEqual('/reference/api');
    const scoped = await app.inject({ method: 'GET', url: '/reference/db' });
    expect(scoped.statusCode).toBe(200);
    const unknown = await app.inject({ method: 'GET', url: '/reference/zz' });
    expect(unknown.statusCode).toBe(404);
    await app.close();
  });

  describe('studio', () => {
    let dir: string;
    let stored: ApiDocument;

    beforeEach(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-fastify-studio-'));
      stored = await ApiDocumentFactory.createDocument({
        spec: OpraSchema.SpecVersion,
        info: { title: 'TestApi', version: 'v1' },
        types: [Customer],
        translationStore: new TranslationFileStore(dir),
      });
    });
    afterEach(() => fs.rmSync(dir, { force: true, recursive: true }));

    it('Should serve the studio when the request asks for it', async () => {
      const app = await serve(stored, { studio: true });
      const reader = await app.inject({ method: 'GET', url: '/reference' });
      expect(reader.body).not.toContain('The authoring layer');
      expect(reader.body).toContain('"studioParam":"edit"');
      const studio = await app.inject({
        method: 'GET',
        url: '/reference?edit=1',
      });
      expect(studio.statusCode).toBe(200);
      expect(studio.body).toContain('The authoring layer');
      expect(studio.headers['cache-control']).toContain('no-store');
      await app.close();
    });

    it("Should write an edit through the document's own store", async () => {
      // Fastify parses the body before any handler runs, so the raw stream is
      // already consumed by the time the studio sees it.
      const app = await serve(stored, { studio: true });
      const saved = await app.inject({
        method: 'POST',
        url: '/reference/_studio/save',
        payload: {
          owner: stored.id,
          key: ['types', 'Customer'],
          field: 'description',
          value: 'A customer (from Fastify)',
          lang: 'en',
        },
      });
      expect(saved.statusCode).toBe(200);
      expect(JSON.parse(saved.body)).toEqual({ ok: true });
      expect(
        JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).types
          .Customer.description,
      ).toStrictEqual('A customer (from Fastify)');
      await app.close();
    });
  });
});
