import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { DashboardData } from '../api/types';
import { LoadingBlock } from '../components/ui';
import { humanise } from '../lib/format';

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.dashboard
      .overview({ from: from || undefined, to: to || undefined, city: city || undefined })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
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
          <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" style={{ width: 150 }} />
          <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" style={{ width: 150 }} />
          <input className="input" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} aria-label="City" style={{ width: 140 }} />
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && !data ? (
        <LoadingBlock />
      ) : data ? (
        <div className="section-stack">
          <div className="stat-grid">
            <Stat label="Total leads" value={data.totals.totalLeads} />
            <Stat label="New leads" value={data.totals.newLeads} hint="Awaiting first contact" />
            <Stat label="Unassigned" value={data.totals.unassignedLeads} hint="Need an owner" />
            <Stat label="Follow-ups due today" value={data.followUps.dueToday} />
            <Stat label="Overdue follow-ups" value={data.followUps.overdue} hint="Past their due date" />
            <Stat label="Upcoming visits" value={data.siteVisits.upcoming} />
            <Stat label="Won" value={data.totals.wonLeads} hint={`Win rate ${data.conversion.winRate}%`} />
            <Stat label="Lost" value={data.totals.lostLeads} />
          </div>

          <div className="list-split">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Pipeline</span>
                <span className="subtle" style={{ fontSize: 12.5 }}>
                  {data.totals.activeLeads} active
                </span>
              </div>
              <div className="card-body">
                {data.pipeline.map((row) => (
                  <div className="pipeline-row" key={row.stage}>
                    <span>{humanise(row.stage)}</span>
                    <div className="pipeline-track">
                      <div className="pipeline-fill" style={{ width: `${Math.round((row.count / maxStage) * 100)}%` }} />
                    </div>
                    <strong style={{ textAlign: 'right' }}>{row.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Conversion</span>
              </div>
              <div className="card-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">Closed leads</div>
                    <div className="detail-value strong">{data.conversion.closed}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Won / lost</div>
                    <div className="detail-value">{data.conversion.won} / {data.conversion.lost}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Win rate</div>
                    <div className="detail-value strong">{data.conversion.winRate}%</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Lead-to-win</div>
                    <div className="detail-value">{data.conversion.conversionRate}%</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Published properties</div>
                    <div className="detail-value">{data.totals.publishedProperties}</div>
                  </div>
                </div>
                <div className="divider" />
                <Link to="/reports" className="subtle" style={{ fontSize: 13 }}>
                  View full reports →
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Staff performance</span>
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
                    <th>Tasks done</th>
                    <th>Visits done</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffPerformance.map((row) => (
                    <tr key={row.staffId}>
                      <td className="cell-primary">{row.name}</td>
                      <td>{row.role === 'admin' ? 'Administrator' : 'Data user'}</td>
                      <td>{row.assignedLeads}</td>
                      <td>{row.activeLeads}</td>
                      <td>{row.won}</td>
                      <td>{row.lost}</td>
                      <td>{row.completedTasks}</td>
                      <td>{row.completedVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
