import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  static instanceCounter = 0;
  static callCounter = 0;

  static user = {
    id: 1,
    name: 'Test User',
  };

  constructor() {
    AuthGuard.instanceCounter++;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    AuthGuard.callCounter++;
    const req = context.switchToHttp().getRequest();
    // `req.get()` is Express's; Fastify hands a request that has only the
    // headers. Reading both is what lets this fixture serve either platform.
    const auth =
      typeof req.get === 'function'
        ? req.get('Authorization')
        : req.headers?.authorization;
    if (auth === 'reject-auth') throw new UnauthorizedException();
    req.user = AuthGuard.user;
    return true;
  }
}
