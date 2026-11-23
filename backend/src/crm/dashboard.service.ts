import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.module.js';
import { endOfDay, startOfDay } from './crm.helpers.js';

export const dashboardQuerySchema = z.object({
  from: z.string().trim().max(30).optional(),
  to: z.string().trim().max(30).optional(),
  city: z.string().trim().max(120).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

const ACTIVE_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'ON_HOLD'] as const;
const ALL_STAGES = [...ACTIVE_STAGES, 'WON', 'LOST'] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: DashboardQuery) {
    const now = new Date();
    const leadWhere = this.leadWhere(query);

    const [
      totalLeads,
      unassigned,
      byStage,
      won,
      lost,
      tasksDueToday,
      overdueFollowUps,
      upcomingVisits,
      propertiesPublished,
    ] = await Promise.all([
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.lead.count({ where: { ...leadWhere, assigned_to: null } }),
      this.prisma.lead.groupBy({ by: ['stage'], where: leadWhere, _count: { _all: true } }),
      this.prisma.lead.count({ where: { ...leadWhere, stage: 'WON' } }),
      this.prisma.lead.count({ where: { ...leadWhere, stage: 'LOST' } }),
      this.prisma.followUpTask.count({
        where: { status: 'OPEN', due_at: { gte: startOfDay(now), lte: endOfDay(now) } },
      }),
      this.prisma.followUpTask.count({
        where: { status: 'OPEN', due_at: { lt: startOfDay(now) } },
      }),
      this.prisma.siteVisit.count({
        where: { status: 'SCHEDULED', scheduled_at: { gte: now } },
      }),
      this.prisma.property.count({ where: { publication_status: 'PUBLISHED' } }),
    ]);

    const stageCounts = new Map(byStage.map((row) => [row.stage, row._count._all]));
    const activeLeads = ACTIVE_STAGES.reduce((sum, stage) => sum + (stageCounts.get(stage) ?? 0), 0);
    const newLeads = stageCounts.get('NEW') ?? 0;
    const closed = won + lost;

    return {
      totals: {
        totalLeads,
        activeLeads,
        newLeads,
        unassignedLeads: unassigned,
        wonLeads: won,
        lostLeads: lost,
        publishedProperties: propertiesPublished,
      },
      pipeline: ALL_STAGES.map((stage) => ({
        stage,
        count: stageCounts.get(stage) ?? 0,
      })),
      followUps: { dueToday: tasksDueToday, overdue: overdueFollowUps },
      siteVisits: { upcoming: upcomingVisits },
      conversion: {
        closed,
        won,
        lost,
        winRate: closed === 0 ? 0 : Math.round((won / closed) * 100),
        conversionRate: totalLeads === 0 ? 0 : Math.round((won / totalLeads) * 100),
      },
      staffPerformance: await this.staffPerformance(query),
    };
  }

  async staffPerformance(query: DashboardQuery) {
    const leadWhere = this.leadWhere(query);
    const dateFilter = this.dateRange(query);

    const [users, leadGroups, taskGroups, visitGroups] = await Promise.all([
      this.prisma.crmUser.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true, module: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.lead.groupBy({
        by: ['assigned_to', 'stage'],
        where: { ...leadWhere, assigned_to: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.followUpTask.groupBy({
        by: ['assigned_to'],
        where: {
          status: 'COMPLETED',
          assigned_to: { not: null },
          ...(dateFilter ? { completed_at: dateFilter } : {}),
        },
        _count: { _all: true },
      }),
      this.prisma.siteVisit.groupBy({
        by: ['assigned_to'],
        where: { status: 'COMPLETED', assigned_to: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const perStaff = (id: string) => {
      const rows = leadGroups.filter((row) => row.assigned_to === id);
      const countFor = (stage: string) =>
        rows.filter((row) => row.stage === stage).reduce((sum, row) => sum + row._count._all, 0);
      return {
        assignedLeads: rows.reduce((sum, row) => sum + row._count._all, 0),
        activeLeads: ACTIVE_STAGES.reduce((sum, stage) => sum + countFor(stage), 0),
        won: countFor('WON'),
        lost: countFor('LOST'),
        completedTasks:
          taskGroups.find((row) => row.assigned_to === id)?._count._all ?? 0,
        completedVisits:
          visitGroups.find((row) => row.assigned_to === id)?._count._all ?? 0,
      };
    };

    return users.map((user) => ({
      staffId: user.id,
      name: user.name,
      role: user.role,
      module: user.module,
      ...perStaff(user.id),
    }));
  }

  private dateRange(query: DashboardQuery): { gte?: Date; lte?: Date } | undefined {
    const from =
      query.from && !Number.isNaN(Date.parse(query.from)) ? startOfDay(new Date(query.from)) : undefined;
    const to =
      query.to && !Number.isNaN(Date.parse(query.to)) ? endOfDay(new Date(query.to)) : undefined;
    if (!from && !to) return undefined;
    return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }

  private leadWhere(query: DashboardQuery): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    const range = this.dateRange(query);
    if (range) where.created_at = range;

    if (query.city) {
      where.location = { contains: query.city, mode: 'insensitive' };
    }

    return where;
  }
}
