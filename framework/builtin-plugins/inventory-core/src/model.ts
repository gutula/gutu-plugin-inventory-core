import { z } from "zod";

export const recordStateSchema = z.enum(["draft", "active", "canceled", "archived"]);
export const approvalStateSchema = z.enum(["not-required", "pending", "approved", "rejected"]);
export const postingStateSchema = z.enum(["unposted", "posted", "reversed"]);
export const fulfillmentStateSchema = z.enum(["none", "partial", "complete", "closed"]);

export const primaryRecordSchema = z.object({
  id: z.string().min(2),
  tenantId: z.string().min(2),
  title: z.string().min(2),
  counterpartyId: z.string().min(2),
  companyId: z.string().min(2),
  branchId: z.string().min(2),
  recordState: recordStateSchema,
  approvalState: approvalStateSchema,
  postingState: postingStateSchema,
  fulfillmentState: fulfillmentStateSchema,
  amountMinor: z.number().int(),
  currencyCode: z.string().min(3),
  revisionNo: z.number().int().nonnegative(),
  reasonCode: z.string().nullable(),
  effectiveAt: z.string(),
  correlationId: z.string().min(2),
  processId: z.string().min(2),
  upstreamRefs: z.array(z.string().min(2)),
  downstreamRefs: z.array(z.string().min(2)),
  updatedAt: z.string()
});

export const secondaryRecordSchema = z.object({
  id: z.string().min(2),
  tenantId: z.string().min(2),
  primaryRecordId: z.string().min(2),
  label: z.string().min(2),
  status: z.enum(["requested", "approved", "in-progress", "completed", "failed", "closed"]),
  requestedAction: z.string().min(2),
  reasonCode: z.string().nullable(),
  correlationId: z.string().min(2),
  processId: z.string().min(2),
  updatedAt: z.string()
});

export const exceptionRecordSchema = z.object({
  id: z.string().min(2),
  tenantId: z.string().min(2),
  primaryRecordId: z.string().min(2),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "under-review", "resolved", "closed"]),
  reasonCode: z.string().min(2),
  upstreamRef: z.string().nullable(),
  downstreamRef: z.string().nullable(),
  updatedAt: z.string()
});

export const createPrimaryRecordInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  title: z.string().min(2),
  counterpartyId: z.string().min(2),
  companyId: z.string().min(2),
  branchId: z.string().min(2),
  amountMinor: z.number().int(),
  currencyCode: z.string().min(3),
  effectiveAt: z.string().min(2),
  correlationId: z.string().min(2),
  processId: z.string().min(2),
  upstreamRefs: z.array(z.string().min(2)).optional(),
  reasonCode: z.string().min(2).optional()
});

export const advancePrimaryRecordInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  expectedRevisionNo: z.number().int().positive().optional(),
  recordState: recordStateSchema.optional(),
  approvalState: approvalStateSchema.optional(),
  postingState: postingStateSchema.optional(),
  fulfillmentState: fulfillmentStateSchema.optional(),
  downstreamRef: z.string().min(2).optional(),
  reasonCode: z.string().min(2).optional()
});

export const placePrimaryRecordOnHoldInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  expectedRevisionNo: z.number().int().positive().optional(),
  reasonCode: z.string().min(2)
});

export const releasePrimaryRecordHoldInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  expectedRevisionNo: z.number().int().positive().optional(),
  reasonCode: z.string().min(2).optional()
});

export const amendPrimaryRecordInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  amendedRecordId: z.string().min(2),
  expectedRevisionNo: z.number().int().positive().optional(),
  title: z.string().min(2).optional(),
  amountMinor: z.number().int().optional(),
  effectiveAt: z.string().min(2).optional(),
  reasonCode: z.string().min(2)
});

export const reversePrimaryRecordInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  reversalRecordId: z.string().min(2),
  expectedRevisionNo: z.number().int().positive().optional(),
  reasonCode: z.string().min(2)
});

export const reconcilePrimaryRecordInputSchema = z.object({
  tenantId: z.string().min(2),
  actorId: z.string().min(2),
  recordId: z.string().min(2),
  exceptionId: z.string().min(2),
  expectedRevisionNo: z.number().int().positive().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  reasonCode: z.string().min(2),
  upstreamRef: z.string().min(2).optional(),
  downstreamRef: z.string().min(2).optional()
});

export type PrimaryRecord = z.infer<typeof primaryRecordSchema>;
export type SecondaryRecord = z.infer<typeof secondaryRecordSchema>;
export type ExceptionRecord = z.infer<typeof exceptionRecordSchema>;
