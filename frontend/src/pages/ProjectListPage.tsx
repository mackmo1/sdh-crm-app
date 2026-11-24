import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Paginated, ProjectSummary } from '../api/types';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  SearchIcon,
  SkeletonRows,
  TextArea,
  TextInput,
} from '../components/ui';

interface FormState {
  name: string;
  city: string;
  address: string;
  externalId: string;
  rooms: string;
  areaSqft: string;
  priceRange: string;
  usp: string;
}

const EMPTY: FormState = { name: '', city: '', address: '', externalId: '', rooms: '', areaSqft: '', priceRange: '', usp: '' };

export function ProjectListPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [result, setResult] = useState<Paginated<ProjectSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(
        await api.projects.list({
          pageSize: 100,
          search: search || undefined,
          includeArchived: includeArchived ? 'true' : undefined,
        }),
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, [search, includeArchived]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  async function create() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.projects.create({
        name: form.name.trim(),
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        externalId: form.externalId.trim() || null,
        rooms: form.rooms.trim() || null,
        areaSqft: form.areaSqft.trim() || null,
        priceRange: form.priceRange.trim() || null,
        usp: form.usp.trim() || null,
      });
      notify('Project created');
      setCreating(false);
      setForm(EMPTY);
      navigate(`/projects/${created.id}`);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Unable to create this project.');
    } finally {
      setSaving(false);
    }
  }

  async function archive(project: ProjectSummary) {
    try {
      await api.projects.archive(project.id);
      notify('Project archived. Its records are preserved.');
      setReloadKey((key) => key + 1);
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not archive the project', 'error');
    }
  }

  async function restore(project: ProjectSummary) {
    try {
      await api.projects.restore(project.id);
      notify('Project restored');
      setReloadKey((key) => key + 1);
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not restore the project', 'error');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Developer projects and the units listed against them.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => setCreating(true)}>New project</Button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <span className="search-icon"><SearchIcon /></span>
            <input className="input" placeholder="Search project or city…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search projects" />
          </div>
          <label className="checkbox-row" style={{ paddingTop: 0, fontSize: 13 }}>
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            Show archived
          </label>
        </div>

        {loading && !result ? (
          <SkeletonRows rows={5} />
        ) : result && result.data.length === 0 ? (
          <EmptyState title="No projects yet" text="Create a project to group units and track inventory." action={<Button variant="primary" onClick={() => setCreating(true)}>New project</Button>} />
        ) : result ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>City</th>
                  <th>Units</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((project) => (
                  <tr key={project.id} className="clickable" onClick={() => navigate(`/projects/${project.id}`)}>
                    <td>
                      <Link to={`/projects/${project.id}`} className="cell-primary" onClick={(event) => event.stopPropagation()}>
                        {project.name ?? `Project ${project.id}`}
                      </Link>
                      <span className="cell-secondary">{project.address ?? '—'}</span>
                    </td>
                    <td>{project.city ?? <span className="subtle">—</span>}</td>
                    <td>{project.unitCount}</td>
                    <td>{project.availableCount}</td>
                    <td><Badge tone={project.archived ? 'danger' : 'success'}>{project.archived ? 'Archived' : 'Active'}</Badge></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="cell-actions">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>View</Button>
                        {project.archived ? (
                          <Button size="sm" variant="ghost" onClick={() => void restore(project)}>Restore</Button>
                        ) : (
                          <Button size="sm" variant="danger-ghost" onClick={() => void archive(project)}>Archive</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {creating && (
        <div className="dialog-backdrop" onClick={() => setCreating(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" style={{ width: 'min(600px, 100%)' }} onClick={(event) => event.stopPropagation()}>
            <h2 className="dialog-title">New project</h2>
            {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
            <div className="form-grid">
              <Field label="Name *" htmlFor="projectName" className="span-2">
                <TextInput id="projectName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="City" htmlFor="projectCity">
                <TextInput id="projectCity" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              </Field>
              <Field label="Address" htmlFor="projectAddress">
                <TextInput id="projectAddress" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </Field>
              <Field label="External ID" htmlFor="projectExternal">
                <TextInput id="projectExternal" value={form.externalId} onChange={(event) => setForm({ ...form, externalId: event.target.value })} />
              </Field>
              <Field label="Configurations" htmlFor="projectRooms">
                <TextInput id="projectRooms" value={form.rooms} onChange={(event) => setForm({ ...form, rooms: event.target.value })} placeholder="2BHK, 3BHK" />
              </Field>
              <Field label="Area (sq ft)" htmlFor="projectArea">
                <TextInput id="projectArea" value={form.areaSqft} onChange={(event) => setForm({ ...form, areaSqft: event.target.value })} />
              </Field>
              <Field label="Price range" htmlFor="projectPrice">
                <TextInput id="projectPrice" value={form.priceRange} onChange={(event) => setForm({ ...form, priceRange: event.target.value })} />
              </Field>
              <Field label="Highlights" htmlFor="projectUsp" className="span-2">
                <TextArea id="projectUsp" value={form.usp} onChange={(event) => setForm({ ...form, usp: event.target.value })} style={{ minHeight: 70 }} />
              </Field>
            </div>
            <div className="dialog-actions" style={{ marginTop: 18 }}>
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={() => void create()} disabled={saving}>{saving ? 'Saving…' : 'Create project'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
