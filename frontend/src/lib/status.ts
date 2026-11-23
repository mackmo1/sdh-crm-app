import type { AvailabilityStatus, PublicationStatus } from '../api/types';

export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'primary';

export const PUBLICATION_TONE: Record<PublicationStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  UNPUBLISHED: 'warn',
  ARCHIVED: 'danger',
};

export const AVAILABILITY_TONE: Record<AvailabilityStatus, BadgeTone> = {
  AVAILABLE: 'success',
  ON_HOLD: 'warn',
  SOLD: 'primary',
  RENTED: 'primary',
};

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  UNPUBLISHED: 'Unpublished',
  ARCHIVED: 'Archived',
};

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Available',
  ON_HOLD: 'On hold',
  SOLD: 'Sold',
  RENTED: 'Rented',
};

export const LISTING_LABEL = {
  SALE: 'Sale',
  RENT: 'Rent',
} as const;
