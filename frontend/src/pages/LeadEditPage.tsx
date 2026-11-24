import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { LeadPriority, StaffOption } from '../api/types';
import { useToast } from '../components/Toast';
import { Button, Field, LoadingBlock, Select, TextArea, TextInput } from '../components/ui';

export function LeadEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [values, setValues] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    source: '',
    priority: 'MEDIUM' as LeadPriority,
    budget: '',
    bedrooms: '',
    propertyType: '',
    message: '',
    contactId: '',
  });
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([api.leads.get(id), api.contacts.options(), api.staff.options()])
      .then(([lead, contactOptions, staffOptions]) => {
        if (cancelled) return;
        setValues({
          name: lead.name ?? '',
          phone: lead.phone,
          email: lead.email,
          location: lead.location,
          source: lead.source ?? '',
          priority: lead.priority,
          budget: lead.budget ?? '',
          bedrooms: lead.bedrooms ?? '',
          propertyType: lead.propertyType ?? '',
          message: lead.message ?? '',
          contactId: lead.contactId ?? '',
        });
        setContacts(contactOptions);
        setStaff(staffOptions);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load this lead.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function set(key: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      await api.leads.update(id, {
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        location: values.location.trim(),
        source: values.source.trim() || null,
        priority: values.priority,
        budget: values.budget.trim() || null,
        bedrooms: values.bedrooms.trim() || null,
        propertyType: values.propertyType.trim() || null,
        message: values.message.trim() || null,
        contactId: values.contactId ? Number(values.contactId) : null,
      });
      notify('Lead updated');
      navigate(`/leads/${id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save this lead.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock />;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="page-header">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <Link to={`/leads/${id}`} className="subtle" style={{ fontSize: 13 }}>← Back to lead</Link>
          </div>
          <h1 className="page-title">Edit lead</h1>
        </div>
        <div className="page-actions">
          <Button variant="ghost" onClick={() => navigate(`/leads/${id}`)} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card-header"><span className="card-title">Lead details</span></div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="Name" htmlFor="editLeadName">
              <TextInput id="editLeadName" value={values.name} onChange={(event) => set('name', event.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="editLeadPhone">
              <TextInput id="editLeadPhone" value={values.phone} onChange={(event) => set('phone', event.target.value)} />
            </Field>
            <Field label="Email" htmlFor="editLeadEmail">
              <TextInput id="editLeadEmail" type="email" value={values.email} onChange={(event) => set('email', event.target.value)} />
            </Field>
            <Field label="Location" htmlFor="editLeadLocation">
              <TextInput id="editLeadLocation" value={values.location} onChange={(event) => set('location', event.target.value)} />
            </Field>
            <Field label="Source" htmlFor="editLeadSource">
              <TextInput id="editLeadSource" value={values.source} onChange={(event) => set('source', event.target.value)} />
            </Field>
            <Field label="Priority" htmlFor="editLeadPriority">
              <Select id="editLeadPriority" value={values.priority} onChange={(event) => set('priority', event.target.value)}>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </Field>
            <Field label="Budget" htmlFor="editLeadBudget">
              <TextInput id="editLeadBudget" value={values.budget} onChange={(event) => set('budget', event.target.value)} />
            </Field>
            <Field label="Bedrooms" htmlFor="editLeadBedrooms">
              <TextInput id="editLeadBedrooms" value={values.bedrooms} onChange={(event) => set('bedrooms', event.target.value)} />
            </Field>
            <Field label="Property type" htmlFor="editLeadType">
              <TextInput id="editLeadType" value={values.propertyType} onChange={(event) => set('propertyType', event.target.value)} />
            </Field>
            <Field label="Linked contact" htmlFor="editLeadContact">
              <Select id="editLeadContact" value={values.contactId} onChange={(event) => set('contactId', event.target.value)}>
                <option value="">No linked contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="editLeadNotes" className="span-2">
              <TextArea id="editLeadNotes" value={values.message} onChange={(event) => set('message', event.target.value)} />
            </Field>
          </div>
          <p className="field-hint" style={{ marginTop: 12 }}>
            Stage, ownership and closure are managed from the lead page so every change is recorded in history.
            {staff.length === 0 ? ' No staff directory available.' : ''}
          </p>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 18 }}>
        <Button variant="secondary" onClick={() => navigate(`/leads/${id}`)} disabled={saving}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  );
}
