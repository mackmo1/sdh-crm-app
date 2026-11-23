import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { LeadPriority, LeadStage, LeadSummary, Paginated } from '../api/types';
import { Badge, Button, EmptyState, SearchIcon, Select, SkeletonRows } from '../components/ui';
import { relativeTime } from '../lib/format';

const STAGE_TONE: Record<LeadStage, 'neutral' | 'primary' | 'success' | 'warn' | 'danger'> = {
  NEW: 'primary',
  CONTACTED: 'neutral',
  QUALIFIED: 'neutral',
  SITE_VISIT: 'primary',
  NEGOTIATION: 'warn',
  ON_HOLD: 'warn',
  WON: 'success',
  LOST: 'danger',
};

const PRIORITY_TONE: Record<LeadPriority, 'neutral' | 'warn' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'warn',
  HIGH: 'danger',
};

export function LeadListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const stage = searchParams.get('stage') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const assignment = searchParams.get('assignment') ?? '';
  const search = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  const [result, setResult] = useState<Paginated<LeadSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function update(changes: Record<string, string | number | undefined>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '') next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(
        (previous) => {
          if ((previous.get('search') ?? '') === searchInput) return previous;
          const next = new URLSearchParams(previous);
          if (searchInput.trim()) next.set('search', searchInput.trim());
          else next.delete('search');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.leads
      .list({
        page,
        pageSize: 20,
        search: search || undefined,
        stage: stage || undefined,
        priority: priority || undefined,
        assignment: assignment || undefined,
      })
      .then((response) => {
        if (!cancelled) {
          setResult(response);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load leads.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paramsKey, page, search, stage, priority, assignment]);

  const hasFilters = Boolean(search || stage || priority || assignment);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Every enquiry, its owner and the next action due.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => navigate('/leads/new')}>
            New lead
          </Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              className="input"
              placeholder="Search name, phone, email or location…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search leads"
            />
          </div>
          <Select className="select filter-select" value={stage} onChange={(event) => update({ stage: event.target.value, page: undefined })} aria-label="Filter by stage">
            <option value="">All stages</option>
            {(['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'ON_HOLD', 'WON', 'LOST'] as LeadStage[]).map((value) => (
              <option key={value} value={value}>{value.replace('_', ' ').toLowerCase()}</option>
            ))}
          </Select>
          <Select className="select filter-select" value={priority} onChange={(event) => update({ priority: event.target.value, page: undefined })} aria-label="Filter by priority">
            <option value="">Any priority</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
          <Select className="select filter-select" value={assignment} onChange={(event) => update({ assignment: event.target.value, page: undefined })} aria-label="Filter by assignment">
            <option value="">Any owner</option>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); update({ search: undefined, stage: undefined, priority: undefined, assignment: undefined, page: undefined }); }}>
              Clear
            </Button>
          )}
        </div>

        {loading && !result ? (
          <SkeletonRows rows={6} />
        ) : result && result.data.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No matching leads' : 'No leads yet'}
            text={hasFilters ? 'Try widening your search or clearing the filters.' : 'Enquiries from the website and leads added by staff appear here.'}
            action={<Button variant="primary" onClick={() => navigate('/leads/new')}>New lead</Button>}
          />
        ) : result ? (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Stage</th>
                    <th>Priority</th>
                    <th>Owner</th>
                    <th>Requirements</th>
                    <th>Next follow-up</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((lead) => (
                    <tr key={lead.id} className="clickable" onClick={() => navigate(`/leads/${lead.id}`)}>
                      <td>
                        <Link to={`/leads/${lead.id}`} className="cell-primary" onClick={(event) => event.stopPropagation()}>
                          {lead.name ?? lead.phone}
                        </Link>
                        <span className="cell-secondary">{lead.phone} · {lead.location}</span>
                      </td>
                      <td><Badge tone={STAGE_TONE[lead.stage]}>{lead.stage.replace('_', ' ').toLowerCase()}</Badge></td>
                      <td><Badge tone={PRIORITY_TONE[lead.priority]}>{lead.priority.toLowerCase()}</Badge></td>
                      <td>{lead.assignedToName ?? <span className="subtle">Unassigned</span>}</td>
                      <td>{lead.requirementCount}</td>
                      <td>
                        {lead.nextTaskDueAt ? (
                          <span style={{ color: lead.overdue ? 'var(--danger)' : undefined }}>
                            {relativeTime(lead.nextTaskDueAt)}
                          </span>
                        ) : (
                          <span className="subtle">—</span>
                        )}
                      </td>
                      <td><span className="cell-secondary">{relativeTime(lead.createdAt)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span className="result-count">
                {result.meta.total === 0 ? 'No results' : `Showing ${(page - 1) * result.meta.pageSize + 1}–${Math.min(page * result.meta.pageSize, result.meta.total)} of ${result.meta.total}`}
              </span>
              {result.meta.totalPages > 1 && (
                <div className="pagination">
                  <button type="button" className="page-btn" onClick={() => update({ page: page - 1 })} disabled={page <= 1}>‹</button>
                  <span className="subtle" style={{ padding: '0 8px' }}>{page} / {result.meta.totalPages}</span>
                  <button type="button" className="page-btn" onClick={() => update({ page: page + 1 })} disabled={page >= result.meta.totalPages}>›</button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
