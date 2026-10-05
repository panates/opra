import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { TranslationFileStore } from '@opra/common';
import { expect } from 'expect';
import request from 'supertest';
import { OpraHttpModule } from '../src/index.js';
import {
  Cat,
  CatsService,
  HttpCatsController,
} from './_support/test-app/index.js';

/**
 * The same page, served by the other router.
 *
 * What the Fastify platform actually changes is small and entirely about
 * plumbing — the wildcard's spelling, who strips the mount prefix, who
 * intends to send the reply, who already parsed the body — so these assert
 * the plumbing rather than the page, which `api-ui`'s own suites cover.
 */
/* Listening on a real port rather than `app.inject()`: OPRA's own middleware
 * builds its context from a `http.IncomingMessage` and checks for one with
 * `instanceof`, and `inject` hands a look-alike that light-my-request builds
 * itself. The Express suites go through a real server for the same reason. */
function createApp(
  options: Partial<OpraHttpModule.ModuleOptions>,
): Promise<NestFastifyApplication> {
  return Test.createTestingModule({
    imports: [
      OpraHttpModule.forRoot({
        name: 'test',
        controllers: [HttpCatsController],
        providers: [CatsService],
        types: [Cat],
        basePath: 'v1',
        platform: 'fastify',
        ...options,
      }),
    ],
  })
    .compile()
    .then(async module => {
      const app = module.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
      );
      await app.listen({ port: 0, host: '127.0.0.1' });
      return app;
    });
}

describe('nestjs-http:OpraHttpModule (fastify platform)', () => {
  describe('apiUi', () => {
    let app: NestFastifyApplication;

    before(async () => {
      app = await createApp({ apiUi: true });
    });
    after(() => app.close());

    it('Should mount the page at the default path', async () => {
      const r = await request(await app.getUrl()).get('/v1/$docs');
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('text/html');
      expect(r.text).toContain('window.__OPRA_DOCS__');
    });

    it("Should serve the page's own sub-routes relative to the mount", async () => {
      // Fastify registers `/$docs/*`; Express 5 refuses that spelling and
      // registers `/$docs/*splat`. The adapter is told which to write.
      const r = await request(await app.getUrl()).get(
        '/v1/$docs/schema/root.json',
      );
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('application/json');
      expect(r.body.info).toBeDefined();
    });

    it('Should build its links from the mount path', async () => {
      const r = await request(await app.getUrl()).get('/v1/$docs');
      expect(r.text).toContain('"basePath":"/v1/$docs"');
    });
  });

  describe('apiUi at a custom path, under a global prefix', () => {
    let app: NestFastifyApplication;

    before(async () => {
      const module = await Test.createTestingModule({
        imports: [
          OpraHttpModule.forRoot({
            name: 'test',
            controllers: [HttpCatsController],
            providers: [CatsService],
            types: [Cat],
            basePath: 'v1',
            platform: 'fastify',
            apiUi: { path: 'ui' },
          }),
        ],
      }).compile();
      app = module.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
      );
      app.setGlobalPrefix('api');
      await app.listen({ port: 0, host: '127.0.0.1' });
    });
    after(() => app.close());

    it('Should mount under the prefix and resolve its sub-routes', async () => {
      const page = await request(await app.getUrl()).get('/api/v1/ui');
      expect(page.status).toStrictEqual(200);
      expect(page.headers['content-type']).toContain('text/html');
      const schema = await request(await app.getUrl()).get(
        '/api/v1/ui/schema/root.json',
      );
      expect(schema.status).toStrictEqual(200);
      expect(schema.body.info).toBeDefined();
    });
  });

  describe('$openapi', () => {
    let app: NestFastifyApplication;

    before(async () => {
      app = await createApp({ openapi: true });
    });
    after(() => app.close());

    it('Should publish $openapi when enabled', async () => {
      const r = await request(await app.getUrl()).get('/v1/$openapi');
      expect(r.status).toStrictEqual(200);
      expect(r.body.openapi).toStrictEqual('3.0.3');
    });
  });

  describe('enableStudio', () => {
    let app: NestFastifyApplication;
    let dir: string;

    before(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-fastify-nest-'));
      app = await createApp({
        apiUi: true,
        enableStudio: true,
        translationStore: new TranslationFileStore(dir),
      });
    });
    after(async () => {
      await app.close();
      fs.rmSync(dir, { force: true, recursive: true });
    });

    it('Should serve the studio when the request asks for it', async () => {
      const reader = await request(await app.getUrl()).get('/v1/$docs');
      expect(reader.text).not.toContain('The authoring layer');
      expect(reader.text).toContain('"studioParam":"edit"');
      const studio = await request(await app.getUrl()).get('/v1/$docs?edit=1');
      expect(studio.status).toStrictEqual(200);
      expect(studio.text).toContain('The authoring layer');
      expect(studio.headers['cache-control']).toContain('no-store');
    });

    it("Should write an edit through the document's own store", async () => {
      // Fastify parses the body before any handler runs, so the raw stream
      // the studio would otherwise read is already consumed.
      const page = await request(await app.getUrl()).get('/v1/$docs?edit=1');
      const owner = /"id":"([0-9a-f]+)"/.exec(page.text)?.[1];
      expect(owner).toBeDefined();
      const saved = await request(await app.getUrl())
        .post('/v1/$docs/_studio/save')
        .send({
          owner,
          key: ['types', 'Cat'],
          field: 'description',
          value: 'A cat (from NestJS on Fastify)',
          lang: 'en',
        });
      expect(saved.status).toStrictEqual(200);
      expect(saved.body).toEqual({ ok: true });
      expect(
        JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).types
          .Cat.description,
      ).toStrictEqual('A cat (from NestJS on Fastify)');
    });
  });

  describe('the API itself', () => {
    let app: INestApplication;

    before(async () => {
      app = await createApp({});
    });
    after(() => app.close());

    it('Should still answer $schema and a controller operation', async () => {
      const schema = await request(await app.getUrl()).get('/v1/$schema');
      expect(schema.status).toStrictEqual(200);
      const op = await request(await app.getUrl()).get('/v1/cats');
      expect(op.status).toStrictEqual(200);
    });
  });
});
