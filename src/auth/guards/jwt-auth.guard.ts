import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AccountStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type JwtPayload = {
  sub: string;
  sid: string;
  email: string;
  role: AuthUser['role'];
};

type RequestWithUser = Request & { user?: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.campuscare_session;
    if (typeof token !== 'string') {
      throw new UnauthorizedException('Authentication is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        include: { user: true },
      });
      if (
        !session ||
        session.userId !== payload.sub ||
        session.expiresAt <= new Date() ||
        session.user.status !== AccountStatus.ACTIVE
      ) {
        throw new UnauthorizedException('Session is invalid or expired');
      }

      request.user = {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        sessionId: session.id,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Authentication is invalid or expired');
    }
  }
}
