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
})
export class AuthController {
  constructor(readonly db: Db) {}

  @(HttpOperation({
    sections: ['Account'],
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
    sections: ['Account'],
    path: '/logout',
  }).Response(200, { type: OperationResult }))
  logout() {
    return new OperationResult({
      message: 'You are logged out',
    });
  }
}
