import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { DashboardData, StaffPerformance } from '../api/types';
import { LoadingBlock } from '../components/ui';

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [city, setCity] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [staff, setStaff] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { from: from || undefined, to: to || undefined, city: city || undefined };
    Promise.all([api.dashboard.overview(params), api.dashboard.staffReport(params)])
      .then(([overview, report]) => {
        if (!cancelled) {
          setData(overview);
          setStaff(report);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load reports.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, city]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Pipeline, conversion and staff performance for the selected period.</p>
        </div>
        <div className="page-actions">
          <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" style={{ width: 150 }} />
          <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To" style={{ width: 150 }} />
          <input className="input" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} aria-label="City" style={{ width: 140 }} />
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && !data ? (
        <LoadingBlock />
      ) : data ? (
        <div className="section-stack">
          <div className="stat-grid">
            <div className="stat"><div className="stat-label">Leads</div><div className="stat-value">{data.totals.totalLeads}</div></div>
            <div className="stat"><div className="stat-label">Won</div><div className="stat-value">{data.totals.wonLeads}</div></div>
            <div className="stat"><div className="stat-label">Lost</div><div className="stat-value">{data.totals.lostLeads}</div></div>
            <div className="stat"><div className="stat-label">Win rate</div><div className="stat-value">{data.conversion.winRate}%</div></div>
            <div className="stat"><div className="stat-label">Lead to win</div><div className="stat-value">{data.conversion.conversionRate}%</div></div>
            <div className="stat"><div className="stat-label">Unassigned</div><div className="stat-value">{data.totals.unassignedLeads}</div></div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Pipeline by stage</span></div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>Stage</th><th>Leads</th></tr>
                </thead>
                <tbody>
                  {data.pipeline.map((row) => (
                    <tr key={row.stage}>
                      <td className="cell-primary">{row.stage.replace('_', ' ').toLowerCase()}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Staff performance</span></div>
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
                  {staff.map((row) => {
                    const closed = row.won + row.lost;
                    const rate = closed === 0 ? 0 : Math.round((row.won / closed) * 100);
                    return (
                      <tr key={row.staffId}>
                        <td className="cell-primary">{row.name}</td>
                        <td>{row.role === 'admin' ? 'Administrator' : 'Data user'}</td>
                        <td>{row.assignedLeads}</td>
                        <td>{row.activeLeads}</td>
                        <td>{row.won}</td>
                        <td>{row.lost}</td>
                        <td>{rate}%</td>
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
