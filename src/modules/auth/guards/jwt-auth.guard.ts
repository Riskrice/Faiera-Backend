import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        try {
            // Attempt to authenticate the user using the standard JWT strategy.
            // If successful, this will populate request.user.
            const canActivateResult = await super.canActivate(context);
            return canActivateResult as boolean;
        } catch (error: any) {
            // If the route is public, swallow the UnauthorizedException and allow access.
            if (isPublic) {
                const req = context.switchToHttp().getRequest();
                if (req.headers.authorization) {
                    console.log('--- JWT AUTH GUARD SWALLOWED ERROR ON PUBLIC ROUTE ---');
                    console.log('Error:', error.message);
                    console.log('Token:', req.headers.authorization.substring(0, 30) + '...');
                }
                return true;
            }
            // Otherwise, rethrow the error to block access.
            throw error;
        }
    }
}
