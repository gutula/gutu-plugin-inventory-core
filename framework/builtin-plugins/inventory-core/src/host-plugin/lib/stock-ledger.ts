/** Stock Ledger + Bin + FIFO valuation engine.
 *
 *  Receipts add a row to `stock_ledger_entries` and a layer to
 *  `stock_fifo_layers`. Issues consume oldest layers first; partial
 *  consumption splits a layer in place. Bins (running balance + value
 *  per item × warehouse) are kept in sync inside the same transaction.
 *
 *  Moving-average is supported as an alternative valuation method —
 *  in that case we don't touch the FIFO queue and keep a single
 *  weighted-average rate per bin instead.
 *
 *  Invariants enforced:
 *    1. Negative stock is rejected (post fails) when the bin would go
 *       below zero. Override available via allowNegative=true for
 *       authorised flows (e.g. stock take adjustments).
 *    2. Stock ledger rows are immutable. Reversals create contra rows.
 *    3. FIFO layer remaining_qty never goes negative — every issue
 *       splits the consumed amount into separate consumption events
 *       across layers.
 *    4. Bin rows are derived: any external state mutation MUST go
 *       through `recordStockMovement()` so the bin stays correct.
 */

import { db, nowIso } from "@gutu-host";
import { uuid } from "@gutu-host";
import { recordAudit } from "@gutu-host";

export type Movement =
  | "receipt"
  | "issue"
  | "transfer-in"
  | "transfer-out"
  | "manufacture"
  | "adjustment";

export interface StockItem {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  uom: string;
  valuationMethod: "fifo" | "moving-average";
  reorderLevel: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  companyId: string | null;
  number: string;
  name: string;
  parentId: string | null;
  isGroup: boolean;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  kind: Movement;
  quantity: number;            // signed: positive in, negative out
  uom: string;
  conversion: number;
  baseQuantity: number;
  rateMinor: number | null;
  currency: string;
  valueMinor: number;          // signed
  sourceResource: string | null;
  sourceRecordId: string | null;
  postingDate: string;
  createdAt: string;
}

export interface Bin {
  itemId: string;
  warehouseId: string;
  actualQty: number;
  reservedQty: number;
  orderedQty: number;
  valuationMinor: number;
  currency: string;
  updatedAt: string;
}

export class StockError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "StockError";
  }
}

/* ----------------------------- Items + Warehouses ------------------------ */

