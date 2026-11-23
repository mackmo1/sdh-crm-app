import type {
  AvailabilityStatus,
  CurrentUser,
  Paginated,
  Property,
  PropertyListQuery,
  PropertyPayload,
  ProjectSummary,
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

  projects: {
    list: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
      request<Paginated<ProjectSummary>>(`/projects${toQuery(params)}`),
  },
};
