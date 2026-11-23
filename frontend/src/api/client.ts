import type {
  AvailabilityStatus,
  Contact,
  ContactCategory,
  ContactDetail,
  CurrentUser,
  DashboardData,
  Interaction,
  InteractionType,
  LeadDetail,
  LeadStage,
  LeadSummary,
  MatchResult,
  Paginated,
  PaginationMeta,
  Property,
  PropertyListQuery,
  PropertyPayload,
  ProjectDetail,
  ProjectSummary,
  ImportEntity,
  ImportPreview,
  Requirement,
  SiteVisit,
  StaffMember,
  StaffOption,
  StaffPerformance,
  Task,
} from './types';

const BASE = '/api';

interface ApiErrorBody {
  message?: unknown;
  issues?: { path: string; message: string }[];
  missing?: string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues: { path: string; message: string }[];
  readonly missing: string[];

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = body?.issues ?? [];
    this.missing = body?.missing ?? [];
  }

  /** Field-level message for a form field, if the server reported one. */
  fieldError(field: string): string | undefined {
    return this.issues.find((issue) => issue.path === field)?.message;
  }
}

function describe(body: ApiErrorBody | null, status: number): string {
  if (!body) return `Request failed (${status})`;
  if (typeof body.message === 'string') {
    return body.missing?.length
      ? `${body.message}: ${body.missing.join(', ')}`
      : body.message;
  }
  if (Array.isArray(body.message)) return body.message.join('. ');
  return `Request failed (${status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: ApiErrorBody | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as ApiErrorBody;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, describe(body, response.status), body);
  }

  return body as T;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  auth: {
    me: () => request<{ user: CurrentUser }>('/auth/me'),
    login: (email: string, password: string) =>
      request<{ user: CurrentUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    forgotPassword: (email: string) =>
      request<{ delivered: boolean; transport: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request<void>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  },

  properties: {
    list: (query: PropertyListQuery) =>
      request<Paginated<Property>>(
        `/properties${toQuery({
          page: query.page,
          pageSize: query.pageSize,
          search: query.search,
          listingType: query.listingType,
          publicationStatus: query.publicationStatus,
          availabilityStatus: query.availabilityStatus,
          projectId: query.projectId,
          sort: query.sort,
        })}`,
      ),
    get: (id: string) => request<Property>(`/properties/${id}`),
    create: (payload: PropertyPayload) =>
      request<Property>('/properties', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: PropertyPayload) =>
      request<Property>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    publish: (id: string) => request<Property>(`/properties/${id}/publish`, { method: 'POST' }),
    unpublish: (id: string) => request<Property>(`/properties/${id}/unpublish`, { method: 'POST' }),
    archive: (id: string, reason?: string) =>
      request<Property>(`/properties/${id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason ?? undefined }),
      }),
    restore: (id: string) => request<Property>(`/properties/${id}/restore`, { method: 'POST' }),
    setAvailability: (id: string, availabilityStatus: AvailabilityStatus) =>
      request<Property>(`/properties/${id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ availabilityStatus }),
      }),
  },


  contacts: {
    list: (params: { page?: number; pageSize?: number; search?: string; category?: ContactCategory; active?: string } = {}) =>
      request<Paginated<Contact>>(`/contacts${toQuery(params)}`),
    options: () => request<{ id: string; name: string; phone: string | null; category: ContactCategory }[]>('/contacts/options'),
    get: (id: string) => request<ContactDetail>(`/contacts/${id}`),
    create: (payload: Record<string, unknown>) =>
      request<Contact>('/contacts', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<Contact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  },

  leads: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      request<Paginated<LeadSummary>>(`/leads${toQuery(params)}`),
    get: (id: string) => request<LeadDetail>(`/leads/${id}`),
    create: (payload: Record<string, unknown>) =>
      request<LeadDetail>('/leads', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<LeadDetail>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    assign: (id: string, assignedTo: string) =>
      request<LeadDetail>(`/leads/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignedTo }),
      }),
    changeStage: (id: string, stage: LeadStage, onHoldReason?: string) =>
      request<LeadDetail>(`/leads/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage, onHoldReason }),
      }),
    close: (id: string, outcome: 'SALE' | 'RENT' | 'LOST', lossReason?: string, selectedPropertyId?: string) =>
      request<LeadDetail>(`/leads/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ outcome, lossReason, selectedPropertyId }),
      }),
    reopen: (id: string, reason: string) =>
      request<LeadDetail>(`/leads/${id}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),
    addInteraction: (id: string, payload: { type: InteractionType; summary: string; outcome?: string; nextAction?: string; occurredAt?: string }) =>
      request<Interaction>(`/leads/${id}/interactions`, { method: 'POST', body: JSON.stringify(payload) }),
    addRequirement: (id: string, payload: Record<string, unknown>) =>
      request<Requirement>(`/leads/${id}/requirements`, { method: 'POST', body: JSON.stringify(payload) }),
    updateRequirement: (id: string, requirementId: string, payload: Record<string, unknown>) =>
      request<Requirement>(`/leads/${id}/requirements/${requirementId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteRequirement: (id: string, requirementId: string) =>
      request<void>(`/leads/${id}/requirements/${requirementId}`, { method: 'DELETE' }),
    matches: (id: string, requirementId: string) =>
      request<{ data: MatchResult[] }>(`/leads/${id}/requirements/${requirementId}/matches`),
    shortlist: (id: string, requirementId: string, propertyId: string) =>
      request<Requirement>(`/leads/${id}/requirements/${requirementId}/shortlist`, {
        method: 'POST',
        body: JSON.stringify({ propertyId }),
      }),
    removeShortlist: (id: string, requirementId: string, propertyId: string) =>
      request<Requirement>(`/leads/${id}/requirements/${requirementId}/shortlist/${propertyId}`, {
        method: 'DELETE',
      }),
  },

  tasks: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      request<Paginated<Task>>(`/tasks${toQuery(params)}`),
    create: (payload: Record<string, unknown>) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    complete: (id: string, payload: { completionNotes?: string; nextAction?: string }) =>
      request<Task>(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
    cancel: (id: string) => request<Task>(`/tasks/${id}/cancel`, { method: 'POST' }),
  },

  siteVisits: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      request<Paginated<SiteVisit>>(`/site-visits${toQuery(params)}`),
    create: (payload: Record<string, unknown>) =>
      request<SiteVisit>('/site-visits', { method: 'POST', body: JSON.stringify(payload) }),
    reschedule: (id: string, scheduledAt: string, reason?: string) =>
      request<SiteVisit>(`/site-visits/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduledAt, reason }),
      }),
    cancel: (id: string, reason?: string) =>
      request<SiteVisit>(`/site-visits/${id}/cancel`, { method: 'POST', body: JSON.stringify({ feedback: reason }) }),
    complete: (id: string, payload: { feedback?: string; nextSteps?: string }) =>
      request<SiteVisit>(`/site-visits/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
    noShow: (id: string, payload: { feedback?: string }) =>
      request<SiteVisit>(`/site-visits/${id}/no-show`, { method: 'POST', body: JSON.stringify(payload) }),
  },

  dashboard: {
    overview: (params: { from?: string; to?: string; city?: string } = {}) =>
      request<DashboardData>(`/dashboard${toQuery(params)}`),
    staffReport: (params: { from?: string; to?: string; city?: string } = {}) =>
      request<StaffPerformance[]>(`/reports/staff${toQuery(params)}`),
  },

  staff: {
    list: (params: { page?: number; pageSize?: number; search?: string; active?: string } = {}) =>
      request<Paginated<StaffMember>>(`/staff${toQuery(params)}`),
    options: () => request<StaffOption[]>('/staff-directory'),
    create: (payload: Record<string, unknown>) =>
      request<StaffMember>('/staff', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<StaffMember>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  },

  projects: {
    list: (params: { search?: string; page?: number; pageSize?: number; includeArchived?: string } = {}) =>
      request<Paginated<ProjectSummary>>(`/projects${toQuery(params)}`),
    options: () => request<{ id: string; name: string | null; city: string | null }[]>('/projects/options'),
    get: (id: string) => request<ProjectDetail>(`/projects/${id}`),
    inventory: (id: string, params: Record<string, string | number | undefined> = {}) =>
      request<{ summary: unknown; units: Property[]; meta: PaginationMeta }>(
        `/projects/${id}/inventory${toQuery(params)}`,
      ),
    create: (payload: Record<string, unknown>) =>
      request<ProjectDetail>('/projects', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<ProjectDetail>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    archive: (id: string) => request<ProjectDetail>(`/projects/${id}/archive`, { method: 'POST' }),
    restore: (id: string) => request<ProjectDetail>(`/projects/${id}/restore`, { method: 'POST' }),
  },

  data: {
    exportCsv: async (entity: ImportEntity): Promise<string> => {
      const response = await fetch(`${BASE}/data/export/${entity}`, { credentials: 'include' });
      if (!response.ok) throw new ApiError(response.status, 'Export failed', null);
      return response.text();
    },
    previewImport: (entity: ImportEntity, csv: string) =>
      request<ImportPreview>(`/data/import/${entity}/preview`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    commitImport: (entity: ImportEntity, csv: string, excludeRows: number[]) =>
      request<{ imported: number; skipped: number; failed: number }>(`/data/import/${entity}`, {
        method: 'POST',
        body: JSON.stringify({ csv, excludeRows }),
      }),
  },
};
