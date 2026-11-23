import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { CrmModule, StaffRole } from '@prisma/client';
import { AppModule } from '../../src/app.module.js';
import { configureApp, registerBigIntSerialisation } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.module.js';
import { hashPassword } from '../../src/auth/password.js';
import { EmailService, type EmailMessage } from '../../src/auth/email.service.js';

export interface CapturedEmail extends EmailMessage {}

/** Test double for the mail transport that records outgoing messages. */
export class EmailCapture {
  readonly messages: CapturedEmail[] = [];

  get transport(): 'smtp' {
    return 'smtp';
  }

  isConfigured(): boolean {
    return true;
  }

  async send(message: EmailMessage): Promise<{ delivered: boolean; transport: 'smtp' }> {
    this.messages.push(message);
    return { delivered: true, transport: 'smtp' };
  }

  lastToken(): string {
    const last = this.messages.at(-1);
    if (!last) throw new Error('No email was captured');
    const match = /token=([A-Za-z0-9_-]+)/.exec(last.text);
    if (!match) throw new Error('No reset token found in the captured email');
    return match[1];
  }
}

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  email: EmailCapture;
}

export async function createTestApp(): Promise<TestContext> {
  registerBigIntSerialisation();

  const email = new EmailCapture();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(email)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService), email };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "property_archive", "sale_property", "rent_property", "property", ' +
      '"Crm_Session", "Crm_PasswordResetToken", "Crm_UserCredential", "Crm_User", "projects" ' +
      'RESTART IDENTITY CASCADE',
  );
}

export async function createStaffUser(
  prisma: PrismaService,
  options: {
    email: string;
    password: string;
    name?: string;
    role?: StaffRole;
    module?: CrmModule;
    active?: boolean;
  },
): Promise<{ id: string; email: string }> {
  const passwordHash = await hashPassword(options.password);

  const user = await prisma.crmUser.create({
    data: {
      name: options.name ?? 'Test User',
      email: options.email,
      role: options.role ?? 'admin',
      module: options.module ?? 'all',
      active: options.active ?? true,
      credential: { create: { password_hash: passwordHash } },
    },
  });

  return { id: user.id, email: user.email };
}

/** Returns a supertest agent that keeps the session cookie between requests. */
export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app.getHttpServer());
  const response = await agent.post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(
      `Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return agent;
}
