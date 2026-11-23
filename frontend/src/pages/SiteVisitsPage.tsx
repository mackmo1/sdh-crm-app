import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Paginated, SiteVisit } from '../api/types';
import { useToast } from '../components/Toast';
import { Badge, Button, EmptyState, Field, SkeletonRows, TextArea, TextInput } from '../components/ui';
import { formatDateTime } from '../lib/format';

const VIEWS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
] as const;

type Action = 'complete' | 'no-show' | 'cancel' | 'reschedule';

export function SiteVisitsPage() {
  const { notify } = useToast();
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('upcoming');
  const [result, setResult] = useState<Paginated<SiteVisit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ visit: SiteVisit; action: Action } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await api.siteVisits.list({ view, pageSize: 50 }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load site visits.');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  function open(visit: SiteVisit, action: Action) {
    setTarget({ visit, action });
    setFeedback('');
    setNextSteps('');
    setScheduledAt(visit.scheduledAt.slice(0, 16));
  }

  async function submit() {
    if (!target) return;
    setBusy(true);
    try {
      const { visit, action } = target;
      if (action === 'complete') await api.siteVisits.complete(visit.id, { feedback, nextSteps });
      if (action === 'no-show') await api.siteVisits.noShow(visit.id, { feedback });
      if (action === 'cancel') await api.siteVisits.cancel(visit.id, feedback);
      if (action === 'reschedule') {
        await api.siteVisits.reschedule(visit.id, new Date(scheduledAt).toISOString(), feedback);
      }
      notify('Site visit updated');
      setTarget(null);
      await load();
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not update the visit', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Site visits</h1>
          <p className="page-subtitle">Scheduled viewings, their outcomes and follow-ups.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Site visit view">
            {VIEWS.map((entry) => (
              <button key={entry.key} type="button" className={view === entry.key ? 'selected' : ''} onClick={() => setView(entry.key)}>
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !result ? (
          <SkeletonRows rows={6} />
        ) : result && result.data.length === 0 ? (
          <EmptyState title="No site visits" text="Schedule a visit from a lead's page." />
        ) : result ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Lead</th>
                  <th>Property</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((visit) => (
                  <tr key={visit.id}>
                    <td>{formatDateTime(visit.scheduledAt)}</td>
                    <td>
                      {visit.lead ? <Link to={`/leads/${visit.lead.id}`}>{visit.lead.name ?? visit.lead.phone}</Link> : '—'}
                    </td>
                    <td>
                      {visit.property ? `${visit.property.address}, ${visit.property.city}` : `#${visit.propertyId}`}
                    </td>
                    <td>{visit.assignedToName ?? <span className="subtle">—</span>}</td>
                    <td>
                      <Badge
                        tone={
                          visit.status === 'COMPLETED'
                            ? 'success'
                            : visit.status === 'SCHEDULED'
                              ? 'primary'
                              : 'danger'
                        }
                      >
                        {visit.status === 'NO_SHOW' ? 'No show' : visit.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td>
                      <div className="cell-actions">
                        {visit.status === 'SCHEDULED' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => open(visit, 'complete')}>Complete</Button>
                            <Button size="sm" variant="ghost" onClick={() => open(visit, 'no-show')}>No show</Button>
                            <Button size="sm" variant="ghost" onClick={() => open(visit, 'reschedule')}>Reschedule</Button>
                            <Button size="sm" variant="danger-ghost" onClick={() => open(visit, 'cancel')}>Cancel</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {target && (
        <div className="dialog-backdrop" onClick={() => setTarget(null)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">
              {target.action === 'complete'
                ? 'Complete visit'
                : target.action === 'no-show'
                  ? 'Mark as no show'
                  : target.action === 'cancel'
                    ? 'Cancel visit'
                    : 'Reschedule visit'}
            </h2>

            {target.action === 'reschedule' && (
              <Field label="New date and time" htmlFor="visitReschedule">
                <TextInput id="visitReschedule" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
              </Field>
            )}

            <div style={{ marginTop: 12 }}>
              <Field label={target.action === 'cancel' ? 'Reason' : 'Feedback'} htmlFor="visitFeedback">
                <TextArea id="visitFeedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} style={{ minHeight: 80 }} />
              </Field>
            </div>

            {target.action === 'complete' && (
              <div style={{ marginTop: 12 }}>
                <Field label="Next steps" htmlFor="visitNext">
                  <TextInput id="visitNext" value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} />
                </Field>
              </div>
            )}

            <div className="dialog-actions" style={{ marginTop: 18 }}>
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
              <Button
                variant={target.action === 'cancel' || target.action === 'no-show' ? 'danger' : 'primary'}
                onClick={() => void submit()}
                disabled={busy || (target.action === 'reschedule' && !scheduledAt)}
              >
                {busy ? 'Working…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
