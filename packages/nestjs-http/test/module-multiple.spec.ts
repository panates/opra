import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  ForbiddenError,
  HttpController,
  HttpOperation,
  NotFoundError,
  UnauthorizedError,
} from '@opra/common';
import type { HttpContext } from '@opra/http';
import { expect } from 'expect';
import { Server } from 'http';
import request from 'supertest';
import {
  getOpraContext,
  OpraHttpModule,
  OpraHttpNestjsAdapter,
} from '../src/index.js';

/*
 * Two `OpraHttpModule`s in one application.
 *
 * Each module applies its middleware to every route and registers a
 * global exception filter, so before these the two modules overwrote each
 * other: a handler of one API was given the context the *other* module's
 * middleware built last, and an error was answered by a filter that could
 * not find its adapter — every error path came back 500 instead of the
 * status the error carried.
 */

@HttpController({ path: 'x', name: 'XController' })
class XController {
  @HttpOperation({ path: 'ok' })
  ok() {
    return { id: 1, name: 'from-a' };
  }

  @HttpOperation({ path: 'missing' })
  missing(): any {
    throw new NotFoundError({ message: 'no such x' });
  }

  @HttpOperation({ path: 'denied' })
  denied(): any {
    throw new ForbiddenError({ message: 'not yours' });
  }

  @HttpOperation({ path: 'whoami' })
  whoami(context: HttpContext) {
    return { user: (context as any).user ?? null };
  }
}

@HttpController({ path: 'y', name: 'YController' })
class YController {
  @HttpOperation({ path: 'ok' })
  ok() {
    return { id: 2, name: 'from-b' };
  }

  @HttpOperation({ path: 'missing' })
  missing(): any {
    throw new NotFoundError({ message: 'no such y' });
  }

  @HttpOperation({ path: 'whoami' })
  whoami(context: HttpContext) {
    return { user: (context as any).user ?? null };
  }
}

/** Rejects before any handler runs, the way a real auth guard does. */
@Injectable()
class RejectingGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth =
      typeof req.get === 'function'
        ? req.get('Authorization')
        : req.headers?.authorization;
    if (auth === 'reject-auth') throw new UnauthorizedError();
    return true;
  }
}

