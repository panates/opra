import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TranslationFileStore } from '@opra/common';
import { expect } from 'expect';
import { Server } from 'http';
import request from 'supertest';
import { OpraHttpModule } from '../src/index.js';
import {
  Cat,
  CatsService,
  HttpCatsController,
} from './_support/test-app/index.js';

function createApp(
  options: Partial<OpraHttpModule.ModuleOptions>,
): Promise<{ nestApplication: INestApplication; server: Server }> {
  return Test.createTestingModule({
    imports: [
      OpraHttpModule.forRoot({
        name: 'test',
        controllers: [HttpCatsController],
        providers: [CatsService],
        types: [Cat],
        basePath: 'v1',
        ...options,
      }),
    ],
  })
    .compile()
    .then(module => {
      const nestApplication = module.createNestApplication();
      const server = nestApplication.getHttpServer();
      return nestApplication.init().then(() => ({ nestApplication, server }));
    });
}

describe('nestjs-http:OpraHttpModule ($schema/$openapi/apiUi options)', () => {
  describe('schema: false', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({ schema: false }));
    });
    after(() => nestApplication.close());

    it('Should not publish $schema', async () => {
      const r = await request(server).get('/v1/$schema');
      expect(r.status).toStrictEqual(404);
    });
  });

  describe('openapi option', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({ openapi: true }));
    });
    after(() => nestApplication.close());

    it('Should publish $openapi when enabled', async () => {
      const r = await request(server).get('/v1/$openapi');
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('application/json');
      expect(r.body.openapi).toStrictEqual('3.0.3');
      expect(r.body.paths).toBeInstanceOf(Object);
    });
  });

  describe('apiUi option', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({ apiUi: true }));
    });
    after(() => nestApplication.close());

    it('Should mount the api-ui page at the default path ($docs)', async () => {
      const r = await request(server).get('/v1/$docs');
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('text/html');
      expect(r.text).toContain('window.__OPRA_DOCS__');
    });

    it("Should serve the api-ui's own sub-routes relative to the mount path", async () => {
      const r = await request(server).get('/v1/$docs/schema/root.json');
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('application/json');
      expect(r.body.info).toBeDefined();
    });
  });

  describe('apiUi option with a custom path and a global prefix', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      const module = await Test.createTestingModule({
        imports: [
          OpraHttpModule.forRoot({
            name: 'test',
            controllers: [HttpCatsController],
            providers: [CatsService],
            types: [Cat],
            basePath: 'v1',
            apiUi: { path: 'ui' },
          }),
        ],
      }).compile();
      nestApplication = module.createNestApplication();
      // `setGlobalPrefix` must run before `init()` — this is exactly why
      // this one scenario can't go through the shared `createApp()`
      // helper above (which already calls `init()` itself).
      nestApplication.setGlobalPrefix('api');
      server = nestApplication.getHttpServer();
      await nestApplication.init();
    });
    after(() => nestApplication.close());

    it('Should mount at the custom path, under the global prefix too', async () => {
      const r = await request(server).get('/api/v1/ui');
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('text/html');
    });

    it("Should still resolve the api-ui's own sub-routes when a global prefix is set", async () => {
      const r = await request(server).get('/api/v1/ui/schema/root.json');
      expect(r.status).toStrictEqual(200);
      expect(r.body.info).toBeDefined();
    });
  });

  describe('enableStudio', () => {
    let nestApplication: INestApplication;
    let server: Server;
    let dir: string;

    before(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-nest-studio-'));
      ({ nestApplication, server } = await createApp({
        apiUi: true,
        enableStudio: true,
        // The studio writes through the store the document reads from, so a
        // module that cannot declare one cannot have a studio at all.
        translationStore: new TranslationFileStore(dir),
      }));
    });
    after(async () => {
      await nestApplication.close();
      fs.rmSync(dir, { force: true, recursive: true });
    });

    it('Should leave the reader page as it was', async () => {
      const r = await request(server).get('/v1/$docs');
      expect(r.status).toStrictEqual(200);
      // Nothing of the studio reaches a reader - only the one fact the
      // header's button needs.
      expect(r.text).not.toContain('The authoring layer');
      expect(r.text).toContain('"studioParam":"edit"');
    });

    it('Should serve the studio when the request asks for it', async () => {
      const r = await request(server).get('/v1/$docs?edit=1');
      expect(r.status).toStrictEqual(200);
      expect(r.text).toContain('The authoring layer');
      expect(r.text).toContain('__OPRA_STUDIO_BUNDLE__');
      expect(r.headers['cache-control']).toContain('no-store');
    });

    it("Should write an edit through the document's own store", async () => {
      // `All('/$docs/*splat')` is what carries this - the studio's own
      // routes are POSTs under the mount path.
      const docs = await request(server).get('/v1/$docs?edit=1');
      const owner = /"id":"([0-9a-f]+)"/.exec(docs.text)?.[1];
      expect(owner).toBeDefined();
      const saved = await request(server)
        .post('/v1/$docs/_studio/save')
        .send({
          owner,
          key: ['types', 'Cat'],
          field: 'description',
          value: 'A cat (edited from NestJS)',
          lang: 'en',
        });
      expect(saved.status).toStrictEqual(200);
      expect(saved.body).toEqual({ ok: true });
      expect(
        JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).types
          .Cat.description,
      ).toStrictEqual('A cat (edited from NestJS)');
    });
  });

  describe('enableStudio without a writable store', () => {
    it('Should refuse at startup rather than at the first click', async () => {
      // There is nowhere for the edit to go, and that is a configuration
      // error the application should hear about while it is starting.
      await expect(
        createApp({ apiUi: true, enableStudio: true }).then(a =>
          request(a.server)
            .get('/v1/$docs?edit=1')
            .then(r => {
              void a.nestApplication.close();
              return r;
            }),
        ),
      ).resolves.toMatchObject({ status: 501 });
    });
  });

  describe('enableStudio without apiUi', () => {
    it('Should refuse, because the studio is that page', () => {
      // Thrown while the module is being *defined*, not when it starts -
      // `forRoot` builds the adapter - so this is as early as a mistake can
      // be caught.
      expect(() => createApp({ enableStudio: true })).toThrow(
        /requires `apiUi`/,
      );
    });
  });

  describe('disabled by default', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({}));
    });
    after(() => nestApplication.close());

    it('Should not publish $openapi', async () => {
      const r = await request(server).get('/v1/$openapi');
      expect(r.status).toStrictEqual(404);
    });

    it('Should not mount the api-ui page', async () => {
      const r = await request(server).get('/v1/$docs');
      expect(r.status).toStrictEqual(404);
    });
  });
});
