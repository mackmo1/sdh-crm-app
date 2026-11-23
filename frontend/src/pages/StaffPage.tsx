import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { CrmModule, Paginated, StaffMember, StaffRole } from '../api/types';
import { useToast } from '../components/Toast';
import { Badge, Button, EmptyState, Field, Select, SkeletonRows, TextInput } from '../components/ui';
import { formatDate } from '../lib/format';

const ROLES: StaffRole[] = ['admin', 'data_user'];
const MODULES: CrmModule[] = ['all', 'lead', 'property'];

interface FormState {
  name: string;
  email: string;
  role: StaffRole;
  module: CrmModule;
  password: string;
  active: boolean;
}

const EMPTY: FormState = { name: '', email: '', role: 'data_user', module: 'all', password: '', active: true };

export function StaffPage() {
  const { notify } = useToast();
  const [result, setResult] = useState<Paginated<StaffMember> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await api.staff.list({ pageSize: 100, search: search || undefined }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load staff.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  function startCreate() {
    setForm(EMPTY);
    setFormError(null);
    setCreating(true);
    setEditing(null);
  }

  function startEdit(member: StaffMember) {
    setForm({
      name: member.name,
      email: member.email,
      role: member.role,
      module: member.module,
      password: '',
      active: member.active,
    });
    setFormError(null);
    setEditing(member);
    setCreating(false);
  }

  async function save() {
    setFormError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }

    setSaving(true);
    try {
      if (creating) {
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters.');
        await api.staff.create({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          module: form.module,
          password: form.password,
        });
        notify('Staff account created');
      } else if (editing) {
        await api.staff.update(editing.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          module: form.module,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        notify('Staff account updated');
      }
      setCreating(false);
      setEditing(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="page-subtitle">Accounts, roles and module access.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={startCreate}>Add staff</Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <input className="input" placeholder="Search name or email…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search staff" />
          </div>
        </div>

        {loading && !result ? (
          <SkeletonRows rows={5} />
        ) : result && result.data.length === 0 ? (
          <EmptyState title="No staff accounts" text="Create the first account to give someone access." action={<Button variant="primary" onClick={startCreate}>Add staff</Button>} />
        ) : result ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((member) => (
                  <tr key={member.id}>
                    <td className="cell-primary">{member.name}</td>
                    <td>{member.email}</td>
                    <td>{member.role === 'admin' ? 'Administrator' : 'Data user'}</td>
                    <td>{member.module}</td>
                    <td>
                      <Badge tone={member.active ? 'success' : 'danger'}>{member.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td><span className="cell-secondary">{formatDate(member.createdAt)}</span></td>
                    <td>
                      <div className="cell-actions">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(member)}>Edit</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {(creating || editing) && (
        <div className="dialog-backdrop" onClick={() => { setCreating(false); setEditing(null); }} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">{creating ? 'Add staff account' : `Edit ${editing?.name}`}</h2>
            {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}

            <div className="form-grid">
              <Field label="Name *" htmlFor="staffName">
                <TextInput id="staffName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Email *" htmlFor="staffEmail">
                <TextInput id="staffEmail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <Field label="Role *" htmlFor="staffRole">
                <Select id="staffRole" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as StaffRole })}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{role === 'admin' ? 'admin' : 'data_user'}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Module *" htmlFor="staffModule">
                <Select id="staffModule" value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value as CrmModule })}>
                  {MODULES.map((module) => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label={creating ? 'Password *' : 'New password'}
                htmlFor="staffPassword"
                hint={creating ? 'At least 8 characters.' : 'Leave blank to keep the current password.'}
                className="span-2"
              >
                <TextInput id="staffPassword" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" />
              </Field>
              {editing && (
                <div className="checkbox-row" style={{ paddingTop: 0 }}>
                  <input id="staffActive" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                  <label htmlFor="staffActive">Account is active</label>
                </div>
              )}
            </div>

            <div className="dialog-actions" style={{ marginTop: 18 }}>
              <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
