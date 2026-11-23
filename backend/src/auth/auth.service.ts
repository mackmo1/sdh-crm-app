import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { CrmUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module.js';
import { config } from '../config.js';
import { EmailService } from './email.service.js';
import { hashPassword, TIMING_EQUALISATION_HASH, verifyPassword } from './password.js';
import { createSessionToken, hashToken } from './tokens.js';
import type { AuthenticatedUser } from './auth.types.js';

const MAX_FAILED_LOGIN_MESSAGE = 'Invalid email or password';

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export interface PasswordResetRequestResult {
  delivered: boolean;
  transport: 'console' | 'smtp';
}

function toAuthenticatedUser(user: CrmUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    module: user.module,
    role: user.role,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async login(emailInput: string, password: string): Promise<LoginResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.crmUser.findUnique({
      where: { email },
      include: { credential: true },
    });

    if (!user || !user.active || !user.credential) {
      // Keep the response time comparable to a real verification attempt so the
      // endpoint does not reveal whether an account exists.
      await verifyPassword(TIMING_EQUALISATION_HASH, password);
      throw new UnauthorizedException(MAX_FAILED_LOGIN_MESSAGE);
    }

    const passwordMatches = await verifyPassword(user.credential.password_hash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException(MAX_FAILED_LOGIN_MESSAGE);
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);

    await this.prisma.crmSession.create({
      data: {
        crm_user_id: user.id,
        token_hash: hashToken(token),
        expires_at: expiresAt,
        last_used_at: new Date(),
      },
    });

    return { token, expiresAt, user: toAuthenticatedUser(user) };
  }

  async resolveSession(token: string): Promise<AuthenticatedUser | null> {
    const session = await this.prisma.crmSession.findUnique({
      where: { token_hash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.revoked_at !== null) return null;
    if (session.expires_at.getTime() <= Date.now()) return null;
    if (!session.user.active) return null;

    // Refresh the last-used marker at most hourly to avoid a write per request.
    const staleAfter = 60 * 60 * 1000;
    if (!session.last_used_at || Date.now() - session.last_used_at.getTime() > staleAfter) {
      await this.prisma.crmSession.update({
        where: { id: session.id },
        data: { last_used_at: new Date() },
      });
    }

    return toAuthenticatedUser(session.user);
  }

  async logout(token: string): Promise<void> {
    await this.prisma.crmSession.updateMany({
      where: { token_hash: hashToken(token), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  /**
   * Always resolves successfully so the endpoint cannot be used to enumerate
   * accounts. An email is only produced when an active account matches.
   */
  async requestPasswordReset(emailInput: string): Promise<PasswordResetRequestResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.crmUser.findUnique({ where: { email } });

    if (!user || !user.active) {
      return { delivered: false, transport: this.email.transport };
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + config.passwordResetTtlMinutes * 60 * 1000);

    await this.prisma.crmPasswordResetToken.create({
      data: {
        crm_user_id: user.id,
        token_hash: hashToken(token),
        expires_at: expiresAt,
      },
    });

    const resetUrl = `${config.passwordResetUrlBase}?token=${encodeURIComponent(token)}`;

    const result = await this.email.send({
      to: user.email,
      subject: 'Reset your Step360D CRM password',
      text: [
        `Hello ${user.name},`,
        '',
        'A password reset was requested for your Step360D CRM account.',
        `Open this link to choose a new password (valid for ${config.passwordResetTtlMinutes} minutes):`,
        resetUrl,
        '',
        'If you did not request this, you can ignore this message.',
      ].join('\n'),
    });

    return { delivered: result.delivered, transport: result.transport };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.crmPasswordResetToken.findUnique({
      where: { token_hash: hashToken(token) },
      include: { user: true },
    });

    if (!record || record.used_at !== null || record.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('This password reset link is invalid or has expired');
    }
    if (!record.user.active) {
      throw new NotFoundException('Account is not active');
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.crmPasswordResetToken.update({
        where: { id: record.id },
        data: { used_at: now },
      }),
      this.prisma.crmUserCredential.upsert({
        where: { crm_user_id: record.crm_user_id },
        create: {
          crm_user_id: record.crm_user_id,
          password_hash: passwordHash,
          password_updated_at: now,
        },
        update: { password_hash: passwordHash, password_updated_at: now },
      }),
      // Any outstanding session for this account is no longer trustworthy.
      this.prisma.crmSession.updateMany({
        where: { crm_user_id: record.crm_user_id, revoked_at: null },
        data: { revoked_at: now },
      }),
    ]);
  }
}
