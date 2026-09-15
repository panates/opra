import { HttpController, HttpOperation, OperationResult } from '@opra/common';
import type { CustomerApplication } from '../customer-application.js';
import { MyProfileController } from './my-profile.controller.js';

@HttpController({
  controllers: [
    (parent: AuthController) => new MyProfileController(parent.app),
  ],
  path: 'auth',
})
export class AuthController {
  constructor(readonly app: CustomerApplication) {}

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
