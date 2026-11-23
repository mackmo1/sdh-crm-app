import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { LeadPriority, LeadStage, LeadSummary } from '../api/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Field, LoadingBlock, TextArea } from '../components/ui';
import { relativeTime } from '../lib/format';

const BOARD_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'ON_HOLD'];
const STAGE_LABEL: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  SITE_VISIT: 'Site visit',
  NEGOTIATION: 'Negotiation',
  ON_HOLD: 'On hold',
  WON: 'Won',
  LOST: 'Lost',
};
const PRIORITY_TONE: Record<LeadPriority, 'neutral' | 'warn' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'warn',
  HIGH: 'danger',
};

export function PipelinePage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Record<string, LeadSummary[]>>({});
  const [closed, setClosed] = useState<{ won: LeadSummary[]; lost: LeadSummary[] }>({ won: [], lost: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<LeadStage | null>(null);
  const [holdTarget, setHoldTarget] = useState<LeadSummary | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [active, won, lost] = await Promise.all([
        api.leads.list({ pageSize: 100, assignment: undefined }),
        api.leads.list({ pageSize: 20, stage: 'WON' }),
        api.leads.list({ pageSize: 20, stage: 'LOST' }),
      ]);

      const grouped: Record<string, LeadSummary[]> = {};
      for (const stage of BOARD_STAGES) grouped[stage] = [];
      for (const lead of active.data) {
        if (grouped[lead.stage]) grouped[lead.stage].push(lead);
      }
      setBoard(grouped);
      setClosed({ won: won.data, lost: lost.data });
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load the pipeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(lead: LeadSummary, stage: LeadStage, reason?: string) {
    setBusy(true);
    try {
      await api.leads.changeStage(lead.id, stage, reason);
      notify(`${lead.name ?? lead.phone} moved to ${STAGE_LABEL[stage]}`);
      await load();
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not move the lead', 'error');
    } finally {
      setBusy(false);
      setHoldTarget(null);
      setHoldReason('');
    }
  }

  function onDrop(stage: LeadStage) {
    setHoverStage(null);
    if (!dragId) return;
    const lead = Object.values(board).flat().find((entry) => entry.id === dragId);
    setDragId(null);
    if (!lead || lead.stage === stage) return;

    if (stage === 'ON_HOLD') {
      setHoldTarget(lead);
      return;
    }
    void move(lead, stage);
  }

  if (loading) return <LoadingBlock />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="page-subtitle">
            Drag a card to move a lead between stages. On hold requires a reason.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" to="/leads">List view</Link>
          <Button variant="primary" onClick={() => navigate('/leads/new')}>New lead</Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="board">
        {BOARD_STAGES.map((stage) => (
          <div
            key={stage}
            className={`board-column${hoverStage === stage ? ' over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setHoverStage(stage);
            }}
            onDragLeave={() => setHoverStage((current) => (current === stage ? null : current))}
            onDrop={() => onDrop(stage)}
          >
            <div className="board-head">
              <span>{STAGE_LABEL[stage]}</span>
              <span className="chip">{board[stage]?.length ?? 0}</span>
            </div>

            <div className="board-body">
              {(board[stage] ?? []).map((lead) => (
                <article
                  key={lead.id}
                  className="board-card"
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <Link to={`/leads/${lead.id}`} className="board-name">
                      {lead.name ?? lead.phone}
                    </Link>
                    <Badge tone={PRIORITY_TONE[lead.priority]}>{lead.priority.toLowerCase()}</Badge>
                  </div>
                  <div className="board-meta">{lead.location}</div>
                  <div className="board-meta">{lead.phone}</div>
                  <div className="board-foot">
                    <span className="chip">{lead.assignedToName ?? 'Unassigned'}</span>
                    {lead.nextTaskDueAt ? (
                      <span className="board-due" style={{ color: lead.overdue ? 'var(--danger)' : undefined }}>
                        {relativeTime(lead.nextTaskDueAt)}
                      </span>
                    ) : (
                      <span className="board-due">No follow-up</span>
                    )}
                  </div>
                </article>
              ))}

              {(board[stage] ?? []).length === 0 && (
                <div className="board-empty">Nothing here</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="list-split" style={{ marginTop: 18 }}>
        {(['won', 'lost'] as const).map((bucket) => (
          <div className="card" key={bucket}>
            <div className="card-header">
              <span className="card-title">{bucket === 'won' ? 'Won' : 'Lost'}</span>
              <span className="chip">{closed[bucket].length}</span>
            </div>
            <div className="card-body">
              {closed[bucket].length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No closed leads yet.</p>
              ) : (
                closed[bucket].map((lead) => (
                  <div key={lead.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <Link to={`/leads/${lead.id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>{lead.name ?? lead.phone}</Link>
                      <div className="subtle" style={{ fontSize: 12.5 }}>{lead.location}</div>
                    </div>
                    <span className="subtle" style={{ fontSize: 12.5 }}>{lead.assignedToName ?? 'Unassigned'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {holdTarget && (
        <div className="dialog-backdrop" onClick={() => setHoldTarget(null)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">Put lead on hold</h2>
            <p className="dialog-text">
              {holdTarget.name ?? holdTarget.phone} will move to On hold. A reason is required and is kept in the lead history.
            </p>
            <Field label="Reason" htmlFor="pipelineHoldReason">
              <TextArea id="pipelineHoldReason" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} style={{ minHeight: 70 }} />
            </Field>
            <div className="dialog-actions" style={{ marginTop: 18 }}>
              <Button variant="secondary" onClick={() => setHoldTarget(null)} disabled={busy}>Cancel</Button>
              <Button variant="primary" disabled={busy || !holdReason.trim()} onClick={() => void move(holdTarget, 'ON_HOLD', holdReason)}>
                {busy ? 'Working…' : 'Put on hold'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
