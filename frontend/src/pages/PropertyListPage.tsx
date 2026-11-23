import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type {
  AvailabilityStatus,
  ListingType,
  Paginated,
  Property,
  ProjectSummary,
  PublicationStatus,
} from '../api/types';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Pagination,
  SearchIcon,
  Select,
  SkeletonRows,
  TextArea,
} from '../components/ui';
import { formatPrice, relativeTime } from '../lib/format';
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_TONE,
  LISTING_LABEL,
  PUBLICATION_LABEL,
  PUBLICATION_TONE,
} from '../lib/status';

type PendingAction = 'publish' | 'unpublish' | 'archive' | 'restore';

const ACTION_COPY: Record<PendingAction, { title: string; confirm: string; tone: 'primary' | 'danger' }> = {
  publish: {
    title: 'Publish this property?',
    confirm: 'Publish',
    tone: 'primary',
  },
  unpublish: {
    title: 'Unpublish this property?',
    confirm: 'Unpublish',
    tone: 'primary',
  },
  archive: {
    title: 'Archive this property?',
    confirm: 'Archive',
    tone: 'danger',
  },
  restore: {
    title: 'Restore this property?',
    confirm: 'Restore',
    tone: 'primary',
  },
};

export function PropertyListPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const listingType = (searchParams.get('listingType') ?? '') as ListingType | '';
  const publicationStatus = (searchParams.get('publicationStatus') ?? '') as PublicationStatus | '';
  const availabilityStatus = (searchParams.get('availabilityStatus') ?? '') as AvailabilityStatus | '';
  const projectId = searchParams.get('projectId') ?? '';
  const search = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  const [result, setResult] = useState<Paginated<Property> | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [pending, setPending] = useState<{ action: PendingAction; property: Property } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [busy, setBusy] = useState(false);

  const updateParams = useCallback(
    (changes: Record<string, string | number | undefined>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Debounced search keeps the request count sane while typing.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(
        (previous) => {
          const current = previous.get('search') ?? '';
          if (current === searchInput) return previous;
          const next = new URLSearchParams(previous);
          if (searchInput.trim()) next.set('search', searchInput.trim());
          else next.delete('search');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    api.projects
      .list({ pageSize: 100 })
      .then((response) => {
        if (!cancelled) setProjects(response.data);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.properties
      .list({
        page,
        pageSize: 20,
        search: search || undefined,
        listingType: listingType || undefined,
        publicationStatus: publicationStatus || undefined,
        availabilityStatus: availabilityStatus || undefined,
        projectId: projectId || undefined,
      })
      .then((response) => {
        if (!cancelled) setResult(response);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load properties.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paramsKey, page, search, listingType, publicationStatus, availabilityStatus, projectId, reloadKey]);

  const hasFilters = Boolean(
    search || listingType || publicationStatus || availabilityStatus || projectId,
  );

  const filteredLabel = useMemo(() => {
    if (!result) return null;
    if (result.meta.total === 0) return null;
    return `${result.meta.total} ${result.meta.total === 1 ? 'property' : 'properties'}`;
  }, [result]);

  function openAction(action: PendingAction, property: Property) {
    setArchiveReason('');
    setPending({ action, property });
  }

  async function runAction() {
    if (!pending) return;
    const { action, property } = pending;
    setBusy(true);
    try {
      if (action === 'publish') await api.properties.publish(property.id);
      if (action === 'unpublish') await api.properties.unpublish(property.id);
      if (action === 'restore') await api.properties.restore(property.id);
      if (action === 'archive') await api.properties.archive(property.id, archiveReason);

      const messages: Record<PendingAction, string> = {
        publish: 'Property published',
        unpublish: 'Property unpublished',
        archive: 'Property archived',
        restore: 'Property restored',
      };
      notify(messages[action]);
      setPending(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Action failed', 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setSearchInput('');
    updateParams({
      search: undefined,
      listingType: undefined,
      publicationStatus: undefined,
      availabilityStatus: undefined,
      projectId: undefined,
      page: undefined,
    });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">
            Sale and rental listings across the portfolio{filteredLabel ? ` · ${filteredLabel}` : ''}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => navigate('/properties/new')}>
            Add property
          </Button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="input"
              placeholder="Search address, city, project or unit…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search properties"
            />
          </div>

          <Select
            className="select filter-select"
            value={listingType}
            onChange={(event) => updateParams({ listingType: event.target.value, page: undefined })}
            aria-label="Filter by listing type"
          >
            <option value="">All listings</option>
            <option value="SALE">Sale</option>
            <option value="RENT">Rent</option>
          </Select>

          <Select
            className="select filter-select"
            value={publicationStatus}
            onChange={(event) =>
              updateParams({ publicationStatus: event.target.value, page: undefined })
            }
            aria-label="Filter by publication status"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="ARCHIVED">Archived</option>
          </Select>

          <Select
            className="select filter-select"
            value={availabilityStatus}
            onChange={(event) =>
              updateParams({ availabilityStatus: event.target.value, page: undefined })
            }
            aria-label="Filter by availability"
          >
            <option value="">Any availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_HOLD">On hold</option>
            <option value="SOLD">Sold</option>
            <option value="RENTED">Rented</option>
          </Select>

          <Select
            className="select filter-select"
            value={projectId}
            onChange={(event) => updateParams({ projectId: event.target.value, page: undefined })}
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name ?? `Project ${project.id}`}
              </option>
            ))}
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        {loading && !result ? (
          <SkeletonRows rows={6} />
        ) : result && result.data.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No matching properties' : 'No properties yet'}
            text={
              hasFilters
                ? 'Try widening your search or clearing the filters.'
                : 'Create the first listing to get started. Drafts can be saved with incomplete details.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/properties/new')}>
                  Add property
                </Button>
              )
            }
          />
        ) : result ? (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Listing</th>
                    <th>Configuration</th>
                    <th>Price</th>
                    <th>Project</th>
                    <th>Publication</th>
                    <th>Availability</th>
                    <th>Updated</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((property) => {
                    const archived = property.publicationStatus === 'ARCHIVED';
                    return (
                      <tr
                        key={property.id}
                        className="clickable"
                        onClick={() => navigate(`/properties/${property.id}`)}
                      >
                        <td>
                          <Link
                            to={`/properties/${property.id}`}
                            className="cell-primary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {property.address}
                          </Link>
                          <span className="cell-secondary">{property.city}</span>
                        </td>
                        <td>
                          {property.listingType ? LISTING_LABEL[property.listingType] : '—'}
                          {property.type ? (
                            <span className="cell-secondary"> · {property.type}</span>
                          ) : null}
                        </td>
                        <td>{property.rooms}</td>
                        <td>{formatPrice(property.price)}</td>
                        <td>
                          {property.projectName ?? <span className="subtle">—</span>}
                          {property.unitIdentifier ? (
                            <span className="cell-secondary"> · {property.unitIdentifier}</span>
                          ) : null}
                        </td>
                        <td>
                          <Badge tone={PUBLICATION_TONE[property.publicationStatus]}>
                            {PUBLICATION_LABEL[property.publicationStatus]}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={AVAILABILITY_TONE[property.availabilityStatus]}>
                            {AVAILABILITY_LABEL[property.availabilityStatus]}
                          </Badge>
                        </td>
                        <td>
                          <span className="cell-secondary">{relativeTime(property.updatedAt)}</span>
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div className="cell-actions">
                            {archived ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openAction('restore', property)}
                              >
                                Restore
                              </Button>
                            ) : (
                              <>
                                {property.publicationStatus === 'PUBLISHED' ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openAction('unpublish', property)}
                                  >
                                    Unpublish
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openAction('publish', property)}
                                  >
                                    Publish
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/properties/${property.id}/edit`)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger-ghost"
                                  onClick={() => openAction('archive', property)}
                                >
                                  Archive
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              meta={result.meta}
              disabled={loading}
              onPageChange={(nextPage) => updateParams({ page: nextPage === 1 ? undefined : nextPage })}
            />
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_COPY[pending.action].title : ''}
        text={
          pending
            ? `${pending.property.address}, ${pending.property.city}${
                pending.action === 'publish'
                  ? '. The listing becomes visible on the public site once published.'
                  : pending.action === 'archive'
                    ? '. The record and its history are kept and can be restored later.'
                    : '.'
              }`
            : ''
        }
        confirmLabel={pending ? ACTION_COPY[pending.action].confirm : ''}
        tone={pending ? ACTION_COPY[pending.action].tone : 'primary'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      >
        {pending?.action === 'archive' && (
          <Field label="Reason (optional)" htmlFor="archive-reason">
            <TextArea
              id="archive-reason"
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Why is this listing being archived?"
              style={{ minHeight: 72 }}
            />
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}