export function createStockItem(args: {
  tenantId: string;
  code: string;
  name: string;
  uom?: string;
  valuationMethod?: "fifo" | "moving-average";
  reorderLevel?: number;
}): StockItem {
  const id = uuid();
  const now = nowIso();
  try {
    db.prepare(
      `INSERT INTO stock_items
         (id, tenant_id, code, name, uom, valuation_method, reorder_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      args.tenantId,
      args.code,
      args.name,
      args.uom ?? "unit",
      args.valuationMethod ?? "fifo",
      args.reorderLevel ?? null,
      now,
      now,
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message))
      throw new StockError("duplicate", `Item code "${args.code}" already exists`);
    throw err;
  }
  return getStockItem(args.tenantId, id)!;
}

export function getStockItem(tenantId: string, id: string): StockItem | null {
  const r = db
    .prepare(`SELECT * FROM stock_items WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as
      | {
          id: string;
          tenant_id: string;
          code: string;
          name: string;
          uom: string;
          valuation_method: "fifo" | "moving-average";
          reorder_level: number | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
  return r
    ? {
        id: r.id,
        tenantId: r.tenant_id,
        code: r.code,
        name: r.name,
        uom: r.uom,
        valuationMethod: r.valuation_method,
        reorderLevel: r.reorder_level,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    : null;
}

export function getStockItemByCode(tenantId: string, code: string): StockItem | null {
  const r = db
    .prepare(`SELECT id FROM stock_items WHERE code = ? AND tenant_id = ?`)
    .get(code, tenantId) as { id: string } | undefined;
  return r ? getStockItem(tenantId, r.id) : null;
}

export function listStockItems(tenantId: string): StockItem[] {
  const rows = db
    .prepare(`SELECT id FROM stock_items WHERE tenant_id = ? ORDER BY code ASC`)
    .all(tenantId) as Array<{ id: string }>;
  return rows.map((r) => getStockItem(tenantId, r.id)!).filter(Boolean);
}

export function createWarehouse(args: {
  tenantId: string;
  companyId?: string | null;
  number: string;
  name: string;
  parentId?: string | null;
  isGroup?: boolean;
}): Warehouse {
  const id = uuid();
  const now = nowIso();
  try {
    db.prepare(
      `INSERT INTO warehouses
         (id, tenant_id, company_id, number, name, parent_id, is_group, disabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      id,
      args.tenantId,
      args.companyId ?? null,
      args.number,
      args.name,
      args.parentId ?? null,
      args.isGroup ? 1 : 0,
      now,
      now,
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message))
      throw new StockError("duplicate", `Warehouse number "${args.number}" already exists`);
    throw err;
  }
  return getWarehouse(args.tenantId, id)!;
}

export function getWarehouse(tenantId: string, id: string): Warehouse | null {
  const r = db
    .prepare(`SELECT * FROM warehouses WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as
      | {
          id: string;
          tenant_id: string;
          company_id: string | null;
          number: string;
          name: string;
          parent_id: string | null;
          is_group: number;
          disabled: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;
  return r
    ? {
        id: r.id,
        tenantId: r.tenant_id,
        companyId: r.company_id,
        number: r.number,
        name: r.name,
        parentId: r.parent_id,
        isGroup: r.is_group === 1,
        disabled: r.disabled === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    : null;
}

export function listWarehouses(tenantId: string): Warehouse[] {
  const rows = db
    .prepare(`SELECT id FROM warehouses WHERE tenant_id = ? ORDER BY number ASC`)
    .all(tenantId) as Array<{ id: string }>;
  return rows.map((r) => getWarehouse(tenantId, r.id)!).filter(Boolean);
}

/* ----------------------------- Bin ---------------------------------------- */

export function getBin(tenantId: string, itemId: string, warehouseId: string): Bin | null {
  const r = db
    .prepare(
      `SELECT * FROM stock_bins
         WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?`,
    )
    .get(tenantId, itemId, warehouseId) as
      | {
          item_id: string;
          warehouse_id: string;
          actual_qty: number;
          reserved_qty: number;
          ordered_qty: number;
          valuation_minor: number;
          currency: string;
          updated_at: string;
        }
      | undefined;
  return r
    ? {
        itemId: r.item_id,
        warehouseId: r.warehouse_id,
        actualQty: r.actual_qty,
        reservedQty: r.reserved_qty,
        orderedQty: r.ordered_qty,
        valuationMinor: r.valuation_minor,
        currency: r.currency,
        updatedAt: r.updated_at,
      }
    : null;
}

export function listBinsForItem(tenantId: string, itemId: string): Bin[] {
  const rows = db
    .prepare(
      `SELECT * FROM stock_bins WHERE tenant_id = ? AND item_id = ? ORDER BY warehouse_id`,
    )
    .all(tenantId, itemId) as Array<{
      item_id: string;
      warehouse_id: string;
      actual_qty: number;
      reserved_qty: number;
      ordered_qty: number;
      valuation_minor: number;
      currency: string;
      updated_at: string;
    }>;
  return rows.map((r) => ({
    itemId: r.item_id,
    warehouseId: r.warehouse_id,
    actualQty: r.actual_qty,
    reservedQty: r.reserved_qty,
    orderedQty: r.ordered_qty,
    valuationMinor: r.valuation_minor,
    currency: r.currency,
    updatedAt: r.updated_at,
  }));
}

function bumpBin(
  tenantId: string,
  itemId: string,
  warehouseId: string,
  qtyDelta: number,
  valueDelta: number,
  currency: string,
): void {
  const existing = getBin(tenantId, itemId, warehouseId);
  if (existing) {
    db.prepare(
      `UPDATE stock_bins
         SET actual_qty = actual_qty + ?,
             valuation_minor = valuation_minor + ?,
             currency = ?,
             updated_at = ?
       WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?`,
    ).run(qtyDelta, valueDelta, currency, nowIso(), tenantId, itemId, warehouseId);
  } else {
    db.prepare(
      `INSERT INTO stock_bins
         (tenant_id, item_id, warehouse_id, actual_qty, reserved_qty, ordered_qty, valuation_minor, currency, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    ).run(tenantId, itemId, warehouseId, qtyDelta, valueDelta, currency, nowIso());
  }
}

/* ----------------------------- Movement ---------------------------------- */

export interface RecordMovementArgs {
  tenantId: string;
  itemId: string;
  warehouseId: string;
  kind: Movement;
  quantity: number;             // signed
  uom?: string;
  conversion?: number;          // to base UOM; default 1
  rateMinor?: number;           // required for inbound; computed for outbound
  currency?: string;
  sourceResource?: string;
  sourceRecordId?: string;
  postingDate?: string;
  /** Allow stock to go negative — used for stock-take corrections. */
  allowNegative?: boolean;
  /** When provided, bypass the bin update and only emit the SLE. Used
   *  by reversal / replay flows that have already adjusted the bin. */
  skipBinUpdate?: boolean;
}

export interface MovementResult {
  sle: StockLedgerEntry;
  consumedFromLayers?: Array<{ layerId: string; quantity: number; rateMinor: number }>;
  bin: Bin | null;
}

/** Atomic stock movement. Inbound creates a layer. Outbound consumes
 *  layers oldest-first (FIFO) or uses the bin's running average
 *  (moving-average). Splitting layers preserves remaining_qty integrity. */
export function recordStockMovement(args: RecordMovementArgs): MovementResult {
  if (!Number.isFinite(args.quantity) || args.quantity === 0)
    throw new StockError("invalid", "Quantity must be non-zero");
  const item = getStockItem(args.tenantId, args.itemId);
  if (!item) throw new StockError("not-found", "Item not found");
  const wh = getWarehouse(args.tenantId, args.warehouseId);
  if (!wh) throw new StockError("not-found", "Warehouse not found");
  if (wh.disabled) throw new StockError("disabled", "Warehouse is disabled");

  const conversion = args.conversion ?? 1;
  const baseQuantity = args.quantity * conversion;
  const inbound = baseQuantity > 0;
  const currency = args.currency ?? "USD";
  const postingDate = args.postingDate ?? nowIso().slice(0, 10);
  const isAdjustment = args.kind === "adjustment";

  let consumed: Array<{ layerId: string; quantity: number; rateMinor: number }> = [];
  let resolvedRateMinor: number | null = args.rateMinor ?? null;
  let valueMinor = 0;

  const tx = db.transaction(() => {
    if (inbound) {
      if (resolvedRateMinor == null || resolvedRateMinor < 0)
        throw new StockError("missing-rate", "Inbound movement requires rateMinor");
      valueMinor = Math.round(baseQuantity * resolvedRateMinor);
    } else {
      // Outbound: derive value from layers (FIFO) or bin average.
      const bin = getBin(args.tenantId, args.itemId, args.warehouseId);
      const remainingForOutbound = (bin?.actualQty ?? 0) + baseQuantity; // baseQuantity is negative
      if (remainingForOutbound < 0 && !(args.allowNegative || isAdjustment)) {
        throw new StockError(
          "negative-stock",
          `Outbound move would leave bin at ${remainingForOutbound.toFixed(4)} (item=${item.code}, warehouse=${wh.number})`,
        );
      }
      if (item.valuationMethod === "fifo") {
        const layers = db
          .prepare(
            // ROWID is SQLite's monotonic insertion-order tiebreaker.
            // Same-day inbounds → consumed in the order they arrived.
            `SELECT id, remaining_qty, rate_minor FROM stock_fifo_layers
               WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ? AND remaining_qty > 0
               ORDER BY posted_at ASC, ROWID ASC`,
          )
          .all(args.tenantId, args.itemId, args.warehouseId) as Array<{
            id: string;
            remaining_qty: number;
            rate_minor: number;
          }>;
        let toConsume = -baseQuantity;
        for (const layer of layers) {
          if (toConsume <= 0) break;
          const take = Math.min(layer.remaining_qty, toConsume);
          db.prepare(
            `UPDATE stock_fifo_layers SET remaining_qty = remaining_qty - ? WHERE id = ?`,
          ).run(take, layer.id);
          consumed.push({
            layerId: layer.id,
            quantity: take,
            rateMinor: layer.rate_minor,
          });
          valueMinor -= Math.round(take * layer.rate_minor);
          toConsume -= take;
        }
        if (toConsume > 0 && !(args.allowNegative || isAdjustment)) {
          throw new StockError(
            "insufficient-layers",
            `FIFO layers exhausted with ${toConsume.toFixed(4)} ${item.uom} short`,
          );
        }
        // Resolved rate is the weighted average of consumed layers
        // (informational only — value_minor is what GL cares about).
        if (consumed.length > 0) {
          const totalQty = consumed.reduce((n, c) => n + c.quantity, 0);
          resolvedRateMinor =
            totalQty > 0 ? Math.round(-valueMinor / totalQty) : null;
        }
      } else {
        // Moving average: use bin's avg = valuation/qty.
        const bin = getBin(args.tenantId, args.itemId, args.warehouseId);
        if (!bin || bin.actualQty <= 0) {
          if (!(args.allowNegative || isAdjustment)) {
            throw new StockError(
              "no-balance",
              "No balance for moving-average outbound (bin empty)",
            );
          }
          resolvedRateMinor = 0;
          valueMinor = 0;
        } else {
          const avg = Math.round(bin.valuationMinor / bin.actualQty);
          resolvedRateMinor = avg;
          valueMinor = -Math.round(-baseQuantity * avg);
        }
      }
    }

    // Insert SLE row.
    const sleId = uuid();
    const now = nowIso();
    db.prepare(
      `INSERT INTO stock_ledger_entries
         (id, tenant_id, item_id, warehouse_id, kind, quantity, uom, conversion, base_quantity,
          rate_minor, currency, value_minor, source_resource, source_record_id, posting_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sleId,
      args.tenantId,
      args.itemId,
      args.warehouseId,
      args.kind,
      args.quantity,
      args.uom ?? item.uom,
      conversion,
      baseQuantity,
      resolvedRateMinor,
      currency,
      valueMinor,
      args.sourceResource ?? null,
      args.sourceRecordId ?? null,
      postingDate,
      now,
    );

    if (inbound) {
      db.prepare(
        `INSERT INTO stock_fifo_layers
           (id, tenant_id, item_id, warehouse_id, sle_id, remaining_qty, rate_minor, currency, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        uuid(),
        args.tenantId,
        args.itemId,
        args.warehouseId,
        sleId,
        baseQuantity,
        resolvedRateMinor,
        currency,
        postingDate,
      );
    }

    if (!args.skipBinUpdate) {
      bumpBin(
        args.tenantId,
        args.itemId,
        args.warehouseId,
        baseQuantity,
        valueMinor,
        currency,
      );
    }

    return sleId;
  });

  const sleId = tx();
  recordAudit({
    actor: "system:stock-ledger",
    action: `stock.${args.kind}`,
    resource: "stock-ledger",
    recordId: sleId,
    payload: {
      itemId: args.itemId,
      warehouseId: args.warehouseId,
      quantity: args.quantity,
      valueMinor,
    },
  });
  const sle = db
    .prepare(`SELECT * FROM stock_ledger_entries WHERE id = ?`)
    .get(sleId) as {
      id: string;
      tenant_id: string;
      item_id: string;
      warehouse_id: string;
      kind: Movement;
      quantity: number;
      uom: string;
      conversion: number;
      base_quantity: number;
      rate_minor: number | null;
      currency: string;
      value_minor: number;
      source_resource: string | null;
      source_record_id: string | null;
      posting_date: string;
      created_at: string;
    };
  return {
    sle: {
      id: sle.id,
      tenantId: sle.tenant_id,
      itemId: sle.item_id,
      warehouseId: sle.warehouse_id,
      kind: sle.kind,
      quantity: sle.quantity,
      uom: sle.uom,
      conversion: sle.conversion,
      baseQuantity: sle.base_quantity,
      rateMinor: sle.rate_minor,
      currency: sle.currency,
      valueMinor: sle.value_minor,
      sourceResource: sle.source_resource,
      sourceRecordId: sle.source_record_id,
      postingDate: sle.posting_date,
      createdAt: sle.created_at,
    },
    consumedFromLayers: consumed,
    bin: getBin(args.tenantId, args.itemId, args.warehouseId),
  };
}

/** Two-leg transfer: out from source warehouse, in to destination
 *  with the same value (preserves valuation across transfer). */
export interface TransferArgs {
  tenantId: string;
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;             // positive
  uom?: string;
  postingDate?: string;
  sourceResource?: string;
  sourceRecordId?: string;
}

export function recordStockTransfer(args: TransferArgs): {
  out: MovementResult;
  in: MovementResult;
} {
  if (args.quantity <= 0) throw new StockError("invalid", "Transfer quantity must be > 0");
  if (args.fromWarehouseId === args.toWarehouseId)
    throw new StockError("invalid", "Source and destination warehouses must differ");

  const out = recordStockMovement({
    tenantId: args.tenantId,
    itemId: args.itemId,
    warehouseId: args.fromWarehouseId,
    kind: "transfer-out",
    quantity: -args.quantity,
    uom: args.uom,
    postingDate: args.postingDate,
    sourceResource: args.sourceResource,
    sourceRecordId: args.sourceRecordId,
  });

  // The inbound rate is the FIFO-resolved or moving-avg rate from the
  // outbound move so valuation is preserved.
  const ratePerUnit = out.sle.rateMinor ?? 0;
  const inbound = recordStockMovement({
    tenantId: args.tenantId,
    itemId: args.itemId,
    warehouseId: args.toWarehouseId,
    kind: "transfer-in",
    quantity: args.quantity,
    uom: args.uom,
    rateMinor: ratePerUnit,
    postingDate: args.postingDate,
    sourceResource: args.sourceResource,
    sourceRecordId: args.sourceRecordId,
  });

  return { out, in: inbound };
}

/* ----------------------------- Reports ----------------------------------- */

export interface StockBalanceRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseNumber: string;
  warehouseName: string;
  actualQty: number;
  reservedQty: number;
  orderedQty: number;
  valuationMinor: number;
  currency: string;
}

export function stockBalance(args: { tenantId: string; itemId?: string }): StockBalanceRow[] {
  const conditions: string[] = ["b.tenant_id = ?"];
  const params: unknown[] = [args.tenantId];
  if (args.itemId) {
    conditions.push("b.item_id = ?");
    params.push(args.itemId);
  }
  const rows = db
    .prepare(
      `SELECT b.item_id     as itemId,
              i.code         as itemCode,
              i.name         as itemName,
              b.warehouse_id as warehouseId,
              w.number       as warehouseNumber,
              w.name         as warehouseName,
              b.actual_qty   as actualQty,
              b.reserved_qty as reservedQty,
              b.ordered_qty  as orderedQty,
              b.valuation_minor as valuationMinor,
              b.currency
         FROM stock_bins b
         JOIN stock_items i ON i.id = b.item_id
         JOIN warehouses  w ON w.id = b.warehouse_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY i.code ASC, w.number ASC`,
    )
    .all(...params) as StockBalanceRow[];
  return rows;
}

export function reorderSuggestions(args: { tenantId: string }): Array<{
  item: StockItem;
  totalAvailable: number;
  reorderLevel: number;
  shortfall: number;
}> {
  const items = listStockItems(args.tenantId).filter((i) => typeof i.reorderLevel === "number");
  const out: Array<{
    item: StockItem;
    totalAvailable: number;
    reorderLevel: number;
    shortfall: number;
  }> = [];
  for (const item of items) {
    const total = (db
      .prepare(
        `SELECT COALESCE(SUM(actual_qty), 0) as total FROM stock_bins
           WHERE tenant_id = ? AND item_id = ?`,
      )
      .get(args.tenantId, item.id) as { total: number }).total;
    const level = item.reorderLevel ?? 0;
    if (total < level) {
      out.push({
        item,
        totalAvailable: total,
        reorderLevel: level,
        shortfall: level - total,
      });
    }
  }
  return out;
}
