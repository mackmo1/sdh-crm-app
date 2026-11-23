import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ListingType, PropertyPayload, ProjectSummary } from '../api/types';
import { useToast } from '../components/Toast';
import {
  Button,
  Field,
  LoadingBlock,
  Select,
  TextArea,
  TextInput,
} from '../components/ui';
import { LISTING_LABEL } from '../lib/status';

interface FormValues {
  listingType: ListingType;
  city: string;
  address: string;
  pinCode: string;
  type: string;
  rooms: string;
  bathrooms: string;
  parking: boolean;
  area: string;
  facing: string;
  availableFrom: string;
  description: string;
  price: string;
  priceNegotiable: boolean;
  ownershipType: string;
  depositAmount: string;
  maintenanceAmount: string;
  furnishing: string;
  projectId: string;
  unitIdentifier: string;
}

const EMPTY: FormValues = {
  listingType: 'SALE',
  city: '',
  address: '',
  pinCode: '',
  type: '',
  rooms: '',
  bathrooms: '',
  parking: false,
  area: '',
  facing: '',
  availableFrom: '',
  description: '',
  price: '',
  priceNegotiable: false,
  ownershipType: '',
  depositAmount: '',
  maintenanceAmount: '',
  furnishing: '',
  projectId: '',
  unitIdentifier: '',
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PropertyFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | undefined>(undefined);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

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
    if (mode !== 'edit' || !id) return;
    let cancelled = false;

    setLoading(true);
    api.properties
      .get(id)
      .then((property) => {
        if (cancelled) return;
        setValues({
          listingType: property.listingType ?? 'SALE',
          city: property.city,
          address: property.address,
          pinCode: property.pinCode ?? '',
          type: property.type ?? '',
          rooms: property.rooms,
          bathrooms: property.bathrooms === null ? '' : String(property.bathrooms),
          parking: property.parking ?? false,
          area: property.area === null ? '' : String(property.area),
          facing: property.facing ?? '',
          availableFrom: property.availableFrom ?? '',
          description: property.description ?? '',
          price: String(property.price),
          priceNegotiable: property.sale?.priceNegotiable ?? false,
          ownershipType: property.sale?.ownershipType ?? '',
          depositAmount:
            property.rent?.depositAmount === null || property.rent?.depositAmount === undefined
              ? ''
              : String(property.rent.depositAmount),
          maintenanceAmount:
            property.rent?.maintenanceAmount === null || property.rent?.maintenanceAmount === undefined
              ? ''
              : String(property.rent.maintenanceAmount),
          furnishing: property.rent?.furnishing ?? '',
          projectId: property.projectId ?? '',
          unitIdentifier: property.unitIdentifier ?? '',
        });
        setExpectedUpdatedAt(property.updatedAt);
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(caught instanceof ApiError ? caught.message : 'Unable to load this property.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, id]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!values.city.trim()) errors.city = 'City is required.';
    if (!values.address.trim()) errors.address = 'Address is required.';
    if (!values.rooms.trim()) errors.rooms = 'Configuration is required.';

    const price = Number(values.price);
    if (!values.price.trim()) errors.price = 'Price is required.';
    else if (!Number.isFinite(price) || price < 0) errors.price = 'Enter a valid price.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function buildPayload(): PropertyPayload {
    const payload: PropertyPayload = {
      city: values.city.trim(),
      address: values.address.trim(),
      rooms: values.rooms.trim(),
      price: Number(values.price),
      type: values.type.trim() || null,
      pinCode: values.pinCode.trim() || null,
      bathrooms: toNumberOrNull(values.bathrooms),
      parking: values.parking,
      area: toNumberOrNull(values.area),
      facing: values.facing.trim() || null,
      availableFrom: values.availableFrom || null,
      description: values.description.trim() || null,
      unitIdentifier: values.unitIdentifier.trim() || null,
      projectId: values.projectId ? Number(values.projectId) : null,
    };

    if (mode === 'create') {
      payload.listingType = values.listingType;
    } else if (expectedUpdatedAt) {
      payload.expectedUpdatedAt = expectedUpdatedAt;
    }

    if (values.listingType === 'SALE') {
      payload.priceNegotiable = values.priceNegotiable;
      payload.ownershipType = values.ownershipType.trim() || null;
    } else {
      payload.depositAmount = toNumberOrNull(values.depositAmount);
      payload.maintenanceAmount = toNumberOrNull(values.maintenanceAmount);
      payload.furnishing = values.furnishing.trim() || null;
    }

    return payload;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const saved =
        mode === 'create'
          ? await api.properties.create(payload)
          : await api.properties.update(id as string, payload);

      notify(mode === 'create' ? 'Draft saved' : 'Property updated');
      navigate(`/properties/${saved.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const errors: Record<string, string> = {};
        for (const issue of caught.issues) errors[issue.path] = issue.message;
        setFieldErrors((previous) => ({ ...previous, ...errors }));
        setFormError(caught.message);
      } else {
        setFormError('Unable to save this property.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock />;

  if (loadError) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-title">Property unavailable</div>
          <p className="empty-text">{loadError}</p>
          <Button variant="secondary" onClick={() => navigate('/properties')}>
            Back to properties
          </Button>
        </div>
      </div>
    );
  }

  const isSale = values.listingType === 'SALE';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="page-header">
        <div>
          <h1 className="page-title">{mode === 'create' ? 'Add property' : 'Edit property'}</h1>
          <p className="page-subtitle">
            {mode === 'create'
              ? 'New listings start as drafts. Only the basics are needed now — the rest can be completed later.'
              : 'Changes to a published listing take effect immediately.'}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Save draft' : 'Save changes'}
          </Button>
        </div>
      </div>

      {formError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {formError}
        </div>
      )}

      <div className="section-stack">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Listing type</span>
          </div>
          <div className="card-body">
            {mode === 'create' ? (
              <>
                <div className="segmented" role="group" aria-label="Listing type">
                  {(['SALE', 'RENT'] as ListingType[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={values.listingType === option ? 'selected' : ''}
                      onClick={() => set('listingType', option)}
                    >
                      {LISTING_LABEL[option]}
                    </button>
                  ))}
                </div>
                <p className="field-hint" style={{ marginTop: 10 }}>
                  The listing type is fixed once the property is created.
                </p>
              </>
            ) : (
              <p style={{ margin: 0 }}>
                <strong>{LISTING_LABEL[values.listingType]}</strong>
                <span className="subtle"> — fixed for the lifetime of this property.</span>
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Basics</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <Field label="City *" htmlFor="city" error={fieldErrors.city}>
                <TextInput
                  id="city"
                  value={values.city}
                  invalid={Boolean(fieldErrors.city)}
                  onChange={(event) => set('city', event.target.value)}
                  placeholder="Mumbai"
                />
              </Field>

              <Field label="PIN code" htmlFor="pinCode" error={fieldErrors.pinCode}>
                <TextInput
                  id="pinCode"
                  value={values.pinCode}
                  onChange={(event) => set('pinCode', event.target.value)}
                  placeholder="400058"
                />
              </Field>

              <Field
                label="Address *"
                htmlFor="address"
                error={fieldErrors.address}
                className="span-2"
              >
                <TextInput
                  id="address"
                  value={values.address}
                  invalid={Boolean(fieldErrors.address)}
                  onChange={(event) => set('address', event.target.value)}
                  placeholder="Flat 1203, Sunrise Residency, Andheri West"
                />
              </Field>

              <Field label="Configuration *" htmlFor="rooms" error={fieldErrors.rooms}>
                <TextInput
                  id="rooms"
                  value={values.rooms}
                  invalid={Boolean(fieldErrors.rooms)}
                  onChange={(event) => set('rooms', event.target.value)}
                  placeholder="2BHK"
                />
              </Field>

              <Field label="Property type" htmlFor="type" error={fieldErrors.type}>
                <TextInput
                  id="type"
                  value={values.type}
                  onChange={(event) => set('type', event.target.value)}
                  placeholder="Apartment"
                />
              </Field>

              <Field label="Bathrooms" htmlFor="bathrooms" error={fieldErrors.bathrooms}>
                <TextInput
                  id="bathrooms"
                  type="number"
                  min={0}
                  value={values.bathrooms}
                  onChange={(event) => set('bathrooms', event.target.value)}
                  placeholder="2"
                />
              </Field>

              <Field label="Area (sq ft)" htmlFor="area" error={fieldErrors.area}>
                <TextInput
                  id="area"
                  type="number"
                  min={0}
                  value={values.area}
                  onChange={(event) => set('area', event.target.value)}
                  placeholder="1050"
                />
              </Field>

              <Field label="Facing" htmlFor="facing" error={fieldErrors.facing}>
                <TextInput
                  id="facing"
                  value={values.facing}
                  onChange={(event) => set('facing', event.target.value)}
                  placeholder="East"
                />
              </Field>

              <Field label="Available from" htmlFor="availableFrom" error={fieldErrors.availableFrom}>
                <TextInput
                  id="availableFrom"
                  type="date"
                  value={values.availableFrom}
                  onChange={(event) => set('availableFrom', event.target.value)}
                />
              </Field>

              <div className="checkbox-row">
                <input
                  id="parking"
                  type="checkbox"
                  checked={values.parking}
                  onChange={(event) => set('parking', event.target.checked)}
                />
                <label htmlFor="parking">Parking available</label>
              </div>

              <Field
                label="Description"
                htmlFor="description"
                error={fieldErrors.description}
                className="span-2"
              >
                <TextArea
                  id="description"
                  value={values.description}
                  onChange={(event) => set('description', event.target.value)}
                  placeholder="Anything a buyer or tenant should know about this property."
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{isSale ? 'Sale pricing' : 'Rental pricing'}</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <Field
                label={isSale ? 'Asking price (₹) *' : 'Monthly rent (₹) *'}
                htmlFor="price"
                error={fieldErrors.price}
              >
                <TextInput
                  id="price"
                  type="number"
                  min={0}
                  value={values.price}
                  invalid={Boolean(fieldErrors.price)}
                  onChange={(event) => set('price', event.target.value)}
                  placeholder={isSale ? '25000000' : '45000'}
                />
              </Field>

              {isSale ? (
                <>
                  <div className="checkbox-row">
                    <input
                      id="priceNegotiable"
                      type="checkbox"
                      checked={values.priceNegotiable}
                      onChange={(event) => set('priceNegotiable', event.target.checked)}
                    />
                    <label htmlFor="priceNegotiable">Price is negotiable</label>
                  </div>

                  <Field label="Ownership type" htmlFor="ownershipType" error={fieldErrors.ownershipType}>
                    <TextInput
                      id="ownershipType"
                      value={values.ownershipType}
                      onChange={(event) => set('ownershipType', event.target.value)}
                      placeholder="Freehold"
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Deposit (₹)" htmlFor="depositAmount" error={fieldErrors.depositAmount}>
                    <TextInput
                      id="depositAmount"
                      type="number"
                      min={0}
                      value={values.depositAmount}
                      onChange={(event) => set('depositAmount', event.target.value)}
                      placeholder="90000"
                    />
                  </Field>

                  <Field
                    label="Maintenance (₹)"
                    htmlFor="maintenanceAmount"
                    error={fieldErrors.maintenanceAmount}
                  >
                    <TextInput
                      id="maintenanceAmount"
                      type="number"
                      min={0}
                      value={values.maintenanceAmount}
                      onChange={(event) => set('maintenanceAmount', event.target.value)}
                      placeholder="3500"
                    />
                  </Field>

                  <Field label="Furnishing" htmlFor="furnishing" error={fieldErrors.furnishing}>
                    <Select
                      id="furnishing"
                      value={values.furnishing}
                      onChange={(event) => set('furnishing', event.target.value)}
                    >
                      <option value="">Not specified</option>
                      <option value="Unfurnished">Unfurnished</option>
                      <option value="Semi-furnished">Semi-furnished</option>
                      <option value="Furnished">Furnished</option>
                    </Select>
                  </Field>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Project and unit</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <Field
                label="Project"
                htmlFor="projectId"
                error={fieldErrors.projectId}
                hint="Link this listing to an existing developer project."
              >
                <Select
                  id="projectId"
                  value={values.projectId}
                  onChange={(event) => set('projectId', event.target.value)}
                >
                  <option value="">Not part of a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name ?? `Project ${project.id}`}
                      {project.city ? ` — ${project.city}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Unit identifier"
                htmlFor="unitIdentifier"
                error={fieldErrors.unitIdentifier}
                hint="For example A-1203. Must be unique within the project."
              >
                <TextInput
                  id="unitIdentifier"
                  value={values.unitIdentifier}
                  onChange={(event) => set('unitIdentifier', event.target.value)}
                  placeholder="A-1203"
                  disabled={!values.projectId}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Save draft' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
