import {
  HttpController,
  HttpOperation,
  OperationResult,
  UnauthorizedError,
} from '@opra/common';
import { HttpContext } from '@opra/http';
import { Db } from 'mongodb';
import { MyProfileController } from './my-profile.controller.js';

@HttpController({
  description: 'Auth controller',
  controllers: [MyProfileController],
  path: 'auth',
  // Said once for every operation here and in the controllers nested
  // above, rather than repeated on each one.
  sections: ['Account'],
})
export class AuthController {
  constructor(readonly db: Db) {}

  @(HttpOperation({
    path: 'login',
  })
    .QueryParam('user', String)
    .QueryParam('password', 'string')
    .Response(200, { type: OperationResult }))
  login(ctx: HttpContext) {
    if (ctx.queryParams.user) {
      return new OperationResult({
        message: `User "${ctx.queryParams.user}" is logged in`,
      });
    }
    throw new UnauthorizedError();
  }

  @(HttpOperation({
    path: '/logout',
  }).Response(200, { type: OperationResult }))
  logout() {
    return new OperationResult({
      message: 'You are logged out',
    });
  }
}
