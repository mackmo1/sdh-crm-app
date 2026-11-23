import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Contact, ContactCategory, Paginated } from '../api/types';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  SearchIcon,
  Select,
  SkeletonRows,
  TextArea,
  TextInput,
} from '../components/ui';
import { relativeTime } from '../lib/format';

const CATEGORIES: ContactCategory[] = ['BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'BUILDER'];

export function ContactListPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const category = searchParams.get('category') ?? '';
  const search = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  const [result, setResult] = useState<Paginated<Contact> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'BUYER' as ContactCategory, email: '', phone: '', company: '', city: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function update(changes: Record<string, string | number | undefined>) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams((previous) => {
        if ((previous.get('search') ?? '') === searchInput) return previous;
        const next = new URLSearchParams(previous);
        if (searchInput.trim()) next.set('search', searchInput.trim());
        else next.delete('search');
        next.set('page', '1');
        return next;
      }, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.contacts
      .list({ page, pageSize: 20, search: search || undefined, category: (category || undefined) as ContactCategory | undefined })
      .then((response) => {
        if (!cancelled) {
          setResult(response);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load contacts.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paramsKey, page, search, category, reloadKey]);

  async function createContact() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      await api.contacts.create({
        name: form.name.trim(),
        category: form.category,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
      });
      notify('Contact created');
      setCreating(false);
      setForm({ name: '', category: 'BUYER', email: '', phone: '', company: '', city: '', notes: '' });
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Unable to create this contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Buyers, sellers, landlords, tenants and builders.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => setCreating(true)}>Add contact</Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              className="input"
              placeholder="Search name, phone, email or company…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search contacts"
            />
          </div>
          <Select className="select filter-select" value={category} onChange={(event) => update({ category: event.target.value, page: undefined })} aria-label="Filter by category">
            <option value="">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>{value.toLowerCase()}</option>
            ))}
          </Select>
        </div>

        {loading && !result ? (
          <SkeletonRows rows={6} />
        ) : result && result.data.length === 0 ? (
          <EmptyState title="No contacts yet" text="Add a contact to link leads, requirements and activity." action={<Button variant="primary" onClick={() => setCreating(true)}>Add contact</Button>} />
        ) : result ? (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Company</th>
                    <th>City</th>
                    <th>Phone</th>
                    <th>Leads</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((contact) => (
                    <tr key={contact.id} className="clickable" onClick={() => navigate(`/contacts/${contact.id}`)}>
                      <td>
                        <Link to={`/contacts/${contact.id}`} className="cell-primary" onClick={(event) => event.stopPropagation()}>
                          {contact.name}
                        </Link>
                        <span className="cell-secondary">{contact.email ?? '—'}</span>
                      </td>
                      <td><Badge tone="neutral">{contact.category.toLowerCase()}</Badge></td>
                      <td>{contact.company ?? <span className="subtle">—</span>}</td>
                      <td>{contact.city ?? <span className="subtle">—</span>}</td>
                      <td>{contact.phone ?? <span className="subtle">—</span>}</td>
                      <td>{contact.leadCount ?? 0}</td>
                      <td><span className="cell-secondary">{relativeTime(contact.createdAt)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span className="result-count">
                {result.meta.total === 0 ? 'No results' : `${result.meta.total} contacts`}
              </span>
              {result.meta.totalPages > 1 && (
                <div className="pagination">
                  <button type="button" className="page-btn" onClick={() => update({ page: page - 1 })} disabled={page <= 1}>‹</button>
                  <span className="subtle" style={{ padding: '0 8px' }}>{page} / {result.meta.totalPages}</span>
                  <button type="button" className="page-btn" onClick={() => update({ page: page + 1 })} disabled={page >= result.meta.totalPages}>›</button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {creating && (
        <div className="dialog-backdrop" onClick={() => setCreating(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">Add contact</h2>
            {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
            <div className="form-grid">
              <Field label="Name *" htmlFor="contactName">
                <TextInput id="contactName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Category *" htmlFor="contactCategory">
                <Select id="contactCategory" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ContactCategory })}>
                  {CATEGORIES.map((value) => (
                    <option key={value} value={value}>{value.toLowerCase()}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone" htmlFor="contactPhone">
                <TextInput id="contactPhone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="Email" htmlFor="contactEmail">
                <TextInput id="contactEmail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <Field label="Company" htmlFor="contactCompany">
                <TextInput id="contactCompany" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
              </Field>
              <Field label="City" htmlFor="contactCity">
                <TextInput id="contactCity" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              </Field>
              <Field label="Notes" htmlFor="contactNotes" className="span-2">
                <TextArea id="contactNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={{ minHeight: 70 }} />
              </Field>
            </div>
            <div className="dialog-actions" style={{ marginTop: 18 }}>
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={() => void createContact()} disabled={saving}>{saving ? 'Saving…' : 'Create contact'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
