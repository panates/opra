import { HttpController, HttpOperation, OperationResult } from '@opra/common';
import { Db } from 'mongodb';
import { MyProfileController } from './my-profile.controller.js';

@HttpController({
  description: `Authentication endpoints for signing in and out.

This is a deliberately minimal example — see **MyProfile** below for the endpoints that read the \`accessToken\` header directly instead of relying on a session.

- \`login\` — accepts a \`user\`/\`password\` pair
- \`logout\` — ends the current session`,
  controllers: [(parent: AuthController) => new MyProfileController(parent.db)],
  path: 'auth',
})
export class AuthController {
  constructor(readonly db: Db) {}

  @(HttpOperation({
    description: `Signs the user in with a username and password.

- \`user\` — the account's username
- \`password\` — the account's password

:::note
This sample endpoint returns a plain acknowledgement message rather than a real access token — see **MyProfile** for how an authenticated request is represented elsewhere in this API.
:::`,
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
    description: `Signs the current user out.

Returns a plain acknowledgement message, matching \`login\`.`,
    path: '/logout',
  }).Response(200, { type: OperationResult }))
  logout() {
    return new OperationResult({
      message: 'You are logged out',
    });
  }
}
