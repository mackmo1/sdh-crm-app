import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type {
  InteractionType,
  LeadDetail,
  LeadPriority,
  LeadStage,
  MatchResult,
  Property,
  Requirement,
  StaffOption,
} from '../api/types';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Field,
  LoadingBlock,
  Select,
  TextArea,
  TextInput,
} from '../components/ui';
import { formatDateTime, formatPrice, humanise, relativeTime } from '../lib/format';

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

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        style={{ width: 'min(560px, 100%)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function useAction(onDone: (lead: LeadDetail) => void, onClose: () => void) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<LeadDetail>, message: string) => {
      setBusy(true);
      setError(null);
      try {
        const lead = await action();
        notify(message);
        onDone(lead);
        onClose();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [notify, onDone, onClose],
  );

  return { busy, error, run };
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [dialog, setDialog] = useState<
    'assign' | 'stage' | 'close' | 'reopen' | 'interaction' | 'requirement' | 'task' | 'visit' | null
  >(null);
  const [matchTarget, setMatchTarget] = useState<Requirement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setLead(await api.leads.get(id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load this lead.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api.staff.options().then(setStaff).catch(() => setStaff([]));
    api.properties
      .list({ publicationStatus: 'PUBLISHED', pageSize: 100 })
      .then((response) => setProperties(response.data))
      .catch(() => setProperties([]));
  }, []);

  async function completeTask(taskId: string) {
    try {
      await api.tasks.complete(taskId, {});
      notify('Task completed');
      await load();
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not complete the task', 'error');
    }
  }

  if (loading) return <LoadingBlock />;

  if (error || !lead) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-title">Lead unavailable</div>
          <p className="empty-text">{error ?? 'This lead could not be found.'}</p>
          <Link className="btn btn-secondary" to="/leads">Back to leads</Link>
        </div>
      </div>
    );
  }

  const closed = lead.stage === 'WON' || lead.stage === 'LOST';
  const overdueTasks = lead.tasks.filter((task) => task.overdue);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <Link to="/leads" className="subtle" style={{ fontSize: 13 }}>← Leads</Link>
          </div>
          <h1 className="page-title">{lead.name ?? lead.phone}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <Badge tone={STAGE_TONE[lead.stage]}>{humanise(lead.stage)}</Badge>
            <Badge tone={PRIORITY_TONE[lead.priority]}>{humanise(lead.priority)} priority</Badge>
            <span className="subtle" style={{ fontSize: 13 }}>
              {lead.phone} · {lead.email} · {lead.location}
            </span>
          </div>
        </div>
        <div className="page-actions">
          {!closed && (
            <>
              <Button onClick={() => setDialog('stage')}>Change stage</Button>
              <Button variant="secondary" onClick={() => setDialog('close')}>Close lead</Button>
            </>
          )}
          {closed && <Button variant="primary" onClick={() => setDialog('reopen')}>Reopen lead</Button>}
          <Button variant="ghost" onClick={() => setDialog('assign')}>Assign</Button>
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          {overdueTasks.length} overdue follow-up{overdueTasks.length > 1 ? 's' : ''} on this lead.
        </div>
      )}
      {lead.onHoldReason && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          On hold: {lead.onHoldReason}
        </div>
      )}
      {lead.stage === 'LOST' && lead.lossReason && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          Lost: {lead.lossReason}
        </div>
      )}

      <div className="list-split">
        <div className="section-stack">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Requirements</span>
              <Button size="sm" variant="secondary" onClick={() => setDialog('requirement')}>Add requirement</Button>
            </div>
            <div className="card-body">
              {lead.requirements.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>
                  No requirements recorded yet.
                </p>
              ) : (
                <div className="section-stack" style={{ gap: 14 }}>
                  {lead.requirements.map((requirement) => (
                    <div key={requirement.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: 13.5 }}>
                          {humanise(requirement.intent)} · {requirement.bedrooms ?? 'Any configuration'}
                        </strong>
                        <Button size="sm" variant="ghost" onClick={() => setMatchTarget(requirement)}>
                          Find matches
                        </Button>
                      </div>
                      <div className="row" style={{ marginTop: 8, gap: 8 }}>
                        <span className="chip">
                          Budget {requirement.budgetMin ? formatPrice(requirement.budgetMin) : '—'} – {requirement.budgetMax ? formatPrice(requirement.budgetMax) : '—'}
                        </span>
                        {requirement.locations && <span className="chip">{requirement.locations}</span>}
                        {requirement.propertyType && <span className="chip">{requirement.propertyType}</span>}
                        {requirement.timeframe && <span className="chip">{requirement.timeframe}</span>}
                        <span className="chip">{requirement.shortlist.length} shortlisted</span>
                      </div>
                      {requirement.notes && (
                        <p className="subtle" style={{ margin: '10px 0 0', fontSize: 13 }}>{requirement.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Activity timeline</span>
              <Button size="sm" variant="secondary" onClick={() => setDialog('interaction')}>Log interaction</Button>
            </div>
            <div className="card-body">
              {lead.interactions.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No activity recorded yet.</p>
              ) : (
                lead.interactions.map((interaction) => (
                  <div className="timeline-item" key={interaction.id}>
                    <div className="timeline-meta">
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{humanise(interaction.type)}</div>
                      <div>{formatDateTime(interaction.occurredAt)}</div>
                      {interaction.createdByName && <div>{interaction.createdByName}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5 }}>{interaction.summary}</div>
                      {interaction.outcome && (
                        <div className="subtle" style={{ fontSize: 12.5, marginTop: 4 }}>Outcome: {interaction.outcome}</div>
                      )}
                      {interaction.nextAction && (
                        <div className="subtle" style={{ fontSize: 12.5, marginTop: 2 }}>Next: {interaction.nextAction}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="section-stack">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Follow-ups</span>
              <Button size="sm" variant="secondary" onClick={() => setDialog('task')}>Add task</Button>
            </div>
            <div className="card-body">
              {lead.tasks.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No open follow-ups.</p>
              ) : (
                lead.tasks.map((task) => (
                  <div key={task.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13.5 }}>{task.title}</div>
                      <div className="subtle" style={{ fontSize: 12.5, color: task.overdue ? 'var(--danger)' : undefined }}>
                        due {relativeTime(task.dueAt)}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void completeTask(task.id)}>Complete</Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Site visits</span>
              <Button size="sm" variant="secondary" onClick={() => setDialog('visit')}>Schedule</Button>
            </div>
            <div className="card-body">
              {lead.siteVisits.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No site visits yet.</p>
              ) : (
                lead.siteVisits.map((visit) => (
                  <div key={visit.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13.5 }}>{formatDateTime(visit.scheduledAt)}</span>
                      <Badge tone={visit.status === 'COMPLETED' ? 'success' : visit.status === 'SCHEDULED' ? 'primary' : 'danger'}>
                        {humanise(visit.status)}
                      </Badge>
                    </div>
                    {visit.feedback && <div className="subtle" style={{ fontSize: 12.5, marginTop: 4 }}>{visit.feedback}</div>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Details</span></div>
            <div className="card-body">
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><div className="detail-label">Owner</div><div className="detail-value">{lead.assignedToName ?? 'Unassigned'}</div></div>
                <div><div className="detail-label">Source</div><div className="detail-value">{lead.source ?? '—'}</div></div>
                <div><div className="detail-label">Contact</div><div className="detail-value">{lead.contactName ?? '—'}</div></div>
                <div><div className="detail-label">Created</div><div className="detail-value">{formatDateTime(lead.createdAt)}</div></div>
                <div><div className="detail-label">Budget</div><div className="detail-value">{lead.budget ?? '—'}</div></div>
                <div><div className="detail-label">Bedrooms</div><div className="detail-value">{lead.bedrooms ?? '—'}</div></div>
                {lead.selectedProperty && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="detail-label">Selected property</div>
                    <div className="detail-value">{lead.selectedProperty.address}, {lead.selectedProperty.city}</div>
                  </div>
                )}
              </div>
              {lead.message && (
                <>
                  <div className="divider" />
                  <p className="subtle" style={{ margin: 0, fontSize: 13 }}>{lead.message}</p>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Stage history</span></div>
            <div className="card-body" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {lead.stageHistory.map((entry) => (
                <div key={entry.id} className="timeline-item" style={{ gridTemplateColumns: '1fr', gap: 2 }}>
                  <div style={{ fontSize: 13 }}>
                    {entry.fromStage ? `${humanise(entry.fromStage)} → ` : ''}
                    <strong>{humanise(entry.toStage)}</strong>
                  </div>
                  <div className="timeline-meta">
                    {formatDateTime(entry.changedAt)}{entry.changedBy ? ` · ${entry.changedBy}` : ''}
                  </div>
                  {entry.reason && <div className="timeline-meta">{entry.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dialog === 'assign' && (
        <AssignDialog lead={lead} staff={staff} onClose={() => setDialog(null)} onDone={setLead} />
      )}
      {dialog === 'stage' && <StageDialog lead={lead} onClose={() => setDialog(null)} onDone={setLead} />}
      {dialog === 'close' && (
        <CloseDialog lead={lead} properties={properties} onClose={() => setDialog(null)} onDone={setLead} />
      )}
      {dialog === 'reopen' && <ReopenDialog lead={lead} onClose={() => setDialog(null)} onDone={setLead} />}
      {dialog === 'interaction' && (
        <InteractionDialog lead={lead} onClose={() => setDialog(null)} onDone={setLead} />
      )}
      {dialog === 'requirement' && (
        <RequirementDialog lead={lead} onClose={() => setDialog(null)} onDone={setLead} />
      )}
      {dialog === 'task' && <TaskDialog lead={lead} onClose={() => setDialog(null)} onDone={setLead} />}
      {dialog === 'visit' && (
        <VisitDialog lead={lead} properties={properties} onClose={() => setDialog(null)} onDone={setLead} />
      )}
      {matchTarget && (
        <MatchesDialog
          lead={lead}
          requirement={matchTarget}
          onClose={() => setMatchTarget(null)}
          onDone={(updated) => {
            setLead(updated);
            setMatchTarget(updated.requirements.find((row) => row.id === matchTarget.id) ?? null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ dialogs */

function AssignDialog({
  lead,
  staff,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  staff: StaffOption[];
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Assign lead" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <Field label="Staff member" htmlFor="assignee">
        <Select id="assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
          <option value="">Choose a staff member</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </Select>
      </Field>
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !assignedTo}
          onClick={() => void run(() => api.leads.assign(lead.id, assignedTo), 'Lead assigned')}
        >
          {busy ? 'Working…' : 'Assign'}
        </Button>
      </div>
    </Dialog>
  );
}

function StageDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [stage, setStage] = useState<LeadStage>('CONTACTED');
  const [onHoldReason, setOnHoldReason] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Change stage" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <Field label="New stage" htmlFor="stage">
        <Select id="stage" value={stage} onChange={(event) => setStage(event.target.value as LeadStage)}>
          {(['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'ON_HOLD'] as LeadStage[]).map((value) => (
            <option key={value} value={value}>{humanise(value)}</option>
          ))}
        </Select>
      </Field>
      {stage === 'ON_HOLD' && (
        <div style={{ marginTop: 12 }}>
          <Field label="Reason for hold" htmlFor="holdReason">
            <TextArea id="holdReason" value={onHoldReason} onChange={(event) => setOnHoldReason(event.target.value)} style={{ minHeight: 70 }} />
          </Field>
        </div>
      )}
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || (stage === 'ON_HOLD' && !onHoldReason.trim())}
          onClick={() => void run(() => api.leads.changeStage(lead.id, stage, onHoldReason || undefined), 'Stage updated')}
        >
          {busy ? 'Working…' : 'Update stage'}
        </Button>
      </div>
    </Dialog>
  );
}

function CloseDialog({
  lead,
  properties,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  properties: Property[];
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [outcome, setOutcome] = useState<'SALE' | 'RENT' | 'LOST'>('SALE');
  const [lossReason, setLossReason] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Close lead" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <Field label="Outcome" htmlFor="outcome">
        <Select id="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as 'SALE' | 'RENT' | 'LOST')}>
          <option value="SALE">Won — sale</option>
          <option value="RENT">Won — rental</option>
          <option value="LOST">Lost</option>
        </Select>
      </Field>
      {outcome === 'LOST' ? (
        <div style={{ marginTop: 12 }}>
          <Field label="Loss reason" htmlFor="lossReason">
            <TextArea id="lossReason" value={lossReason} onChange={(event) => setLossReason(event.target.value)} style={{ minHeight: 70 }} />
          </Field>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Field label="Selected property" htmlFor="selectedProperty">
            <Select id="selectedProperty" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
              <option value="">Not specified</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.address}, {property.city}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant={outcome === 'LOST' ? 'danger' : 'primary'}
          disabled={busy || (outcome === 'LOST' && !lossReason.trim())}
          onClick={() =>
            void run(
              () => api.leads.close(lead.id, outcome, lossReason || undefined, selectedPropertyId || undefined),
              outcome === 'LOST' ? 'Lead marked lost' : 'Lead marked won',
            )
          }
        >
          {busy ? 'Working…' : 'Close lead'}
        </Button>
      </div>
    </Dialog>
  );
}

function ReopenDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Reopen lead" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <Field label="Reason" htmlFor="reopenReason">
        <TextArea id="reopenReason" value={reason} onChange={(event) => setReason(event.target.value)} style={{ minHeight: 70 }} />
      </Field>
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" disabled={busy || reason.trim().length < 3} onClick={() => void run(() => api.leads.reopen(lead.id, reason), 'Lead reopened')}>
          {busy ? 'Working…' : 'Reopen'}
        </Button>
      </div>
    </Dialog>
  );
}

function InteractionDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [type, setType] = useState<InteractionType>('CALL');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Log interaction" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid">
        <Field label="Type" htmlFor="type">
          <Select id="type" value={type} onChange={(event) => setType(event.target.value as InteractionType)}>
            <option value="CALL">Phone call</option>
            <option value="MEETING">Meeting</option>
            <option value="MESSAGE">Message</option>
            <option value="EMAIL">Email</option>
            <option value="NOTE">Note</option>
          </Select>
        </Field>
        <Field label="Outcome" htmlFor="outcome">
          <TextInput id="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Interested, callback later…" />
        </Field>
        <Field label="Summary *" htmlFor="summary" className="span-2">
          <TextArea id="summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <Field label="Next action" htmlFor="nextAction" className="span-2">
          <TextInput id="nextAction" value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
        </Field>
      </div>
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !summary.trim()}
          onClick={() =>
            void run(
              () => api.leads.addInteraction(lead.id, { type, summary, outcome: outcome || undefined, nextAction: nextAction || undefined }).then(() => api.leads.get(lead.id)),
              'Interaction logged',
            )
          }
        >
          {busy ? 'Working…' : 'Save'}
        </Button>
      </div>
    </Dialog>
  );
}

function RequirementDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [intent, setIntent] = useState<'BUY' | 'SELL' | 'RENT'>('BUY');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [locations, setLocations] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Add requirement" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid">
        <Field label="Intent" htmlFor="intent">
          <Select id="intent" value={intent} onChange={(event) => setIntent(event.target.value as 'BUY' | 'SELL' | 'RENT')}>
            <option value="BUY">Buy</option>
            <option value="RENT">Rent</option>
            <option value="SELL">Sell</option>
          </Select>
        </Field>
        <Field label="Timeframe" htmlFor="timeframe">
          <TextInput id="timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} placeholder="Within 3 months" />
        </Field>
        <Field label="Budget min" htmlFor="budgetMin">
          <TextInput id="budgetMin" type="number" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} />
        </Field>
        <Field label="Budget max" htmlFor="budgetMax">
          <TextInput id="budgetMax" type="number" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} />
        </Field>
        <Field label="Locations" htmlFor="locations" hint="Comma separated">
          <TextInput id="locations" value={locations} onChange={(event) => setLocations(event.target.value)} placeholder="Andheri, Bandra" />
        </Field>
        <Field label="Property type" htmlFor="propertyType">
          <TextInput id="propertyType" value={propertyType} onChange={(event) => setPropertyType(event.target.value)} placeholder="Apartment" />
        </Field>
        <Field label="Bedrooms" htmlFor="bedrooms">
          <TextInput id="bedrooms" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} placeholder="2BHK" />
        </Field>
        <Field label="Notes" htmlFor="requirementNotes" className="span-2">
          <TextArea id="requirementNotes" value={notes} onChange={(event) => setNotes(event.target.value)} style={{ minHeight: 70 }} />
        </Field>
      </div>
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                api.leads
                  .addRequirement(lead.id, {
                    intent,
                    budgetMin: budgetMin || null,
                    budgetMax: budgetMax || null,
                    locations: locations || null,
                    propertyType: propertyType || null,
                    bedrooms: bedrooms || null,
                    timeframe: timeframe || null,
                    notes: notes || null,
                  })
                  .then(() => api.leads.get(lead.id)),
              'Requirement added',
            )
          }
        >
          {busy ? 'Working…' : 'Add requirement'}
        </Button>
      </div>
    </Dialog>
  );
}

function TaskDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [nextAction, setNextAction] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Add follow-up" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid">
        <Field label="Title *" htmlFor="taskTitle" className="span-2">
          <TextInput id="taskTitle" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Call back about the Bandra flat" />
        </Field>
        <Field label="Due *" htmlFor="taskDue">
          <TextInput id="taskDue" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field label="Next action" htmlFor="taskNext">
          <TextInput id="taskNext" value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
        </Field>
      </div>
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !title.trim() || !dueAt}
          onClick={() =>
            void run(
              () =>
                api.tasks
                  .create({ title, leadId: Number(lead.id), dueAt: new Date(dueAt).toISOString(), nextAction: nextAction || null })
                  .then(() => api.leads.get(lead.id)),
              'Follow-up created',
            )
          }
        >
          {busy ? 'Working…' : 'Create task'}
        </Button>
      </div>
    </Dialog>
  );
}

function VisitDialog({
  lead,
  properties,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  properties: Property[];
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const { busy, error, run } = useAction(onDone, onClose);

  return (
    <Dialog title="Schedule site visit" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid">
        <Field label="Property *" htmlFor="visitProperty" className="span-2">
          <Select id="visitProperty" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
            <option value="">Choose a property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.address}, {property.city}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date and time *" htmlFor="visitAt" className="span-2">
          <TextInput id="visitAt" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
        </Field>
      </div>
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || !propertyId || !scheduledAt}
          onClick={() =>
            void run(
              () =>
                api.siteVisits
                  .create({ leadId: Number(lead.id), propertyId: Number(propertyId), scheduledAt: new Date(scheduledAt).toISOString() })
                  .then(() => api.leads.get(lead.id)),
              'Site visit scheduled',
            )
          }
        >
          {busy ? 'Working…' : 'Schedule'}
        </Button>
      </div>
    </Dialog>
  );
}

function MatchesDialog({
  lead,
  requirement,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  requirement: Requirement;
  onClose: () => void;
  onDone: (lead: LeadDetail) => void;
}) {
  const { notify } = useToast();
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api.leads
      .matches(lead.id, requirement.id)
      .then((response) => setMatches(response.data))
      .catch(() => setMatches([]));
  }, [lead.id, requirement.id]);

  async function toggle(match: MatchResult) {
    setBusyId(match.id);
    try {
      if (match.shortlisted) {
        await api.leads.removeShortlist(lead.id, requirement.id, match.id);
        notify('Removed from shortlist');
      } else {
        await api.leads.shortlist(lead.id, requirement.id, match.id);
        notify('Added to shortlist');
      }
      const refreshed = await api.leads.matches(lead.id, requirement.id);
      setMatches(refreshed.data);
      onDone(await api.leads.get(lead.id));
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not update the shortlist', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog title="Matching properties" onClose={onClose}>
      {matches === null ? (
        <LoadingBlock />
      ) : matches.length === 0 ? (
        <p className="subtle" style={{ margin: 0 }}>No published properties match this requirement yet.</p>
      ) : (
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {matches.map((match) => (
            <div key={match.id} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{match.address}</div>
                <div className="subtle" style={{ fontSize: 12.5 }}>
                  {match.city} · {match.rooms} · {formatPrice(match.price)}
                </div>
              </div>
              <Button
                size="sm"
                variant={match.shortlisted ? 'ghost' : 'secondary'}
                disabled={busyId === match.id}
                onClick={() => void toggle(match)}
              >
                {match.shortlisted ? 'Remove' : 'Shortlist'}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="dialog-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
}
