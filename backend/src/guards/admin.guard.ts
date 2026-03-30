import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // Allow admins explicitly; deny otherwise.
    return Boolean(user && (user.isAdmin === true || user.role === 'admin'));
  }
}
