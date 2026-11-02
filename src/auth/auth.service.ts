import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Response } from 'express';
import { AccountStatus, UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { AuthUser } from './auth-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SESSION_COOKIE = 'campuscare_session';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, response: Response) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('An account already exists for this email');
    }

    const passwordHash = await hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
      },
    });

    const authUser = this.toAuthUser(user);
    await this.createSession(authUser, response);
    return this.toPublicUser(user);
  }

  async login(dto: LoginDto, response: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const passwordMatches = user
      ? await compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authUser = this.toAuthUser(user);
    await this.createSession(authUser, response);
    return this.toPublicUser(user);
  }

  async logout(user: AuthUser, response: Response): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: user.sessionId } });
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/api',
    });
  }

  async me(user: AuthUser) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    if (!account || account.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Session is invalid or expired');
    }
    return account;
  }

  private async createSession(user: AuthUser, response: Response): Promise<void> {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const session = await this.prisma.session.create({
      data: { userId: user.id, expiresAt },
    });
    const token = await this.jwtService.signAsync({
      sub: user.id,
      sid: session.id,
      email: user.email,
      role: user.role,
    });

    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      path: '/api',
      expires: expiresAt,
    });
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: UserRole;
  }): AuthUser {
    return { ...user, sessionId: '' };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: AccountStatus;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
