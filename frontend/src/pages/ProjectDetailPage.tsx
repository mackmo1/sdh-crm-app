import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ProjectDetail, Property } from '../api/types';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Field,
  LoadingBlock,
  TextArea,
  TextInput,
} from '../components/ui';
import { formatDate, formatPrice, humanise } from '../lib/format';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [units, setUnits] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, inventory] = await Promise.all([
        api.projects.get(id),
        api.projects.inventory(id, { pageSize: 100 }),
      ]);
      setProject(detail);
      setUnits(inventory.units);
      setForm({
        name: detail.name ?? '',
        city: detail.city ?? '',
        address: detail.address ?? '',
        externalId: detail.externalId ?? '',
        rooms: detail.rooms ?? '',
        areaSqft: detail.areaSqft ?? '',
        priceRange: detail.priceRange ?? '',
        usp: detail.usp ?? '',
      });
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load this project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!id || !project) return;
    setSaving(true);
    try {
      setProject(
        await api.projects.update(id, {
          name: form.name,
          city: form.city || null,
          address: form.address || null,
          externalId: form.externalId || null,
          rooms: form.rooms || null,
          areaSqft: form.areaSqft || null,
          priceRange: form.priceRange || null,
          usp: form.usp || null,
        }),
      );
      notify('Project updated');
      setEditing(false);
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not save the project', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!id || !project) return;
    try {
      setProject(project.archived ? await api.projects.restore(id) : await api.projects.archive(id));
      notify(project.archived ? 'Project restored' : 'Project archived');
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Action failed', 'error');
    }
  }

  if (loading) return <LoadingBlock />;

  if (error || !project) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-title">Project unavailable</div>
          <p className="empty-text">{error ?? 'This project could not be found.'}</p>
          <Link className="btn btn-secondary" to="/projects">Back to projects</Link>
        </div>
      </div>
    );
  }

  const availability = Object.fromEntries(
    project.summary.byAvailability.map((row) => [row.availabilityStatus, row.count]),
  ) as Record<string, number>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <Link to="/projects" className="subtle" style={{ fontSize: 13 }}>← Projects</Link>
          </div>
          <h1 className="page-title">{project.name ?? `Project ${project.id}`}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <Badge tone={project.archived ? 'danger' : 'success'}>{project.archived ? 'Archived' : 'Active'}</Badge>
            <span className="subtle" style={{ fontSize: 13 }}>{project.city ?? '—'}{project.address ? ` · ${project.address}` : ''}</span>
          </div>
        </div>
        <div className="page-actions">
          {!project.archived && <Button onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel edit' : 'Edit'}</Button>}
          <Button variant={project.archived ? 'primary' : 'danger-ghost'} onClick={() => void toggleArchive()}>
            {project.archived ? 'Restore' : 'Archive'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/properties?projectId=${project.id}`)}>View units</Button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="stat-label">Units</div><div className="stat-value">{project.summary.unitCount}</div></div>
        <div className="stat"><div className="stat-label">Available</div><div className="stat-value">{availability.AVAILABLE ?? 0}</div></div>
        <div className="stat"><div className="stat-label">On hold</div><div className="stat-value">{availability.ON_HOLD ?? 0}</div></div>
        <div className="stat"><div className="stat-label">Sold</div><div className="stat-value">{availability.SOLD ?? 0}</div></div>
        <div className="stat"><div className="stat-label">Rented</div><div className="stat-value">{availability.RENTED ?? 0}</div></div>
        <div className="stat"><div className="stat-label">Site visits</div><div className="stat-value">{project.summary.siteVisits}</div></div>
      </div>

      <div className="list-split">
        <div className="section-stack">
          <div className="card">
            <div className="card-header"><span className="card-title">{editing ? 'Edit project' : 'Details'}</span></div>
            <div className="card-body">
              {editing ? (
                <>
                  <div className="form-grid">
                    <Field label="Name" htmlFor="editName" className="span-2">
                      <TextInput id="editName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                    </Field>
                    <Field label="City" htmlFor="editCity">
                      <TextInput id="editCity" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                    </Field>
                    <Field label="Address" htmlFor="editAddress">
                      <TextInput id="editAddress" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                    </Field>
                    <Field label="External ID" htmlFor="editExternal">
                      <TextInput id="editExternal" value={form.externalId} onChange={(event) => setForm({ ...form, externalId: event.target.value })} />
                    </Field>
                    <Field label="Configurations" htmlFor="editRooms">
                      <TextInput id="editRooms" value={form.rooms} onChange={(event) => setForm({ ...form, rooms: event.target.value })} />
                    </Field>
                    <Field label="Area (sq ft)" htmlFor="editArea">
                      <TextInput id="editArea" value={form.areaSqft} onChange={(event) => setForm({ ...form, areaSqft: event.target.value })} />
                    </Field>
                    <Field label="Price range" htmlFor="editPrice">
                      <TextInput id="editPrice" value={form.priceRange} onChange={(event) => setForm({ ...form, priceRange: event.target.value })} />
                    </Field>
                    <Field label="Highlights" htmlFor="editUsp" className="span-2">
                      <TextArea id="editUsp" value={form.usp} onChange={(event) => setForm({ ...form, usp: event.target.value })} style={{ minHeight: 70 }} />
                    </Field>
                  </div>
                  <div className="form-actions">
                    <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
                  </div>
                </>
              ) : (
                <div className="detail-grid">
                  <div><div className="detail-label">City</div><div className="detail-value">{project.city ?? '—'}</div></div>
                  <div><div className="detail-label">Address</div><div className="detail-value">{project.address ?? '—'}</div></div>
                  <div><div className="detail-label">External ID</div><div className="detail-value">{project.externalId ?? '—'}</div></div>
                  <div><div className="detail-label">Configurations</div><div className="detail-value">{project.rooms ?? '—'}</div></div>
                  <div><div className="detail-label">Area</div><div className="detail-value">{project.areaSqft ?? '—'}</div></div>
                  <div><div className="detail-label">Price range</div><div className="detail-value">{project.priceRange ?? '—'}</div></div>
                  <div><div className="detail-label">Created</div><div className="detail-value">{formatDate(project.createdAt)}</div></div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Inventory by configuration</span></div>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Configuration</th><th>Units</th></tr></thead>
                <tbody>
                  {project.summary.byConfiguration.length === 0 ? (
                    <tr><td colSpan={2} className="subtle">No units linked yet.</td></tr>
                  ) : (
                    project.summary.byConfiguration.map((row) => (
                      <tr key={row.configuration}>
                        <td className="cell-primary">{row.configuration}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Units</span></div>
          <div className="card-body" style={{ maxHeight: 520, overflowY: 'auto' }}>
            {units.length === 0 ? (
              <p className="subtle" style={{ margin: 0, fontSize: 13.5 }}>No properties are linked to this project.</p>
            ) : (
              units.map((unit) => (
                <div key={unit.id} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <Link to={`/properties/${unit.id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {unit.unitIdentifier ? `${unit.unitIdentifier} · ` : ''}{unit.address}
                    </Link>
                    <div className="subtle" style={{ fontSize: 12.5 }}>
                      {unit.rooms} · {formatPrice(unit.price)} · {humanise(unit.availabilityStatus)}
                    </div>
                  </div>
                  <Badge tone={unit.publicationStatus === 'PUBLISHED' ? 'success' : 'neutral'}>
                    {humanise(unit.publicationStatus)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