describe('nestjs-http:OpraModule - several modules', () => {
  describe('with distinct basePaths', () => {
    let app: INestApplication;
    let server: Server;

    before(async () => {
      const module = await Test.createTestingModule({
        imports: [
          OpraHttpModule.forRoot({
            name: 'ApiA',
            basePath: 'a',
            controllers: [XController],
            schemaIsPublic: true,
          }),
          OpraHttpModule.forRoot({
            /* A token of its own — the case that registered no provider
             * under the adapter class and made every module-internal
             * lookup resolve the *first* module's adapter. */
            token: 'API_B_ADAPTER',
            name: 'ApiB',
            basePath: 'b',
            controllers: [YController],
            schemaIsPublic: true,
          }),
        ],
        providers: [{ provide: APP_GUARD, useClass: RejectingGuard }],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      server = app.getHttpServer();
    });

    after(async () => app?.close());

    it('should give each module its own adapter', async () => {
      const a = app.get(OpraHttpNestjsAdapter);
      const b = app.get('API_B_ADAPTER');
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(a).not.toBe(b);
      expect(a.document.api!.name).toStrictEqual('ApiA');
      expect(b.document.api!.name).toStrictEqual('ApiB');
    });

    it("should answer both APIs' happy paths", async () => {
      const r1 = await request(server).get('/a/x/ok');
      expect(r1.status).toStrictEqual(200);
      expect(r1.body.name).toStrictEqual('from-a');
      const r2 = await request(server).get('/b/y/ok');
      expect(r2.status).toStrictEqual(200);
      expect(r2.body.name).toStrictEqual('from-b');
    });

    it("should keep each error's own status on both APIs", async () => {
      const r1 = await request(server).get('/a/x/missing');
      expect(r1.status).toStrictEqual(404);
      const r2 = await request(server).get('/b/y/missing');
      expect(r2.status).toStrictEqual(404);
      const r3 = await request(server).get('/a/x/denied');
      expect(r3.status).toStrictEqual(403);
    });

    it('should keep the status of an error thrown before the handler', async () => {
      const r1 = await request(server)
        .get('/a/x/ok')
        .set('Authorization', 'reject-auth');
      expect(r1.status).toStrictEqual(401);
      const r2 = await request(server)
        .get('/b/y/ok')
        .set('Authorization', 'reject-auth');
      expect(r2.status).toStrictEqual(401);
    });

    it("should publish each API's own $schema", async () => {
      const r1 = await request(server).get('/a/$schema');
      expect(r1.status).toStrictEqual(200);
      expect(r1.body.api.name).toStrictEqual('ApiA');
      expect(Object.keys(r1.body.api.controllers)).toEqual(['XController']);

      const r2 = await request(server).get('/b/$schema');
      expect(r2.status).toStrictEqual(200);
      expect(r2.body.api.name).toStrictEqual('ApiB');
      expect(Object.keys(r2.body.api.controllers)).toEqual(['YController']);
    });
  });

  describe('without basePaths', () => {
    let app: INestApplication;
    let server: Server;

    before(async () => {
      const module = await Test.createTestingModule({
        imports: [
          OpraHttpModule.forRoot({
            name: 'RootApiA',
            controllers: [XController],
            schemaIsPublic: true,
          }),
          OpraHttpModule.forRoot({
            token: 'ROOT_API_B_ADAPTER',
            name: 'RootApiB',
            controllers: [YController],
            /* Both modules mount at the root, so only one of them can own
             * `$schema`; the controllers' own paths keep them apart. */
            schema: false,
          }),
        ],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      server = app.getHttpServer();
    });

    after(async () => app?.close());

    it('should route each controller to its own API', async () => {
      const r1 = await request(server).get('/x/ok');
      expect(r1.status).toStrictEqual(200);
      expect(r1.body.name).toStrictEqual('from-a');
      const r2 = await request(server).get('/y/ok');
      expect(r2.status).toStrictEqual(200);
      expect(r2.body.name).toStrictEqual('from-b');
    });

    it("should keep each error's own status", async () => {
      const r1 = await request(server).get('/x/missing');
      expect(r1.status).toStrictEqual(404);
      const r2 = await request(server).get('/y/missing');
      expect(r2.status).toStrictEqual(404);
    });
  });

  describe('a guard writing to the request context', () => {
    /*
     * A guard runs before the handler, so nothing has yet settled which
     * of the request's contexts is the active one: `req.opraContext`
     * holds whichever module's middleware ran last. A guard reading it
     * directly would write to the other API's context on one of the two
     * modules, and that module's handler would see nothing.
     * `getOpraContext` asks the controller class instead.
     */
    @Injectable()
    class TaggingGuard implements CanActivate {
      canActivate(executionContext: ExecutionContext): boolean {
        const ctx = getOpraContext(executionContext);
        if (ctx) {
          (ctx as any).user = {
            api: (ctx.__adapter as any)?.document?.api?.name,
          };
        }
        return true;
      }
    }

    let app: INestApplication;
    let server: Server;

    before(async () => {
      const module = await Test.createTestingModule({
        imports: [
          OpraHttpModule.forRoot({
            name: 'GuardedApiA',
            basePath: 'a',
            controllers: [XController],
          }),
          OpraHttpModule.forRoot({
            token: 'GUARDED_B_ADAPTER',
            name: 'GuardedApiB',
            basePath: 'b',
            controllers: [YController],
            schema: false,
          }),
        ],
        providers: [{ provide: APP_GUARD, useClass: TaggingGuard }],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      server = app.getHttpServer();
    });

    after(async () => app?.close());

    it('should reach the handler of whichever module owns the route', async () => {
      /* Both, not just one: with a single shared slot exactly one of
       * these two passes, whichever middleware happens to run last. */
      const r1 = await request(server).get('/a/x/whoami');
      expect(r1.status).toStrictEqual(200);
      expect(r1.body.user).toEqual({ api: 'GuardedApiA' });

      const r2 = await request(server).get('/b/y/whoami');
      expect(r2.status).toStrictEqual(200);
      expect(r2.body.user).toEqual({ api: 'GuardedApiB' });
    });
  });
});
