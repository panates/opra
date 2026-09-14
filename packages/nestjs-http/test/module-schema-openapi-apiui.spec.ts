import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
