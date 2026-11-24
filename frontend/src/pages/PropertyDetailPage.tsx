import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { AvailabilityStatus, Property } from '../api/types';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  LoadingBlock,
  Select,
  TextArea,
} from '../components/ui';
import { formatDateTime, formatPriceFull } from '../lib/format';
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_TONE,
  LISTING_LABEL,
  PUBLICATION_LABEL,
  PUBLICATION_TONE,
} from '../lib/status';

type PendingAction = 'publish' | 'unpublish' | 'archive' | 'restore';

function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className={`detail-value${empty ? ' empty' : ''}`}>{empty ? '—' : value}</div>
    </div>
  );
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setProperty(await api.properties.get(id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load this property.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction() {
    if (!property || !pending) return;
    setBusy(true);
    try {
      const updated =
        pending === 'publish'
          ? await api.properties.publish(property.id)
          : pending === 'unpublish'
            ? await api.properties.unpublish(property.id)
            : pending === 'restore'
              ? await api.properties.restore(property.id)
              : await api.properties.archive(property.id, archiveReason);

      setProperty(updated);
      setPending(null);
      notify(
        pending === 'publish'
          ? 'Property published'
          : pending === 'unpublish'
            ? 'Property unpublished'
            : pending === 'restore'
              ? 'Property restored'
              : 'Property archived',
      );
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Action failed', 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function changeAvailability(next: AvailabilityStatus) {
    if (!property) return;
    setAvailabilityBusy(true);
    try {
      const updated = await api.properties.setAvailability(property.id, next);
      setProperty(updated);
      notify(`Availability set to ${AVAILABILITY_LABEL[next]}`);
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not change availability', 'error');
    } finally {
      setAvailabilityBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;

  if (error || !property) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-title">Property unavailable</div>
          <p className="empty-text">{error ?? 'This property could not be found.'}</p>
          <Button variant="secondary" onClick={() => navigate('/properties')}>
            Back to properties
          </Button>
        </div>
      </div>
    );
  }

  const archived = property.publicationStatus === 'ARCHIVED';
  const isSale = property.listingType === 'SALE';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <Link to="/properties" className="subtle" style={{ fontSize: 13 }}>
              ← Properties
            </Link>
          </div>
          <h1 className="page-title">{property.address}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <Badge tone={PUBLICATION_TONE[property.publicationStatus]}>
              {PUBLICATION_LABEL[property.publicationStatus]}
            </Badge>
            <Badge tone={AVAILABILITY_TONE[property.availabilityStatus]}>
              {AVAILABILITY_LABEL[property.availabilityStatus]}
            </Badge>
            {property.listingType && (
              <span className="badge badge-neutral">{LISTING_LABEL[property.listingType]}</span>
            )}
            <span className="subtle" style={{ fontSize: 13 }}>
              {property.city}
              {property.projectName ? ` · ${property.projectName}` : ''}
            </span>
          </div>
        </div>

        <div className="page-actions">
          {!archived && (
            <Button onClick={() => navigate(`/properties/${property.id}/edit`)}>Edit</Button>
          )}

          {archived ? (
            <Button variant="primary" onClick={() => setPending('restore')}>
              Restore
            </Button>
          ) : (
            <>
              {property.publicationStatus === 'PUBLISHED' ? (
                <Button variant="secondary" onClick={() => setPending('unpublish')}>
                  Unpublish
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setPending('publish')}>
                  Publish
                </Button>
              )}
              <Button variant="danger-ghost" onClick={() => setPending('archive')}>
                Archive
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="section-stack">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Overview</span>
            {!archived && (
              <div className="row">
                <span className="subtle" style={{ fontSize: 12.5 }}>
                  Availability
                </span>
                <Select
                  className="select"
                  style={{ width: 160 }}
                  value={property.availabilityStatus}
                  disabled={availabilityBusy}
                  onChange={(event) => void changeAvailability(event.target.value as AvailabilityStatus)}
                  aria-label="Change availability"
                >
                  {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => {
                    const disabled =
                      (value === 'SOLD' && !isSale) || (value === 'RENTED' && isSale);
                    return (
                      <option key={value} value={value} disabled={disabled}>
                        {label}
                      </option>
                    );
                  })}
                </Select>
              </div>
            )}
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <DetailItem label="Price" value={formatPriceFull(property.price)} />
              <DetailItem label="Configuration" value={property.rooms} />
              <DetailItem label="Property type" value={property.type} />
              <DetailItem label="Bathrooms" value={property.bathrooms} />
              <DetailItem label="Area (sq ft)" value={property.area} />
              <DetailItem label="Parking" value={property.parking === null ? null : property.parking ? 'Yes' : 'No'} />
              <DetailItem label="Facing" value={property.facing} />
              <DetailItem label="Available from" value={property.availableFrom} />
              <DetailItem label="PIN code" value={property.pinCode} />
            </div>

            {property.description && (
              <>
                <div className="divider" />
                <div className="detail-label" style={{ marginBottom: 6 }}>
                  Description
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, whiteSpace: 'pre-wrap' }}>
                  {property.description}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isSale ? 'Sale details' : 'Rental details'}
            </span>
          </div>
          <div className="card-body">
            {isSale ? (
              <div className="detail-grid">
                <DetailItem
                  label="Price negotiable"
                  value={
                    property.sale?.priceNegotiable === null || property.sale?.priceNegotiable === undefined
                      ? null
                      : property.sale.priceNegotiable
                        ? 'Yes'
                        : 'No'
                  }
                />
                <DetailItem label="Ownership type" value={property.sale?.ownershipType} />
              </div>
            ) : (
              <div className="detail-grid">
                <DetailItem
                  label="Deposit"
                  value={property.rent?.depositAmount != null ? formatPriceFull(property.rent.depositAmount) : null}
                />
                <DetailItem
                  label="Maintenance"
                  value={
                    property.rent?.maintenanceAmount != null
                      ? formatPriceFull(property.rent.maintenanceAmount)
                      : null
                  }
                />
                <DetailItem label="Furnishing" value={property.rent?.furnishing} />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Project and unit</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <DetailItem label="Project" value={property.projectName} />
              <DetailItem label="Unit identifier" value={property.unitIdentifier} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Record</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <DetailItem label="Property ID" value={property.id} />
              <DetailItem label="Created" value={formatDateTime(property.createdAt)} />
              <DetailItem label="Last updated" value={formatDateTime(property.updatedAt)} />
              <DetailItem label="Published" value={formatDateTime(property.publishedAt)} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending === 'publish'
            ? 'Publish this property?'
            : pending === 'unpublish'
              ? 'Unpublish this property?'
              : pending === 'archive'
                ? 'Archive this property?'
                : 'Restore this property?'
        }
        text={
          pending === 'publish'
            ? 'Publication requires a city, address, configuration and a price above zero. The listing becomes visible on the public site.'
            : pending === 'archive'
              ? 'The record, its subtype and its full history are retained and can be restored later.'
              : pending === 'restore'
                ? 'The property returns to the publication state it had before it was archived.'
                : 'The listing is removed from the public site but nothing is deleted.'
        }
        confirmLabel={
          pending === 'publish'
            ? 'Publish'
            : pending === 'unpublish'
              ? 'Unpublish'
              : pending === 'archive'
                ? 'Archive'
                : 'Restore'
        }
        tone={pending === 'archive' ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      >
        {pending === 'archive' && (
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
