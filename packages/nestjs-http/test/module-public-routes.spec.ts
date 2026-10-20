import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { expect } from 'expect';
import { Server } from 'http';
import request from 'supertest';
import { IS_PUBLIC_KEY, OpraHttpModule } from '../src/index.js';
import {
  Cat,
  CatsService,
  HttpCatsController,
} from './_support/test-app/index.js';

/*
 * `schemaIsPublic` and what it covers.
 *
 * It used to mark only `$schema`. `$openapi` and the reference page at
 * `$docs` got nothing, so an application with a guard that honours
 * `IS_PUBLIC_KEY` answered 200 on `$schema` and 401 on the other two —
 * three views of the same document behaving differently.
 */

/** Rejects anything not marked `@Public()`. */
@Injectable()
class RejectNonPublicGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) throw new UnauthorizedException();
    return true;
  }
}

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
        openapi: true,
        apiUi: true,
        ...options,
      }),
    ],
    providers: [{ provide: APP_GUARD, useClass: RejectNonPublicGuard }],
  })
    .compile()
    .then(module => {
      const nestApplication = module.createNestApplication();
      const server = nestApplication.getHttpServer();
      return nestApplication.init().then(() => ({ nestApplication, server }));
    });
}

describe('nestjs-http:OpraHttpModule - schemaIsPublic', () => {
  describe('with a basePath', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({
        basePath: 'v1',
        schemaIsPublic: true,
      }));
    });
    after(() => nestApplication.close());

    it('Should let an anonymous request read $schema', async () => {
      const r = await request(server).get('/v1/$schema');
      expect(r.status).toStrictEqual(200);
    });

    it('Should let an anonymous request read $openapi', async () => {
      const r = await request(server).get('/v1/$openapi');
      expect(r.status).toStrictEqual(200);
      expect(r.body.openapi).toStrictEqual('3.0.3');
    });

    it('Should let an anonymous request read the $docs page', async () => {
      const r = await request(server).get('/v1/$docs');
      expect(r.status).toStrictEqual(200);
      expect(r.headers['content-type']).toContain('text/html');
    });

    it("Should let an anonymous request read the page's own assets", async () => {
      const r = await request(server).get('/v1/$docs/schema/root.json');
      expect(r.status).toStrictEqual(200);
      expect(r.body.info).toBeDefined();
    });

    it('Should keep the operations themselves behind the guard', async () => {
      const r = await request(server).get('/v1/Cats');
      expect(r.status).toStrictEqual(401);
    });
  });

  describe('without a basePath', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({
        schemaIsPublic: true,
      }));
    });
    after(() => nestApplication.close());

    it('Should let an anonymous request read all three', async () => {
      expect((await request(server).get('/$schema')).status).toStrictEqual(200);
      expect((await request(server).get('/$openapi')).status).toStrictEqual(
        200,
      );
      expect((await request(server).get('/$docs')).status).toStrictEqual(200);
      expect(
        (await request(server).get('/$docs/schema/root.json')).status,
      ).toStrictEqual(200);
    });
  });

  describe('when it is off', () => {
    let nestApplication: INestApplication;
    let server: Server;

    before(async () => {
      ({ nestApplication, server } = await createApp({ basePath: 'v1' }));
    });
    after(() => nestApplication.close());

    it('Should leave all three behind the guard', async () => {
      expect((await request(server).get('/v1/$schema')).status).toStrictEqual(
        401,
      );
      expect((await request(server).get('/v1/$openapi')).status).toStrictEqual(
        401,
      );
      expect((await request(server).get('/v1/$docs')).status).toStrictEqual(
        401,
      );
    });
  });
});
