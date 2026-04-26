/** Plugin-owned migrations for inventory-core.
 *
 *  Idempotent CREATE TABLE / CREATE INDEX statements. Re-running this
 *  on an existing database is a no-op. */
import { db } from "@gutu-host";

export function migrate(): void {
  db.exec(`
-- Stock reservations: a soft lock on quantity at a specific (item,
    -- warehouse) for a downstream consumer (e.g. a sales invoice). The
    -- bin's reserved_qty column reflects the sum of active reservations;
    -- fulfilment converts a reservation into an actual issue.
    CREATE TABLE IF NOT EXISTS stock_reservations (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      item_id         TEXT NOT NULL,
      warehouse_id    TEXT NOT NULL,
      quantity        REAL NOT NULL,
      consumer_resource TEXT NOT NULL,        -- e.g. 'accounting.invoice' or 'sales.order'
      consumer_id     TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'fulfilled' | 'cancelled'
      memo            TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES stock_items(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );
    CREATE INDEX IF NOT EXISTS stock_reservations_consumer_idx
      ON stock_reservations(tenant_id, consumer_resource, consumer_id);
    CREATE INDEX IF NOT EXISTS stock_reservations_active_idx
      ON stock_reservations(tenant_id, item_id, warehouse_id)
      WHERE status = 'active';

    -- Pick / Pack / Ship: a fulfillment workflow that translates a
    -- reservation (or a list of reservations) into a deterministic
    -- pipeline. A pick list groups reservations by warehouse for the
    -- picker; a pack ticket bundles picked items into a shipment;
    -- shipping turns the pack into an outbound stock issue.
    CREATE TABLE IF NOT EXISTS pick_lists (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      warehouse_id  TEXT NOT NULL,
      number        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'open',   -- 'open'|'picking'|'picked'|'cancelled'
      assignee      TEXT,
      memo          TEXT,
      created_by    TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      UNIQUE (tenant_id, number)
    );

    CREATE TABLE IF NOT EXISTS pick_list_items (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      pick_list_id    TEXT NOT NULL,
      reservation_id  TEXT,
      item_id         TEXT NOT NULL,
      warehouse_id    TEXT NOT NULL,
      quantity        REAL NOT NULL,
      picked_qty      REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'open',  -- 'open'|'picked'|'partial'|'cancelled'
      created_at      TEXT NOT NULL,
      FOREIGN KEY (pick_list_id) REFERENCES pick_lists(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS pick_list_items_pl_idx
      ON pick_list_items(pick_list_id);

    CREATE TABLE IF NOT EXISTS shipments (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      number        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'packed',  -- 'packed'|'shipped'|'delivered'|'cancelled'
      pick_list_id  TEXT,
      consumer_resource TEXT,
      consumer_id   TEXT,
      tracking_no   TEXT,
      carrier       TEXT,
      shipped_at    TEXT,
      delivered_at  TEXT,
      memo          TEXT,
      created_by    TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      UNIQUE (tenant_id, number)
    );
    CREATE INDEX IF NOT EXISTS shipments_consumer_idx
      ON shipments(tenant_id, consumer_resource, consumer_id);

    CREATE TABLE IF NOT EXISTS shipment_lines (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      shipment_id     TEXT NOT NULL,
      item_id         TEXT NOT NULL,
      warehouse_id    TEXT NOT NULL,
      quantity        REAL NOT NULL,
      sle_id          TEXT,                          -- ref to issued stock-ledger entry
      created_at      TEXT NOT NULL,
      FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS shipment_lines_sh_idx ON shipment_lines(shipment_id);

    -- HRMS: employees + departments + attendance + leave + payroll runs.
    -- All amounts in minor currency units. Payroll posts to GL via the
    -- shared journal primitive. Leave accrues monthly per leave type.
    CREATE TABLE IF NOT EXISTS hr_employees (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      employee_no   TEXT NOT NULL,
      first_name    TEXT NOT NULL,
      last_name     TEXT NOT NULL,
      email         TEXT,
      department    TEXT,
      designation   TEXT,
      hire_date     TEXT NOT NULL,
      termination_date TEXT,
      status        TEXT NOT NULL DEFAULT 'active',  -- 'active'|'on-leave'|'terminated'
      base_salary_minor INTEGER NOT NULL DEFAULT 0,
      currency      TEXT NOT NULL DEFAULT 'USD',
      bank_account  TEXT,
      created_by    TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      UNIQUE (tenant_id, employee_no)
    );
    CREATE INDEX IF NOT EXISTS hr_employees_tenant_idx ON hr_employees(tenant_id);

    CREATE TABLE IF NOT EXISTS hr_attendance (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      date        TEXT NOT NULL,
      check_in    TEXT,
      check_out   TEXT,
      status      TEXT NOT NULL DEFAULT 'present',   -- 'present'|'absent'|'half-day'|'leave'|'holiday'|'work-from-home'
      hours       REAL NOT NULL DEFAULT 0,
      memo        TEXT,
      created_at  TEXT NOT NULL,
      UNIQUE (tenant_id, employee_id, date)
    );
    CREATE INDEX IF NOT EXISTS hr_attendance_emp_idx
      ON hr_attendance(tenant_id, employee_id, date);

    CREATE TABLE IF NOT EXISTS hr_leave_types (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      code          TEXT NOT NULL,
      name          TEXT NOT NULL,
      annual_days   REAL NOT NULL DEFAULT 0,
      paid          INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      UNIQUE (tenant_id, code)
    );

    CREATE TABLE IF NOT EXISTS hr_leave_entries (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      employee_id   TEXT NOT NULL,
      leave_type_id TEXT NOT NULL,
      kind          TEXT NOT NULL,                  -- 'accrual'|'consumption'|'adjustment'
      days          REAL NOT NULL,
      effective_date TEXT NOT NULL,
      memo          TEXT,
      created_by    TEXT,
      created_at    TEXT NOT NULL,
      FOREIGN KEY (leave_type_id) REFERENCES hr_leave_types(id)
    );
    CREATE INDEX IF NOT EXISTS hr_leave_entries_idx
      ON hr_leave_entries(tenant_id, employee_id, leave_type_id);

    CREATE TABLE IF NOT EXISTS hr_payroll_runs (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      number        TEXT NOT NULL,
      period_label  TEXT NOT NULL,                  -- e.g. "2026-04"
      from_date     TEXT NOT NULL,
      to_date       TEXT NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'USD',
      status        TEXT NOT NULL DEFAULT 'draft',  -- 'draft'|'computed'|'posted'|'cancelled'
      gl_journal_id TEXT,
      total_gross_minor INTEGER NOT NULL DEFAULT 0,
      total_tax_minor   INTEGER NOT NULL DEFAULT 0,
      total_net_minor   INTEGER NOT NULL DEFAULT 0,
      memo          TEXT,
      created_by    TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      UNIQUE (tenant_id, number)
    );
    CREATE INDEX IF NOT EXISTS hr_payroll_runs_period_idx
      ON hr_payroll_runs(tenant_id, period_label);

    CREATE TABLE IF NOT EXISTS hr_payroll_lines (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      run_id        TEXT NOT NULL,
      employee_id   TEXT NOT NULL,
      gross_minor   INTEGER NOT NULL DEFAULT 0,
      tax_minor     INTEGER NOT NULL DEFAULT 0,
      deductions_minor INTEGER NOT NULL DEFAULT 0,
      net_minor     INTEGER NOT NULL DEFAULT 0,
      currency      TEXT NOT NULL DEFAULT 'USD',
      details       TEXT,                            -- JSON: per-component breakdown
      created_at    TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
    );
    CREATE INDEX IF NOT EXISTS hr_payroll_lines_run_idx
      ON hr_payroll_lines(run_id);

    -- Currency exchange rates: tenant-scoped time-series. The active
    -- rate for a (from, to, date) is the latest row whose effective_date
    -- ≤ the requested date.
    CREATE TABLE IF NOT EXISTS fx_rates (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      from_currency   TEXT NOT NULL,
      to_currency     TEXT NOT NULL,
      effective_date  TEXT NOT NULL,
      rate            REAL NOT NULL,                  -- multiply from→to
      source          TEXT,
      created_at      TEXT NOT NULL,
      UNIQUE (tenant_id, from_currency, to_currency, effective_date)
    );
    CREATE INDEX IF NOT EXISTS fx_rates_lookup_idx
      ON fx_rates(tenant_id, from_currency, to_currency, effective_date DESC);

    -- Inter-company mappings: pairing of a "selling" company and a
    -- "buying" company so a sales invoice in one auto-mints the
    -- mirror purchase bill in the other.
    CREATE TABLE IF NOT EXISTS intercompany_mappings (
      id                  TEXT PRIMARY KEY,
      tenant_id           TEXT NOT NULL,
      seller_company_id   TEXT NOT NULL,
      buyer_company_id    TEXT NOT NULL,
      seller_party_id     TEXT NOT NULL,
      buyer_party_id      TEXT NOT NULL,
      receivable_account_id TEXT,
      payable_account_id    TEXT,
      enabled             INTEGER NOT NULL DEFAULT 1,
      created_by          TEXT NOT NULL,
      created_at          TEXT NOT NULL,
      UNIQUE (tenant_id, seller_company_id, buyer_company_id)
    );

    -- Regional pack registry: which regional packs are installed for
    -- a tenant. The pack is data + behaviour bundled — tax templates,
    -- naming series, print formats, statutory aggregation reports.
    CREATE TABLE IF NOT EXISTS regional_packs (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      code            TEXT NOT NULL,                 -- 'india-gst'|'eu-vat'|'us-sales-tax'|...
      version         TEXT NOT NULL,
      installed_at    TEXT NOT NULL,
      configuration   TEXT,                          -- JSON: pack-specific config (gstin, vat_no, …)
      enabled         INTEGER NOT NULL DEFAULT 1,
      UNIQUE (tenant_id, code)
    );

    -- Notification deliveries: append-only delivery log for visibility,
    -- replay, and rate-limiting. One row per channel per fired rule per
    -- record. Status transitions: pending → sent | failed | suppressed.
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      rule_id      TEXT NOT NULL,
      resource     TEXT NOT NULL,
      record_id    TEXT NOT NULL,
      channel      TEXT NOT NULL,
      status       TEXT NOT NULL,
      attempts     INTEGER NOT NULL DEFAULT 0,
      last_error   TEXT,
      response     TEXT,
      payload      TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notification_deliveries_rule_idx
      ON notification_deliveries(tenant_id, rule_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS notification_deliveries_record_idx
      ON notification_deliveries(tenant_id, resource, record_id);

    -- Roles + permission rules. Roles are tenant-scoped. Each role
    -- carries a JSON policy — an array of rules of the shape:
    --   { resource, verbs, scope, condition?, fieldMask? }
    -- with five composition layers: object-level, field-level,
    -- row-level (predicate), tenant-wide flag, and assignability.
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      flags       TEXT,                       -- JSON: { canUpdateAllSettings, canReadAllRecords, ... }
      policy      TEXT NOT NULL,              -- JSON: PolicyRule[]
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      UNIQUE (tenant_id, name)
    );
    CREATE INDEX IF NOT EXISTS roles_tenant_idx ON roles(tenant_id);

    -- User → Role assignments per tenant.
    CREATE TABLE IF NOT EXISTS user_roles (
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      role_id     TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, user_id, role_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);

    -- Polymorphic record-to-record links. Powers MORPH_RELATION
    -- (one note attaches to records of any type), favorites,
    -- pinned-records-in-sidebar, "Related records" panels, and the
    -- universal record-picker. Edges are typed via the kind column so the
    -- same row format also expresses ownership, parent/child, etc.
    CREATE TABLE IF NOT EXISTS record_links (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      from_resource TEXT NOT NULL,
      from_id      TEXT NOT NULL,
      to_resource  TEXT NOT NULL,
      to_id        TEXT NOT NULL,
      kind         TEXT NOT NULL DEFAULT 'related',
      payload      TEXT,
      created_by   TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS record_links_from_idx
      ON record_links(tenant_id, from_resource, from_id);
    CREATE INDEX IF NOT EXISTS record_links_to_idx
      ON record_links(tenant_id, to_resource, to_id);
    CREATE INDEX IF NOT EXISTS record_links_kind_idx
      ON record_links(tenant_id, kind);

    -- Durable ERP document transformations. This is the server-side
    -- counterpart to ERPNext-style "Make Sales Order", "Get Items
    -- From", and downstream document chains. Rows are idempotent by
    -- (tenant_id, idempotency_key), so retries never create duplicate
    -- target documents.
    CREATE TABLE IF NOT EXISTS erp_document_mappings (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      source_resource TEXT NOT NULL,
      source_id       TEXT NOT NULL,
      action_id       TEXT NOT NULL,
      relation        TEXT NOT NULL,
      target_resource TEXT NOT NULL,
      target_id       TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'created',
      idempotency_key TEXT NOT NULL,
      payload         TEXT,
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      UNIQUE (tenant_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS erp_document_mappings_source_idx
      ON erp_document_mappings(tenant_id, source_resource, source_id);
    CREATE INDEX IF NOT EXISTS erp_document_mappings_target_idx
      ON erp_document_mappings(tenant_id, target_resource, target_id);

    -- Immutable posting batches and entries for operator-triggered ERP
    -- side effects. These tables intentionally store the generated
    -- postings outside the source document JSON so financial and stock
    -- reports can audit exactly what was posted and when.
    CREATE TABLE IF NOT EXISTS erp_posting_batches (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      engine          TEXT NOT NULL,        -- accounting | stock | custom
      voucher_resource TEXT NOT NULL,
      voucher_id      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'posted',
      idempotency_key TEXT NOT NULL,
      payload         TEXT,
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      UNIQUE (tenant_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS erp_posting_batches_voucher_idx
      ON erp_posting_batches(tenant_id, voucher_resource, voucher_id);

    CREATE TABLE IF NOT EXISTS erp_posting_entries (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      batch_id      TEXT NOT NULL,
      engine        TEXT NOT NULL,
      account       TEXT,
      item          TEXT,
      warehouse     TEXT,
      debit         REAL NOT NULL DEFAULT 0,
      credit        REAL NOT NULL DEFAULT 0,
      quantity      REAL NOT NULL DEFAULT 0,
      valuation_rate REAL NOT NULL DEFAULT 0,
      amount        REAL NOT NULL DEFAULT 0,
      currency      TEXT,
      posting_date  TEXT NOT NULL,
      payload       TEXT,
      created_at    TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES erp_posting_batches(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS erp_posting_entries_batch_idx
      ON erp_posting_entries(batch_id);
    CREATE INDEX IF NOT EXISTS erp_posting_entries_account_idx
      ON erp_posting_entries(tenant_id, account, posting_date);
    CREATE INDEX IF NOT EXISTS erp_posting_entries_item_idx
      ON erp_posting_entries(tenant_id, item, warehouse, posting_date);

    -- Shareable ERP portal links. Tokens are never stored in plaintext:
    -- operators receive a one-time plaintext token, while the DB keeps a
    -- SHA-256 hash plus expiry/revocation metadata. Public reads go through
    -- this table and only expose a sanitized document payload.
    CREATE TABLE IF NOT EXISTS erp_portal_links (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      resource        TEXT NOT NULL,
      record_id       TEXT NOT NULL,
      token_hash      TEXT NOT NULL UNIQUE,
      audience        TEXT NOT NULL,
      format_id       TEXT,
      title           TEXT,
      expires_at      TEXT,
      revoked_at      TEXT,
      last_accessed_at TEXT,
      access_count    INTEGER NOT NULL DEFAULT 0,
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS erp_portal_links_record_idx
      ON erp_portal_links(tenant_id, resource, record_id);
    CREATE INDEX IF NOT EXISTS erp_portal_links_expiry_idx
      ON erp_portal_links(expires_at);

    -- Per-record timeline events. Auto-emitted on every record CRUD
    -- so detail pages can show "Sarah created this · Bob changed
    -- stage to Customer · Mailer ran a workflow" without each
    -- feature wiring its own audit. Different from audit_events
    -- which is admin-facing — this is record-facing.
    CREATE TABLE IF NOT EXISTS timeline_events (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      resource    TEXT NOT NULL,
      record_id   TEXT NOT NULL,
      kind        TEXT NOT NULL,           -- 'created' | 'updated' | 'deleted' | 'restored' | 'comment' | 'workflow' | 'integration' | …
      actor       TEXT,                    -- email, system:..., or workflow run id
      diff        TEXT,                    -- JSON: { field: { from, to } }
      message     TEXT,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS timeline_record_idx
      ON timeline_events(tenant_id, resource, record_id, occurred_at DESC);

    -- Sidebar favourites + pinned records per user. Lightweight —
    -- everything else (custom views, recent records) derives from
    -- saved_views + audit-log timestamps.
    CREATE TABLE IF NOT EXISTS user_favorites (
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      kind        TEXT NOT NULL,           -- 'view' | 'record' | 'page' | 'link'
      target_id   TEXT NOT NULL,           -- view id, "<resource>:<recordId>", page id, URL
      label       TEXT,
      icon        TEXT,
      folder      TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (tenant_id, user_id, kind, target_id)
    );
    CREATE INDEX IF NOT EXISTS user_favorites_user_idx
      ON user_favorites(user_id, position);

    -- Connected accounts (Gmail/Outlook/IMAP/CalDAV). Storing the
    -- tokens encrypted-at-rest; we only ever decrypt in-process for
    -- the sync workers. Provider-specific extra config is in
    -- settings JSON.
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      provider        TEXT NOT NULL,        -- 'google' | 'microsoft' | 'imap' | 'caldav'
      handle          TEXT NOT NULL,        -- email or principal
      access_token    TEXT,
      refresh_token   TEXT,
      expires_at      TEXT,
      settings        TEXT,                 -- JSON
      last_synced_at  TEXT,
      sync_state      TEXT,                 -- JSON: provider-specific cursor
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      UNIQUE (tenant_id, user_id, provider, handle)
    );
    CREATE INDEX IF NOT EXISTS connected_accounts_user_idx
      ON connected_accounts(user_id);;
  `);
}
