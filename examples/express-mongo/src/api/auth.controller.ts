import { HttpController, HttpOperation, OperationResult } from '@opra/common';
import { Db } from 'mongodb';
import { MyProfileController } from './my-profile.controller.js';

@HttpController({
  controllers: [(parent: AuthController) => new MyProfileController(parent.db)],
  path: 'auth',
})
export class AuthController {
  constructor(readonly db: Db) {}

  @(HttpOperation({
    sections: ['Account'],
    path: 'login',
  })
    .QueryParam('user', {
      type: String,
    })
    .QueryParam('password', {
      type: 'string',
    })
    .Response(200, { type: OperationResult }))
  login() {
    return new OperationResult({
      message: 'You are logged in',
    });
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
