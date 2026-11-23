import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Paginated, Task } from '../api/types';
import { useToast } from '../components/Toast';
import { Badge, Button, EmptyState, SkeletonRows } from '../components/ui';
import { formatDateTime, relativeTime } from '../lib/format';

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'open', label: 'All open' },
  { key: 'completed', label: 'Completed' },
] as const;

export function FollowUpsPage() {
  const { notify } = useToast();
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('today');
  const [result, setResult] = useState<Paginated<Task> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await api.tasks.list({ view, pageSize: 50 }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load follow-ups.');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(task: Task) {
    setBusyId(task.id);
    try {
      await api.tasks.complete(task.id, {});
      notify('Follow-up completed');
      await load();
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not complete the task', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="page-subtitle">Everything that needs action, ordered by due date.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Follow-up view">
            {VIEWS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={view === entry.key ? 'selected' : ''}
                onClick={() => setView(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !result ? (
          <SkeletonRows rows={6} />
        ) : result && result.data.length === 0 ? (
          <EmptyState title="Nothing here" text="No follow-ups match this view." />
        ) : result ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Lead</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span className="cell-primary">{task.title}</span>
                      {task.nextAction && <span className="cell-secondary">{task.nextAction}</span>}
                    </td>
                    <td>
                      {task.lead ? (
                        <Link to={`/leads/${task.lead.id}`}>{task.lead.name ?? task.lead.phone}</Link>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>
                    <td>{task.assignedToName ?? <span className="subtle">—</span>}</td>
                    <td>
                      <div>{formatDateTime(task.dueAt)}</div>
                      <span className="cell-secondary" style={{ color: task.overdue ? 'var(--danger)' : undefined }}>
                        {relativeTime(task.dueAt)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={task.status === 'COMPLETED' ? 'success' : task.status === 'CANCELLED' ? 'danger' : task.overdue ? 'danger' : 'primary'}>
                        {task.status === 'OPEN' && task.overdue ? 'Overdue' : task.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td>
                      <div className="cell-actions">
                        {task.status === 'OPEN' && (
                          <Button size="sm" variant="ghost" disabled={busyId === task.id} onClick={() => void complete(task)}>
                            Complete
                          </Button>
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
    </>
  );
}
