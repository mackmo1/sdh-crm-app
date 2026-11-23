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

/* ------------------------------------------------------------------ CRM */

export type ContactCategory = 'BUYER' | 'SELLER' | 'LANDLORD' | 'TENANT' | 'BUILDER';
export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'SITE_VISIT'
  | 'NEGOTIATION'
  | 'ON_HOLD'
  | 'WON'
  | 'LOST';
export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RequirementIntent = 'BUY' | 'SELL' | 'RENT';
export type InteractionType = 'CALL' | 'MEETING' | 'MESSAGE' | 'EMAIL' | 'NOTE';
export type TaskStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';
export type SiteVisitStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type ClosureOutcome = 'SALE' | 'RENT' | 'LOST';

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: ContactCategory;
  company: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  leadCount?: number;
}

export interface ContactDetail extends Contact {
  leads: {
    id: string;
    name: string | null;
    phone: string;
    stage: LeadStage;
    priority: LeadPriority;
    createdAt: string;
  }[];
  interactions: Interaction[];
  tasks: { id: string; title: string; dueAt: string; status: TaskStatus }[];
}

export interface LeadSummary {
  id: string;
  name: string | null;
  phone: string;
  email: string;
  location: string;
  stage: LeadStage;
  priority: LeadPriority;
  source: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  openTaskCount: number;
  requirementCount: number;
  nextTaskDueAt: string | null;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Requirement {
  id: string;
  intent: RequirementIntent;
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string | null;
  propertyType: string | null;
  bedrooms: string | null;
  timeframe: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  shortlist: string[];
}

export interface Interaction {
  id: string;
  type: InteractionType;
  occurredAt: string;
  summary: string;
  outcome: string | null;
  nextAction: string | null;
  createdByName?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  leadId: string | null;
  contactId: string | null;
  assignedTo: string | null;
  assignedToName?: string | null;
  dueAt: string;
  status: TaskStatus;
  completedAt: string | null;
  completionNotes: string | null;
  nextAction: string | null;
  createdAt: string;
  overdue?: boolean;
  lead?: { id: string; name: string | null; phone: string; stage: LeadStage } | null;
}

export interface SiteVisit {
  id: string;
  leadId: string;
  propertyId: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  scheduledAt: string;
  status: SiteVisitStatus;
  feedback: string | null;
  nextSteps: string | null;
  rescheduledFrom: string | null;
  rescheduleCount: number;
  completedAt: string | null;
  createdAt: string;
  lead?: { id: string; name: string | null; phone: string; stage: LeadStage };
  property?: { id: string; address: string; city: string };
}

export interface LeadDetail extends LeadSummary {
  address: string | null;
  message: string | null;
  propertyType: string | null;
  bedrooms: string | null;
  budget: string | null;
  onHoldReason: string | null;
  contactId: string | null;
  contactName: string | null;
  closedAt: string | null;
  closureOutcome: ClosureOutcome | null;
  lossReason: string | null;
  reopenCount: number;
  selectedProperty: { id: string; address: string; city: string } | null;
  requirements: Requirement[];
  interactions: Interaction[];
  tasks: { id: string; title: string; dueAt: string; status: TaskStatus; assignedTo: string | null; overdue: boolean }[];
  siteVisits: {
    id: string;
    propertyId: string;
    scheduledAt: string;
    status: SiteVisitStatus;
    feedback: string | null;
    nextSteps: string | null;
  }[];
  stageHistory: {
    id: string;
    fromStage: LeadStage | null;
    toStage: LeadStage;
    reason: string | null;
    changedAt: string;
    changedBy: string | null;
  }[];
  assignments: {
    id: string;
    assignedTo: string;
    assignedToName: string | null;
    assignedAt: string;
    endedAt: string | null;
  }[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  module: CrmModule;
  active: boolean;
  createdAt: string;
  openSessions?: number;
}

export interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
  module: CrmModule;
}

export interface StaffPerformance {
  staffId: string;
  name: string;
  role: StaffRole;
  module: CrmModule;
  assignedLeads: number;
  activeLeads: number;
  won: number;
  lost: number;
  completedTasks: number;
  completedVisits: number;
}

export interface DashboardData {
  totals: {
    totalLeads: number;
    activeLeads: number;
    newLeads: number;
    unassignedLeads: number;
    wonLeads: number;
    lostLeads: number;
    publishedProperties: number;
  };
  pipeline: { stage: LeadStage; count: number }[];
  followUps: { dueToday: number; overdue: number };
  siteVisits: { upcoming: number };
  conversion: {
    closed: number;
    won: number;
    lost: number;
    winRate: number;
    conversionRate: number;
  };
  staffPerformance: StaffPerformance[];
}

export interface MatchResult {
  id: string;
  address: string;
  city: string;
  rooms: string;
  type: string | null;
  price: number;
  listingType: ListingType | null;
  availabilityStatus: AvailabilityStatus;
  shortlisted: boolean;
}
