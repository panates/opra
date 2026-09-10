import { HttpController, HttpOperation, OperationResult } from '@opra/common';
import { Db } from 'mongodb';
import { MyProfileController } from './my-profile.controller.js';

@HttpController({
  description: 'Authentication endpoints for signing in and out',
  controllers: [(parent: AuthController) => new MyProfileController(parent.db)],
  path: 'auth',
})
export class AuthController {
  constructor(readonly db: Db) {}

  @(HttpOperation({
    description: 'Signs the user in with a username and password',
    path: 'login',
  })
    .QueryParam('user', {
      type: String,
      description: 'Username to sign in with',
    })
    .QueryParam('password', {
      type: 'string',
      description: 'Password of the user',
    })
    .Response(200, { type: OperationResult }))
  login() {
    return new OperationResult({
      message: 'You are logged in',
    });
  }

  @(HttpOperation({
    description: 'Signs the current user out',
    path: '/logout',
  }).Response(200, { type: OperationResult }))
  logout() {
    return new OperationResult({
      message: 'You are logged out',
    });
  }
}
