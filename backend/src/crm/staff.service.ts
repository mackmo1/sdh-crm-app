import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { hashPassword } from '../auth/password.js';
import { buildMeta, pageSchema } from './crm.helpers.js';

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  email: z.string().trim().email('Enter a valid email address').max(200),
  role: z.enum(['admin', 'data_user']),
  module: z.enum(['all', 'lead', 'property']),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email('Enter a valid email address').max(200).optional(),
  role: z.enum(['admin', 'data_user']).optional(),
  module: z.enum(['all', 'lead', 'property']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200).optional(),
});

export const staffListQuerySchema = z.object({
  ...pageSchema,
  search: z.string().trim().max(200).optional(),
  role: z.enum(['admin', 'data_user']).optional(),
  module: z.enum(['all', 'lead', 'property']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: z.infer<typeof staffListQuerySchema>) {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.module ? { module: query.module } : {}),
      ...(query.active ? { active: query.active === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.crmUser.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { sessions: true } } },
      }),
      this.prisma.crmUser.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        module: row.module,
        active: row.active,
        createdAt: row.created_at.toISOString(),
        openSessions: row._count.sessions,
      })),
      meta: buildMeta(query.page, query.pageSize, total),
    };
  }

  async options() {
    const users = await this.prisma.crmUser.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true, module: true },
    });
    return users;
  }

  async create(input: z.infer<typeof staffCreateSchema>) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.crmUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email address already exists');

    const passwordHash = await hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.crmUser.create({
        data: {
          name: input.name,
          email,
          role: input.role,
          module: input.module,
          active: true,
        },
      });
      await tx.crmUserCredential.create({
        data: { crm_user_id: created.id, password_hash: passwordHash },
      });
      return created;
    });

    return this.toDto(user);
  }

  async update(
    id: string,
    input: z.infer<typeof staffUpdateSchema>,
    actorId: string,
  ) {
    const existing = await this.prisma.crmUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Staff member not found');

    if (id === actorId && input.active === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    if (id === actorId && input.role && input.role !== 'admin') {
      throw new ForbiddenException('You cannot remove your own administrator role');
    }

    let email = existing.email;
    if (input.email) {
      email = input.email.trim().toLowerCase();
      const clash = await this.prisma.crmUser.findUnique({ where: { email } });
      if (clash && clash.id !== id) {
        throw new ConflictException('An account with this email address already exists');
      }
    }

    const passwordHash = input.password ? await hashPassword(input.password) : null;

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.crmUser.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          email,
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.module !== undefined ? { module: input.module } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });

      if (passwordHash) {
        await tx.crmUserCredential.upsert({
          where: { crm_user_id: id },
          create: { crm_user_id: id, password_hash: passwordHash },
          update: { password_hash: passwordHash, password_updated_at: new Date() },
        });
      }

      // A deactivated account or a changed password invalidates open sessions.
      if (input.active === false || passwordHash) {
        await tx.crmSession.updateMany({
          where: { crm_user_id: id, revoked_at: null },
          data: { revoked_at: new Date() },
        });
      }

      return updated;
    });

    return this.toDto(user);
  }

  private toDto(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    module: string;
    active: boolean;
    created_at: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      module: user.module,
      active: user.active,
      createdAt: user.created_at.toISOString(),
    };
  }
}
