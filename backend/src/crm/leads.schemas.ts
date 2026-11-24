import { z } from 'zod';
import {
  optionalDateTime,
  optionalId,
  optionalMoney,
  optionalText,
  pageSchema,
} from './crm.helpers.js';

export const leadStageSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT',
  'NEGOTIATION',
  'ON_HOLD',
  'WON',
  'LOST',
]);

export const leadPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

/** Stages a lead may be moved to manually. Closing uses the close endpoint. */
export const ACTIVE_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'ON_HOLD'] as const;

export const leadCreateSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(160),
  phone: z.string().trim().min(5, 'Phone number is required').max(20),
  email: z.string().trim().email('Enter a valid email address').max(200),
  location: z.string().trim().min(1, 'Location is required').max(200),
  contactId: optionalId(),
  source: optionalText(80),
  priority: leadPrioritySchema.default('MEDIUM'),
  assignedTo: optionalText(64),
  message: optionalText(4000),
  propertyType: optionalText(80),
  bedrooms: optionalText(40),
  budget: optionalText(60),
  who: z.enum(['buyer', 'seller', 'landlord', 'tenant', 'builder']).default('buyer'),
  intent: z.enum(['buy', 'rent', 'sell']).default('buy'),
});

export const leadUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().min(5).max(20).optional(),
  email: z.string().trim().email().max(200).optional(),
  location: z.string().trim().min(1).max(200).optional(),
  contactId: optionalId(),
  source: optionalText(80),
  priority: leadPrioritySchema.optional(),
  message: optionalText(4000),
  propertyType: optionalText(80),
  bedrooms: optionalText(40),
  budget: optionalText(60),
});

export const leadListQuerySchema = z.object({
  ...pageSchema,
  search: z.string().trim().max(200).optional(),
  stage: leadStageSchema.optional(),
  priority: leadPrioritySchema.optional(),
  assignedTo: z.string().trim().max(64).optional(),
  assignment: z.enum(['assigned', 'unassigned']).optional(),
  source: z.string().trim().max(80).optional(),
  city: z.string().trim().max(120).optional(),
  from: z.string().trim().max(30).optional(),
  to: z.string().trim().max(30).optional(),
  sort: z.enum(['createdAt:desc', 'createdAt:asc', 'updatedAt:desc']).default('createdAt:desc'),
});

export const assignLeadSchema = z.object({
  assignedTo: z.string().trim().min(1, 'Choose a staff member').max(64),
});

export const changeStageSchema = z.object({
  stage: z.enum(ACTIVE_STAGES),
  reason: optionalText(400),
  onHoldReason: optionalText(400),
});

export const closeLeadSchema = z.object({
  outcome: z.enum(['SALE', 'RENT', 'LOST']),
  lossReason: optionalText(400),
  selectedPropertyId: optionalId(),
});

export const reopenLeadSchema = z.object({
  reason: z.string().trim().min(3, 'A reason is required to reopen a lead').max(400),
});

export const requirementCreateSchema = z.object({
  intent: z.enum(['BUY', 'SELL', 'RENT']),
  budgetMin: optionalMoney(),
  budgetMax: optionalMoney(),
  locations: optionalText(300),
  propertyType: optionalText(80),
  bedrooms: optionalText(40),
  timeframe: optionalText(80),
  notes: optionalText(1000),
});

export const requirementUpdateSchema = requirementCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

export const shortlistSchema = z.object({
  propertyId: z.coerce.number().int().min(1),
});

export const interactionCreateSchema = z.object({
  type: z.enum(['CALL', 'MEETING', 'MESSAGE', 'EMAIL', 'NOTE']),
  occurredAt: optionalDateTime(),
  summary: z.string().trim().min(1, 'Describe what happened').max(2000),
  outcome: optionalText(500),
  nextAction: optionalText(500),
  contactId: optionalId(),
});

export const matchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
