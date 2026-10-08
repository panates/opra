import { HttpController, HttpOperation, OperationResult } from '@opra/common';
import type { CustomerApplication } from '../customer-application.js';
import { MyProfileController } from './my-profile.controller.js';

@HttpController({
  controllers: [
    (parent: AuthController) => new MyProfileController(parent.app),
  ],
  path: 'auth',
  // Said once for every operation here and in the controller nested
  // above, rather than repeated on each one.
  sections: ['Account'],
})
export class AuthController {
  constructor(readonly app: CustomerApplication) {}

  @(HttpOperation({
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
    path: '/logout',
  }).Response(200, { type: OperationResult }))
  logout() {
    return new OperationResult({
      message: 'You are logged out',
    });
  }
}
