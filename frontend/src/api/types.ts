export type ListingType = 'SALE' | 'RENT';
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type AvailabilityStatus = 'AVAILABLE' | 'ON_HOLD' | 'SOLD' | 'RENTED';
export type CrmModule = 'all' | 'lead' | 'property';
export type StaffRole = 'admin' | 'data_user';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  module: CrmModule;
  role: StaffRole;
}

export interface Property {
  id: string;
  listingType: ListingType | null;
  publicationStatus: PublicationStatus;
  availabilityStatus: AvailabilityStatus;
  unitIdentifier: string | null;
  projectId: string | null;
  projectName: string | null;
  type: string | null;
  city: string;
  address: string;
  pinCode: string | null;
  rooms: string;
  bathrooms: number | null;
  parking: boolean | null;
  area: number | null;
  price: number;
  facing: string | null;
  availableFrom: string | null;
  description: string | null;
  sale: { priceNegotiable: boolean | null; ownershipType: string | null } | null;
  rent: {
    depositAmount: number | null;
    maintenanceAmount: number | null;
    furnishing: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ProjectSummary {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  externalId: string | null;
  unitCount: number;
  availableCount: number;
}

export interface PropertyListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  listingType?: ListingType;
  publicationStatus?: PublicationStatus;
  availabilityStatus?: AvailabilityStatus;
  projectId?: string;
  sort?: string;
}

export interface PropertyPayload {
  listingType?: ListingType;
  city?: string;
  address?: string;
  rooms?: string;
  price?: number | string;
  type?: string | null;
  pinCode?: string | null;
  bathrooms?: number | string | null;
  parking?: boolean | null;
  area?: number | string | null;
  facing?: string | null;
  availableFrom?: string | null;
  description?: string | null;
  unitIdentifier?: string | null;
  projectId?: number | null;
  priceNegotiable?: boolean | null;
  ownershipType?: string | null;
  depositAmount?: number | string | null;
  maintenanceAmount?: number | string | null;
  furnishing?: string | null;
  expectedUpdatedAt?: string;
}
