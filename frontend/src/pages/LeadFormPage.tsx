import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ContactCategory, LeadPriority, StaffOption } from '../api/types';
import { useToast } from '../components/Toast';
import { Button, Field, Select, TextArea, TextInput } from '../components/ui';

interface FormValues {
  name: string;
  phone: string;
  email: string;
  location: string;
  source: string;
  priority: LeadPriority;
  assignedTo: string;
  contactId: string;
  propertyType: string;
  bedrooms: string;
  budget: string;
  message: string;
  who: string;
  intent: string;
}

const EMPTY: FormValues = {
  name: '',
  phone: '',
  email: '',
  location: '',
  source: '',
  priority: 'MEDIUM',
  assignedTo: '',
  contactId: '',
  propertyType: '',
  bedrooms: '',
  budget: '',
  message: '',
  who: 'buyer',
  intent: 'buy',
};

export function LeadFormPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; category: ContactCategory }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  useEffect(() => {
    api.staff.options().then(setStaff).catch(() => setStaff([]));
    api.contacts.options().then(setContacts).catch(() => setContacts([]));
  }, []);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!values.name.trim()) errors.name = 'Name is required.';
    if (!values.phone.trim()) errors.phone = 'Phone number is required.';
    if (!values.email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
    if (!values.location.trim()) errors.location = 'Location is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const created = await api.leads.create({
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        location: values.location.trim(),
        source: values.source.trim() || null,
        priority: values.priority,
        assignedTo: values.assignedTo || null,
        contactId: values.contactId ? Number(values.contactId) : null,
        propertyType: values.propertyType.trim() || null,
        bedrooms: values.bedrooms.trim() || null,
        budget: values.budget.trim() || null,
        message: values.message.trim() || null,
        who: values.who,
        intent: values.intent,
      });
      notify('Lead created');
      navigate(`/leads/${created.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const errors: Record<string, string> = {};
        for (const issue of caught.issues) errors[issue.path] = issue.message;
        setFieldErrors(errors);
        setError(caught.message);
      } else {
        setError('Unable to create this lead.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="page-header">
        <div>
          <h1 className="page-title">New lead</h1>
          <p className="page-subtitle">Capture an enquiry and give it an owner.</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" onClick={() => navigate('/leads')} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create lead'}</Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card-header"><span className="card-title">Contact</span></div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="Name *" htmlFor="name" error={fieldErrors.name}>
              <TextInput id="name" value={values.name} invalid={Boolean(fieldErrors.name)} onChange={(event) => set('name', event.target.value)} placeholder="Rohit Sharma" />
            </Field>
            <Field label="Phone *" htmlFor="phone" error={fieldErrors.phone}>
              <TextInput id="phone" value={values.phone} invalid={Boolean(fieldErrors.phone)} onChange={(event) => set('phone', event.target.value)} placeholder="+91 98200 00000" />
            </Field>
            <Field label="Email *" htmlFor="email" error={fieldErrors.email}>
              <TextInput id="email" type="email" value={values.email} invalid={Boolean(fieldErrors.email)} onChange={(event) => set('email', event.target.value)} placeholder="rohit@example.com" />
            </Field>
            <Field label="Location *" htmlFor="location" error={fieldErrors.location}>
              <TextInput id="location" value={values.location} invalid={Boolean(fieldErrors.location)} onChange={(event) => set('location', event.target.value)} placeholder="Andheri West, Mumbai" />
            </Field>
            <Field label="Linked contact" htmlFor="contactId">
              <Select id="contactId" value={values.contactId} onChange={(event) => set('contactId', event.target.value)}>
                <option value="">No linked contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name} — {contact.category.toLowerCase()}</option>
                ))}
              </Select>
            </Field>
            <Field label="Source" htmlFor="source">
              <TextInput id="source" value={values.source} onChange={(event) => set('source', event.target.value)} placeholder="Website, referral, walk-in…" />
            </Field>
          </div>
        </div>
      </div>

      <div className="section-stack" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Enquiry</span></div>
          <div className="card-body">
            <div className="form-grid">
              <Field label="Who is enquiring" htmlFor="who">
                <Select id="who" value={values.who} onChange={(event) => set('who', event.target.value)}>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="landlord">Landlord</option>
                  <option value="tenant">Tenant</option>
                  <option value="builder">Builder</option>
                </Select>
              </Field>
              <Field label="Intent" htmlFor="intent">
                <Select id="intent" value={values.intent} onChange={(event) => set('intent', event.target.value)}>
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                  <option value="sell">Sell</option>
                </Select>
              </Field>
              <Field label="Property type" htmlFor="propertyType">
                <TextInput id="propertyType" value={values.propertyType} onChange={(event) => set('propertyType', event.target.value)} placeholder="Apartment" />
              </Field>
              <Field label="Bedrooms" htmlFor="bedrooms">
                <TextInput id="bedrooms" value={values.bedrooms} onChange={(event) => set('bedrooms', event.target.value)} placeholder="2BHK" />
              </Field>
              <Field label="Budget" htmlFor="budget">
                <TextInput id="budget" value={values.budget} onChange={(event) => set('budget', event.target.value)} placeholder="2–3 Cr" />
              </Field>
              <Field label="Priority" htmlFor="priority">
                <Select id="priority" value={values.priority} onChange={(event) => set('priority', event.target.value as LeadPriority)}>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </Select>
              </Field>
              <Field label="Assign to" htmlFor="assignedTo" className="span-2">
                <Select id="assignedTo" value={values.assignedTo} onChange={(event) => set('assignedTo', event.target.value)}>
                  <option value="">Leave unassigned</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes" htmlFor="message" className="span-2">
                <TextArea id="message" value={values.message} onChange={(event) => set('message', event.target.value)} placeholder="What did they ask for?" />
              </Field>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <Button variant="secondary" onClick={() => navigate('/leads')} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create lead'}</Button>
        </div>
      </div>
    </form>
  );
}
