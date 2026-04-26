/** Stock Reservation + Pick / Pack / Ship pipeline.
 *
 *  Lifecycle:
 *
 *    reservation (active) ──pickList──▶ pick_list_item (open)
 *                                       │
 *                                       ▼ pickQuantity()
 *                                       picked
 *                                       │
 *                                       ▼ packShipment()
 *                                       packed (shipment row)
 *                                       │
 *                                       ▼ shipShipment()
 *                                       shipped → SLE issue, reservation fulfilled
 *
 *  The reservation never decrements stock — it only sets `bin.reserved_qty`
 *  so other sales orders see committed inventory. Shipping is what posts
 *  the actual outbound stock-ledger entry, consuming FIFO layers.
 *  Cancelling a reservation releases `reserved_qty` without touching SLE.
 *
 *  Invariants:
 *    1. reserved_qty ≥ 0 for any active reservation set; cancelling a
 *       reservation never drives it negative.
 *    2. picked_qty ≤ requested quantity per pick line.
 *    3. shipped quantity ≤ picked quantity per pick line.
 *    4. A reservation can be linked to many pick lines (split picks)
 *       but its consumer_resource/id is fixed at creation time.
 */

import { db, nowIso } from "@gutu-host";
import { uuid } from "@gutu-host";
import { recordStockMovement, getBin } from "@gutu-plugin/inventory-core";
import { recordAudit } from "@gutu-host";

export type ReservationStatus = "active" | "fulfilled" | "cancelled";
export type PickListStatus = "open" | "picking" | "picked" | "cancelled";
export type PickItemStatus = "open" | "picked" | "partial" | "cancelled";
export type ShipmentStatus = "packed" | "shipped" | "delivered" | "cancelled";

export interface Reservation {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  consumerResource: string;
  consumerId: string;
  status: ReservationStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PickListItem {
  id: string;
  pickListId: string;
  reservationId: string | null;
  itemId: string;
  warehouseId: string;
  quantity: number;
  pickedQty: number;
  status: PickItemStatus;
  createdAt: string;
}

export interface PickList {
  id: string;
  tenantId: string;
  warehouseId: string;
  number: string;
  status: PickListStatus;
  assignee: string | null;
  memo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: PickListItem[];
}

export interface ShipmentLine {
  id: string;
  shipmentId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  sleId: string | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  tenantId: string;
  number: string;
  status: ShipmentStatus;
  pickListId: string | null;
  consumerResource: string | null;
  consumerId: string | null;
  trackingNo: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  memo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: ShipmentLine[];
}

export class FulfillmentError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "FulfillmentError";
  }
}

/* ----------------------------- Reservations ------------------------------ */

export interface CreateReservationArgs {
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  consumerResource: string;
  consumerId: string;
  memo?: string;
  /** Allow over-reservation — useful for backorders. */
  allowOver?: boolean;
}

