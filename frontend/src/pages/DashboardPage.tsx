import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { DashboardData, SiteVisit, Task } from '../api/types';
import { Badge, LoadingBlock } from '../components/ui';
import { formatDateTime, humanise, relativeTime } from '../lib/format';

function Metric({
  label,
  value,
  note,
  tone,
  to,
}: {
  label: string;
  value: number | string;
  note?: string;
  tone?: 'danger' | 'warn';
  to: string;
}) {
  return (
    <Link to={to} className="metric" style={{ color: 'inherit', textDecoration: 'none' }}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </Link>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { from: from || undefined, to: to || undefined, city: city || undefined };

    Promise.all([
      api.dashboard.overview(params),
      api.tasks.list({ view: 'today', pageSize: 6 }),
      api.siteVisits.list({ view: 'upcoming', pageSize: 5 }),
    ])
      .then(([overview, todayTasks, upcomingVisits]) => {
        if (cancelled) return;
        setData(overview);
        setTasks(todayTasks.data);
        setVisits(upcomingVisits.data);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load the dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, city]);

  const maxStage = data ? Math.max(...data.pipeline.map((row) => row.count), 1) : 1;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Live pipeline, follow-ups and staff performance.</p>
        </div>
        <div className="page-actions">
          <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" style={{ width: 148 }} />
          <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" style={{ width: 148 }} />
          <input className="input" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} aria-label="City" style={{ width: 130 }} />
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && !data ? (
        <LoadingBlock />
      ) : data ? (
        <div className="section-stack">
          <div className="metric-strip">
            <Metric label="Total leads" value={data.totals.totalLeads} note={`${data.totals.activeLeads} active`} to="/leads" />
            <Metric label="New leads" value={data.totals.newLeads} note="Awaiting first contact" to="/leads?stage=NEW" />
            <Metric label="Unassigned" value={data.totals.unassignedLeads} note="Need an owner" to="/leads?assignment=unassigned" />
            <Metric label="Due today" value={data.followUps.dueToday} note="Follow-ups" to="/follow-ups?view=today" />
            <Metric
              label="Overdue"
              value={data.followUps.overdue}
              note="Follow-ups"
              tone={data.followUps.overdue > 0 ? 'danger' : undefined}
              to="/follow-ups?view=overdue"
            />
            <Metric label="Upcoming visits" value={data.siteVisits.upcoming} note="Scheduled" to="/site-visits" />
          </div>

          <div className="list-split">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Pipeline distribution</span>
                <Link to="/pipeline" className="subtle" style={{ fontSize: 12.5 }}>
                  Open board →
                </Link>
              </div>
              <div className="card-body">
                {data.pipeline.map((row) => (
                  <div className="pipeline-row" key={row.stage}>
                    <Link to={`/leads?stage=${row.stage}`} style={{ color: 'var(--text-2)' }}>
                      {humanise(row.stage)}
                    </Link>
                    <div className="pipeline-track">
                      <div
                        className="pipeline-fill"
                        style={{
                          width: `${Math.round((row.count / maxStage) * 100)}%`,
                          background: row.stage === 'WON' ? 'var(--success)' : row.stage === 'LOST' ? '#c00' : 'var(--blue-600)',
                        }}
                      />
                    </div>
                    <strong style={{ textAlign: 'right' }}>{row.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Conversion</span>
                <Link to="/reports" className="subtle" style={{ fontSize: 12.5 }}>
                  Reports →
                </Link>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <div className="detail-label">Win rate</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--blue-900)' }}>{data.conversion.winRate}%</div>
                    <div className="metric-note">of closed leads</div>
                  </div>
                  <div>
                    <div className="detail-label">Lead to win</div>
                    <div style={{ fontSize: 26, fontWeight: 700 }}>{data.conversion.conversionRate}%</div>
                    <div className="metric-note">of all leads</div>
                  </div>
                </div>
                <div className="divider" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <div className="detail-label">Won</div>
                    <div className="detail-value strong" style={{ color: 'var(--success)' }}>{data.totals.wonLeads}</div>
                  </div>
                  <div>
                    <div className="detail-label">Lost</div>
                    <div className="detail-value strong" style={{ color: 'var(--danger)' }}>{data.totals.lostLeads}</div>
                  </div>
                  <div>
                    <div className="detail-label">Published</div>
                    <div className="detail-value strong">{data.totals.publishedProperties}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="list-split">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Today&apos;s follow-ups</span>
                <Link to="/follow-ups?view=today" className="subtle" style={{ fontSize: 12.5 }}>
                  View all →
                </Link>
              </div>
              <div className="card-body">
                {tasks.length === 0 ? (
                  <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>Nothing due today.</p>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{task.title}</div>
                        <div className="subtle" style={{ fontSize: 12.5 }}>
                          {task.lead ? (
                            <Link to={`/leads/${task.lead.id}`}>{task.lead.name ?? task.lead.phone}</Link>
                          ) : (
                            'No linked lead'
                          )}
                          {task.assignedToName ? ` · ${task.assignedToName}` : ''}
                        </div>
                      </div>
                      <span className="subtle" style={{ fontSize: 12.5 }}>{relativeTime(task.dueAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Upcoming site visits</span>
                <Link to="/site-visits" className="subtle" style={{ fontSize: 12.5 }}>
                  View all →
                </Link>
              </div>
              <div className="card-body">
                {visits.length === 0 ? (
                  <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No scheduled visits.</p>
                ) : (
                  visits.map((visit) => (
                    <div key={visit.id} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                          {visit.lead ? visit.lead.name ?? visit.lead.phone : `Lead ${visit.leadId}`}
                        </div>
                        <div className="subtle" style={{ fontSize: 12.5 }}>
                          {visit.property ? `${visit.property.address}, ${visit.property.city}` : 'Property'}
                        </div>
                      </div>
                      <span className="subtle" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {formatDateTime(visit.scheduledAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Staff performance</span>
              <Link to="/reports" className="subtle" style={{ fontSize: 12.5 }}>
                Full report →
              </Link>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Role</th>
                    <th>Assigned</th>
                    <th>Active</th>
                    <th>Won</th>
                    <th>Lost</th>
                    <th>Win rate</th>
                    <th>Tasks done</th>
                    <th>Visits done</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffPerformance.map((row) => {
                    const closed = row.won + row.lost;
                    const rate = closed === 0 ? 0 : Math.round((row.won / closed) * 100);
                    return (
                      <tr key={row.staffId}>
                        <td className="cell-primary" style={{ color: 'var(--text)' }}>{row.name}</td>
                        <td>{row.role === 'admin' ? 'Administrator' : 'Data user'}</td>
                        <td>{row.assignedLeads}</td>
                        <td>{row.activeLeads}</td>
                        <td>{row.won}</td>
                        <td>{row.lost}</td>
                        <td><Badge tone={rate >= 50 ? 'success' : 'neutral'}>{rate}%</Badge></td>
                        <td>{row.completedTasks}</td>
                        <td>{row.completedVisits}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
