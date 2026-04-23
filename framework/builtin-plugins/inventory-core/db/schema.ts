import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const primaryRecordsTable = pgTable("inventory_core_primary_records", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  title: text("title").notNull(),
  counterpartyId: text("counterparty_id").notNull(),
  companyId: text("company_id").notNull(),
  branchId: text("branch_id").notNull(),
  recordState: text("record_state").notNull(),
  approvalState: text("approval_state").notNull(),
  postingState: text("posting_state").notNull(),
  fulfillmentState: text("fulfillment_state").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currencyCode: text("currency_code").notNull(),
  revisionNo: integer("revision_no").notNull(),
  reasonCode: text("reason_code"),
  effectiveAt: timestamp("effective_at").notNull(),
  correlationId: text("correlation_id").notNull(),
  processId: text("process_id").notNull(),
  upstreamRefs: text("upstream_refs").notNull(),
  downstreamRefs: text("downstream_refs").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const secondaryRecordsTable = pgTable("inventory_core_secondary_records", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  primaryRecordId: text("primary_record_id").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  requestedAction: text("requested_action").notNull(),
  reasonCode: text("reason_code"),
  correlationId: text("correlation_id").notNull(),
  processId: text("process_id").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const exceptionRecordsTable = pgTable("inventory_core_exception_records", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  primaryRecordId: text("primary_record_id").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  reasonCode: text("reason_code").notNull(),
  upstreamRef: text("upstream_ref"),
  downstreamRef: text("downstream_ref"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