export function createReservation(args: CreateReservationArgs): Reservation {
  if (!Number.isFinite(args.quantity) || args.quantity <= 0)
    throw new FulfillmentError("invalid", "Reservation quantity must be > 0");
  const tx = db.transaction(() => {
    if (!args.allowOver) {
      const bin = getBin(args.tenantId, args.itemId, args.warehouseId);
      const available = (bin?.actualQty ?? 0) - (bin?.reservedQty ?? 0);
      if (available < args.quantity) {
        throw new FulfillmentError(
          "insufficient-available",
          `Only ${available.toFixed(4)} available to reserve`,
        );
      }
    }
    const id = uuid();
    const now = nowIso();
    db.prepare(
      `INSERT INTO stock_reservations
         (id, tenant_id, item_id, warehouse_id, quantity, consumer_resource, consumer_id, status, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).run(
      id,
      args.tenantId,
      args.itemId,
      args.warehouseId,
      args.quantity,
      args.consumerResource,
      args.consumerId,
      args.memo ?? null,
      now,
      now,
    );
    bumpBinReserved(args.tenantId, args.itemId, args.warehouseId, args.quantity);
    return id;
  });
  const id = tx();
  recordAudit({
    actor: "system:fulfillment",
    action: "reservation.created",
    resource: "stock-reservation",
    recordId: id,
    payload: {
      itemId: args.itemId,
      warehouseId: args.warehouseId,
      quantity: args.quantity,
      consumerResource: args.consumerResource,
      consumerId: args.consumerId,
    },
  });
  return getReservation(args.tenantId, id)!;
}

function bumpBinReserved(
  tenantId: string,
  itemId: string,
  warehouseId: string,
  delta: number,
): void {
  const bin = getBin(tenantId, itemId, warehouseId);
  if (bin) {
    db.prepare(
      `UPDATE stock_bins
         SET reserved_qty = reserved_qty + ?, updated_at = ?
       WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?`,
    ).run(delta, nowIso(), tenantId, itemId, warehouseId);
  } else {
    db.prepare(
      `INSERT INTO stock_bins
         (tenant_id, item_id, warehouse_id, actual_qty, reserved_qty, ordered_qty, valuation_minor, currency, updated_at)
       VALUES (?, ?, ?, 0, ?, 0, 0, 'USD', ?)`,
    ).run(tenantId, itemId, warehouseId, delta, nowIso());
  }
}

export function getReservation(tenantId: string, id: string): Reservation | null {
  const r = db
    .prepare(`SELECT * FROM stock_reservations WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as
      | {
          id: string;
          tenant_id: string;
          item_id: string;
          warehouse_id: string;
          quantity: number;
          consumer_resource: string;
          consumer_id: string;
          status: ReservationStatus;
          memo: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
  return r
    ? {
        id: r.id,
        tenantId: r.tenant_id,
        itemId: r.item_id,
        warehouseId: r.warehouse_id,
        quantity: r.quantity,
        consumerResource: r.consumer_resource,
        consumerId: r.consumer_id,
        status: r.status,
        memo: r.memo,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    : null;
}

export function listReservationsForConsumer(
  tenantId: string,
  consumerResource: string,
  consumerId: string,
): Reservation[] {
  const rows = db
    .prepare(
      `SELECT id FROM stock_reservations
         WHERE tenant_id = ? AND consumer_resource = ? AND consumer_id = ?
         ORDER BY created_at ASC`,
    )
    .all(tenantId, consumerResource, consumerId) as Array<{ id: string }>;
  return rows.map((r) => getReservation(tenantId, r.id)!).filter(Boolean);
}

export function cancelReservation(tenantId: string, id: string): Reservation {
  const r = getReservation(tenantId, id);
  if (!r) throw new FulfillmentError("not-found", "Reservation not found");
  if (r.status !== "active") return r;
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE stock_reservations SET status = 'cancelled', updated_at = ? WHERE id = ?`,
    ).run(nowIso(), id);
    bumpBinReserved(tenantId, r.itemId, r.warehouseId, -r.quantity);
  });
  tx();
  recordAudit({
    actor: "system:fulfillment",
    action: "reservation.cancelled",
    resource: "stock-reservation",
    recordId: id,
  });
  return getReservation(tenantId, id)!;
}

/* ----------------------------- Pick lists -------------------------------- */

export interface CreatePickListArgs {
  tenantId: string;
  warehouseId: string;
  number?: string;
  assignee?: string;
  memo?: string;
  /** Reservations to include. Each gets its own pick line. */
  reservationIds?: string[];
  /** Or, ad-hoc lines. */
  lines?: Array<{
    itemId: string;
    warehouseId?: string;
    quantity: number;
    reservationId?: string;
  }>;
  createdBy: string;
}

export function createPickList(args: CreatePickListArgs): PickList {
  const id = uuid();
  const now = nowIso();
  const number =
    args.number ?? `PL-${now.slice(0, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO pick_lists
         (id, tenant_id, warehouse_id, number, status, assignee, memo, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
    ).run(
      id,
      args.tenantId,
      args.warehouseId,
      number,
      args.assignee ?? null,
      args.memo ?? null,
      args.createdBy,
      now,
      now,
    );

    const stmt = db.prepare(
      `INSERT INTO pick_list_items
         (id, tenant_id, pick_list_id, reservation_id, item_id, warehouse_id, quantity, picked_qty, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open', ?)`,
    );
    if (args.reservationIds && args.reservationIds.length > 0) {
      for (const rid of args.reservationIds) {
        const reservation = getReservation(args.tenantId, rid);
        if (!reservation) throw new FulfillmentError("not-found", `Reservation ${rid} not found`);
        if (reservation.status !== "active")
          throw new FulfillmentError("conflict", `Reservation ${rid} is ${reservation.status}`);
        stmt.run(
          uuid(),
          args.tenantId,
          id,
          reservation.id,
          reservation.itemId,
          reservation.warehouseId,
          reservation.quantity,
          now,
        );
      }
    }
    if (args.lines) {
      for (const line of args.lines) {
        if (line.quantity <= 0)
          throw new FulfillmentError("invalid", "Pick line quantity must be > 0");
        stmt.run(
          uuid(),
          args.tenantId,
          id,
          line.reservationId ?? null,
          line.itemId,
          line.warehouseId ?? args.warehouseId,
          line.quantity,
          now,
        );
      }
    }
  });
  tx();
  recordAudit({
    actor: args.createdBy,
    action: "pick-list.created",
    resource: "pick-list",
    recordId: id,
    payload: { number, warehouseId: args.warehouseId },
  });
  return getPickList(args.tenantId, id)!;
}

export function getPickList(tenantId: string, id: string): PickList | null {
  const row = db
    .prepare(`SELECT * FROM pick_lists WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as
      | {
          id: string;
          tenant_id: string;
          warehouse_id: string;
          number: string;
          status: PickListStatus;
          assignee: string | null;
          memo: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
  if (!row) return null;
  const items = (
    db
      .prepare(`SELECT * FROM pick_list_items WHERE pick_list_id = ? ORDER BY created_at ASC`)
      .all(id) as Array<{
        id: string;
        pick_list_id: string;
        reservation_id: string | null;
        item_id: string;
        warehouse_id: string;
        quantity: number;
        picked_qty: number;
        status: PickItemStatus;
        created_at: string;
      }>
  ).map((r) => ({
    id: r.id,
    pickListId: r.pick_list_id,
    reservationId: r.reservation_id,
    itemId: r.item_id,
    warehouseId: r.warehouse_id,
    quantity: r.quantity,
    pickedQty: r.picked_qty,
    status: r.status,
    createdAt: r.created_at,
  }));
  return {
    id: row.id,
    tenantId: row.tenant_id,
    warehouseId: row.warehouse_id,
    number: row.number,
    status: row.status,
    assignee: row.assignee,
    memo: row.memo,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

export function listPickLists(tenantId: string, status?: PickListStatus): PickList[] {
  const rows = status
    ? (db
        .prepare(
          `SELECT id FROM pick_lists WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC`,
        )
        .all(tenantId, status) as Array<{ id: string }>)
    : (db
        .prepare(`SELECT id FROM pick_lists WHERE tenant_id = ? ORDER BY created_at DESC`)
        .all(tenantId) as Array<{ id: string }>);
  return rows.map((r) => getPickList(tenantId, r.id)!).filter(Boolean);
}

/** Mark an item as picked (or partially picked). When all items are
 *  picked, the pick list flips to 'picked'. */
export function recordPickQuantity(args: {
  tenantId: string;
  pickListId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
}): PickList {
  const pl = getPickList(args.tenantId, args.pickListId);
  if (!pl) throw new FulfillmentError("not-found", "Pick list not found");
  if (pl.status === "cancelled" || pl.status === "picked")
    throw new FulfillmentError("conflict", `Pick list is ${pl.status}`);

  const line = pl.items.find(
    (l) => l.itemId === args.itemId && l.warehouseId === args.warehouseId && l.status !== "cancelled",
  );
  if (!line) throw new FulfillmentError("not-found", "Pick line not found");
  if (args.quantity <= 0)
    throw new FulfillmentError("invalid", "Picked quantity must be > 0");
  const newPicked = line.pickedQty + args.quantity;
  if (newPicked > line.quantity)
    throw new FulfillmentError("over-pick", `Cannot pick more than ${line.quantity}`);

  const tx = db.transaction(() => {
    const status: PickItemStatus = newPicked >= line.quantity ? "picked" : "partial";
    db.prepare(
      `UPDATE pick_list_items SET picked_qty = ?, status = ? WHERE id = ?`,
    ).run(newPicked, status, line.id);
    // Advance pick list itself.
    const remaining = db
      .prepare(
        `SELECT COUNT(*) as n FROM pick_list_items
           WHERE pick_list_id = ? AND status NOT IN ('picked','cancelled')`,
      )
      .get(args.pickListId) as { n: number };
    const plStatus: PickListStatus = remaining.n === 0 ? "picked" : "picking";
    db.prepare(
      `UPDATE pick_lists SET status = ?, updated_at = ? WHERE id = ?`,
    ).run(plStatus, nowIso(), args.pickListId);
  });
  tx();
  return getPickList(args.tenantId, args.pickListId)!;
}

/* ----------------------------- Shipments --------------------------------- */

export interface PackShipmentArgs {
  tenantId: string;
  pickListId: string;
  number?: string;
  carrier?: string;
  consumerResource?: string;
  consumerId?: string;
  memo?: string;
  createdBy: string;
}

export function packShipment(args: PackShipmentArgs): Shipment {
  const pl = getPickList(args.tenantId, args.pickListId);
  if (!pl) throw new FulfillmentError("not-found", "Pick list not found");
  if (pl.status !== "picked")
    throw new FulfillmentError("conflict", `Pick list must be 'picked' (was ${pl.status})`);

  const id = uuid();
  const now = nowIso();
  const number =
    args.number ??
    `SHP-${now.slice(0, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO shipments
         (id, tenant_id, number, status, pick_list_id, consumer_resource, consumer_id, carrier,
          memo, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'packed', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      args.tenantId,
      number,
      args.pickListId,
      args.consumerResource ?? null,
      args.consumerId ?? null,
      args.carrier ?? null,
      args.memo ?? null,
      args.createdBy,
      now,
      now,
    );
    const stmt = db.prepare(
      `INSERT INTO shipment_lines
         (id, tenant_id, shipment_id, item_id, warehouse_id, quantity, sle_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    );
    for (const line of pl.items) {
      if (line.pickedQty <= 0) continue;
      stmt.run(uuid(), args.tenantId, id, line.itemId, line.warehouseId, line.pickedQty, now);
    }
  });
  tx();
  recordAudit({
    actor: args.createdBy,
    action: "shipment.packed",
    resource: "shipment",
    recordId: id,
    payload: { number, pickListId: args.pickListId },
  });
  return getShipment(args.tenantId, id)!;
}

export function getShipment(tenantId: string, id: string): Shipment | null {
  const row = db
    .prepare(`SELECT * FROM shipments WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as
      | {
          id: string;
          tenant_id: string;
          number: string;
          status: ShipmentStatus;
          pick_list_id: string | null;
          consumer_resource: string | null;
          consumer_id: string | null;
          tracking_no: string | null;
          carrier: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          memo: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
  if (!row) return null;
  const lines = (
    db
      .prepare(`SELECT * FROM shipment_lines WHERE shipment_id = ? ORDER BY created_at ASC`)
      .all(id) as Array<{
        id: string;
        shipment_id: string;
        item_id: string;
        warehouse_id: string;
        quantity: number;
        sle_id: string | null;
        created_at: string;
      }>
  ).map((r) => ({
    id: r.id,
    shipmentId: r.shipment_id,
    itemId: r.item_id,
    warehouseId: r.warehouse_id,
    quantity: r.quantity,
    sleId: r.sle_id,
    createdAt: r.created_at,
  }));
  return {
    id: row.id,
    tenantId: row.tenant_id,
    number: row.number,
    status: row.status,
    pickListId: row.pick_list_id,
    consumerResource: row.consumer_resource,
    consumerId: row.consumer_id,
    trackingNo: row.tracking_no,
    carrier: row.carrier,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    memo: row.memo,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  };
}

export function listShipments(tenantId: string): Shipment[] {
  const rows = db
    .prepare(`SELECT id FROM shipments WHERE tenant_id = ? ORDER BY created_at DESC`)
    .all(tenantId) as Array<{ id: string }>;
  return rows.map((r) => getShipment(tenantId, r.id)!).filter(Boolean);
}

/** Posts the actual outbound stock-ledger entries, fulfills any
 *  reservations that this shipment was built from, and flips the
 *  shipment + pick list to terminal states. Idempotent — re-shipping
 *  a shipped shipment is a no-op. */
export function shipShipment(args: {
  tenantId: string;
  id: string;
  trackingNo?: string;
  shippedAt?: string;
  shippedBy: string;
}): Shipment {
  const sh = getShipment(args.tenantId, args.id);
  if (!sh) throw new FulfillmentError("not-found", "Shipment not found");
  if (sh.status === "shipped" || sh.status === "delivered") return sh;
  if (sh.status === "cancelled") throw new FulfillmentError("conflict", "Shipment is cancelled");

  const now = nowIso();
  const shippedAt = args.shippedAt ?? now;

  const tx = db.transaction(() => {
    for (const line of sh.lines) {
      if (line.sleId) continue; // already issued
      const out = recordStockMovement({
        tenantId: args.tenantId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        kind: "issue",
        quantity: -line.quantity,
        sourceResource: "shipment",
        sourceRecordId: sh.id,
        postingDate: shippedAt.slice(0, 10),
      });
      db.prepare(
        `UPDATE shipment_lines SET sle_id = ? WHERE id = ?`,
      ).run(out.sle.id, line.id);
    }
    // Fulfil any reservations linked through the pick list.
    if (sh.pickListId) {
      const pl = getPickList(args.tenantId, sh.pickListId);
      if (pl) {
        for (const item of pl.items) {
          if (!item.reservationId) continue;
          const r = getReservation(args.tenantId, item.reservationId);
          if (r && r.status === "active") {
            db.prepare(
              `UPDATE stock_reservations SET status = 'fulfilled', updated_at = ? WHERE id = ?`,
            ).run(now, r.id);
            bumpBinReserved(args.tenantId, r.itemId, r.warehouseId, -r.quantity);
          }
        }
      }
    }
    db.prepare(
      `UPDATE shipments SET status = 'shipped', tracking_no = ?, shipped_at = ?, updated_at = ? WHERE id = ?`,
    ).run(args.trackingNo ?? sh.trackingNo, shippedAt, now, sh.id);
  });
  tx();
  recordAudit({
    actor: args.shippedBy,
    action: "shipment.shipped",
    resource: "shipment",
    recordId: args.id,
    payload: { trackingNo: args.trackingNo ?? null },
  });
  return getShipment(args.tenantId, args.id)!;
}

export function markDelivered(args: {
  tenantId: string;
  id: string;
  deliveredAt?: string;
  by: string;
}): Shipment {
  const now = nowIso();
  const r = db.prepare(
    `UPDATE shipments SET status = 'delivered', delivered_at = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND status = 'shipped'`,
  ).run(args.deliveredAt ?? now, now, args.id, args.tenantId);
  if (r.changes === 0) {
    const sh = getShipment(args.tenantId, args.id);
    if (!sh) throw new FulfillmentError("not-found", "Shipment not found");
    if (sh.status === "delivered") return sh;
    throw new FulfillmentError("conflict", `Shipment must be 'shipped' first (was ${sh.status})`);
  }
  recordAudit({
    actor: args.by,
    action: "shipment.delivered",
    resource: "shipment",
    recordId: args.id,
  });
  return getShipment(args.tenantId, args.id)!;
}

export function cancelShipment(args: { tenantId: string; id: string; by: string }): Shipment {
  const sh = getShipment(args.tenantId, args.id);
  if (!sh) throw new FulfillmentError("not-found", "Shipment not found");
  if (sh.status === "cancelled") return sh;
  if (sh.status === "shipped" || sh.status === "delivered")
    throw new FulfillmentError("conflict", "Cannot cancel a shipped shipment; reverse via stock adjustment");
  db.prepare(`UPDATE shipments SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .run(nowIso(), args.id);
  recordAudit({
    actor: args.by,
    action: "shipment.cancelled",
    resource: "shipment",
    recordId: args.id,
  });
  return getShipment(args.tenantId, args.id)!;
}
