import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ContactDetail } from '../api/types';
import { Badge, LoadingBlock } from '../components/ui';
import { formatDateTime, humanise } from '../lib/format';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api.contacts
      .get(id)
      .then((result) => {
        if (!cancelled) {
          setContact(result);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load this contact.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingBlock />;

  if (error || !contact) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-title">Contact unavailable</div>
          <p className="empty-text">{error ?? 'This contact could not be found.'}</p>
          <Link className="btn btn-secondary" to="/contacts">Back to contacts</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <Link to="/contacts" className="subtle" style={{ fontSize: 13 }}>← Contacts</Link>
          </div>
          <h1 className="page-title">{contact.name}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <Badge tone="neutral">{humanise(contact.category)}</Badge>
            <span className="subtle" style={{ fontSize: 13 }}>
              {contact.phone ?? 'No phone'} · {contact.email ?? 'No email'}
            </span>
          </div>
        </div>
      </div>

      <div className="list-split">
        <div className="section-stack">
          <div className="card">
            <div className="card-header"><span className="card-title">Details</span></div>
            <div className="card-body">
              <div className="detail-grid">
                <div><div className="detail-label">Company</div><div className="detail-value">{contact.company ?? '—'}</div></div>
                <div><div className="detail-label">City</div><div className="detail-value">{contact.city ?? '—'}</div></div>
                <div><div className="detail-label">Phone</div><div className="detail-value">{contact.phone ?? '—'}</div></div>
                <div><div className="detail-label">Email</div><div className="detail-value">{contact.email ?? '—'}</div></div>
                <div><div className="detail-label">Added</div><div className="detail-value">{formatDateTime(contact.createdAt)}</div></div>
                <div><div className="detail-label">Status</div><div className="detail-value">{contact.active ? 'Active' : 'Inactive'}</div></div>
              </div>
              {contact.address && (
                <>
                  <div className="divider" />
                  <div className="detail-label">Address</div>
                  <p className="subtle" style={{ margin: '4px 0 0', fontSize: 13 }}>{contact.address}</p>
                </>
              )}
              {contact.notes && (
                <>
                  <div className="divider" />
                  <div className="detail-label">Notes</div>
                  <p className="subtle" style={{ margin: '4px 0 0', fontSize: 13 }}>{contact.notes}</p>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Activity</span></div>
            <div className="card-body">
              {contact.interactions.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No activity recorded.</p>
              ) : (
                contact.interactions.map((interaction) => (
                  <div className="timeline-item" key={interaction.id}>
                    <div className="timeline-meta">
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{humanise(interaction.type)}</div>
                      <div>{formatDateTime(interaction.occurredAt)}</div>
                    </div>
                    <div style={{ fontSize: 13.5 }}>{interaction.summary}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="section-stack">
          <div className="card">
            <div className="card-header"><span className="card-title">Linked leads</span></div>
            <div className="card-body">
              {contact.leads.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>This contact is not linked to any lead.</p>
              ) : (
                contact.leads.map((lead) => (
                  <div key={lead.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <Link to={`/leads/${lead.id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>{lead.name ?? lead.phone}</Link>
                      <div className="subtle" style={{ fontSize: 12.5 }}>{humanise(lead.stage)}</div>
                    </div>
                    <span className="subtle" style={{ fontSize: 12.5 }}>{formatDateTime(lead.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Follow-ups</span></div>
            <div className="card-body">
              {contact.tasks.length === 0 ? (
                <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No follow-ups for this contact.</p>
              ) : (
                contact.tasks.map((task) => (
                  <div key={task.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13.5 }}>{task.title}</span>
                    <span className="subtle" style={{ fontSize: 12.5 }}>{formatDateTime(task.dueAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
