export type InventoryCoreSqliteOptions = {
  tablePrefix?: string;
};

export function buildInventoryCoreSqliteMigrationSql(options: InventoryCoreSqliteOptions = {}): string[] {
  const tablePrefix = normalizePrefix(options.tablePrefix ?? "inventory_core_");
  return [
    `CREATE TABLE IF NOT EXISTS ${tablePrefix}primary_records (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT NOT NULL, counterparty_id TEXT NOT NULL, company_id TEXT NOT NULL, branch_id TEXT NOT NULL, record_state TEXT NOT NULL, approval_state TEXT NOT NULL, posting_state TEXT NOT NULL, fulfillment_state TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency_code TEXT NOT NULL, revision_no INTEGER NOT NULL, reason_code TEXT NULL, effective_at TEXT NOT NULL, correlation_id TEXT NOT NULL, process_id TEXT NOT NULL, upstream_refs TEXT NOT NULL, downstream_refs TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS ${tablePrefix}secondary_records (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, primary_record_id TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, requested_action TEXT NOT NULL, reason_code TEXT NULL, correlation_id TEXT NOT NULL, process_id TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE TABLE IF NOT EXISTS ${tablePrefix}exception_records (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, primary_record_id TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, reason_code TEXT NOT NULL, upstream_ref TEXT NULL, downstream_ref TEXT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ${getInventoryCoreSqliteLookupIndexName(tablePrefix)} ON ${tablePrefix}primary_records (tenant_id, title, correlation_id);`,
    `CREATE INDEX IF NOT EXISTS ${getInventoryCoreSqliteStatusIndexName(tablePrefix)} ON ${tablePrefix}exception_records (tenant_id, status, severity);`
  ];
}

export function buildInventoryCoreSqliteRollbackSql(options: InventoryCoreSqliteOptions = {}): string[] {
  const tablePrefix = normalizePrefix(options.tablePrefix ?? "inventory_core_");
  return [
    `DROP TABLE IF EXISTS ${tablePrefix}exception_records;`,
    `DROP TABLE IF EXISTS ${tablePrefix}secondary_records;`,
    `DROP TABLE IF EXISTS ${tablePrefix}primary_records;`
  ];
}

export function getInventoryCoreSqliteLookupIndexName(tablePrefix = "inventory_core_"): string {
  return `${normalizePrefix(tablePrefix)}primary_lookup_idx`;
}

export function getInventoryCoreSqliteStatusIndexName(tablePrefix = "inventory_core_"): string {
  return `${normalizePrefix(tablePrefix)}exception_status_idx`;
}

function normalizePrefix(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(value)) {
    throw new Error("tablePrefix must use simple alphanumeric or underscore SQL identifiers");
  }
  return value.toLowerCase();
}
