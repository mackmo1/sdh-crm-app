import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module.js';

/**
 * Records administrative changes that have no purpose-built history table.
 * Lead stages, assignments, interactions and property archiving deliberately
 * keep their own history tables and are not duplicated here.
 */
@Injectable()
export class ChangeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    entityType: string;
    entityId: string;
    action: string;
    summary: string;
    changes?: Record<string, unknown> | null;
    actorId?: string | null;
  }): Promise<void> {
    await this.prisma.changeHistory.create({
      data: {
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        action: entry.action,
        summary: entry.summary,
        changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
        actor_id: entry.actorId ?? null,
      },
    });
  }

  async list(entityType: string, entityId: string) {
    const rows = await this.prisma.changeHistory.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id.toString(),
      action: row.action,
      summary: row.summary,
      changes: row.changes,
      actorId: row.actor_id,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
