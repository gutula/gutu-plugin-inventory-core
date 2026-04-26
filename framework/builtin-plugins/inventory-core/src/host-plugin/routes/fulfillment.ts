/** Fulfillment REST API: reservations + pick lists + shipments.
 *
 *  Routes:
 *    POST   /reservations
 *    GET    /reservations/:id
 *    GET    /reservations/by-consumer/:resource/:id
 *    POST   /reservations/:id/cancel
 *
 *    GET    /pick-lists
 *    GET    /pick-lists/:id
 *    POST   /pick-lists
 *    POST   /pick-lists/:id/picks
 *
 *    GET    /shipments
 *    GET    /shipments/:id
 *    POST   /shipments/pack
 *    POST   /shipments/:id/ship
 *    POST   /shipments/:id/deliver
 *    POST   /shipments/:id/cancel
 */

import { Hono } from "@gutu-host";
import { requireAuth, currentUser } from "@gutu-host";
import { getTenantContext } from "@gutu-host";
import {
  FulfillmentError,
  cancelReservation,
  cancelShipment,
  createPickList,
  createReservation,
  getPickList,
  getReservation,
  getShipment,
  listPickLists,
  listReservationsForConsumer,
  listShipments,
  markDelivered,
  packShipment,
  recordPickQuantity,
  shipShipment,
} from "@gutu-plugin/inventory-core";

export const fulfillmentRoutes = new Hono();
fulfillmentRoutes.use("*", requireAuth);

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

function handle(err: unknown, c: Parameters<Parameters<typeof fulfillmentRoutes.get>[1]>[0]) {
  if (err instanceof FulfillmentError) return c.json({ error: err.message, code: err.code }, 400);
  throw err;
}

/* --- Reservations ------------------------------------------------------- */

fulfillmentRoutes.post("/reservations", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const r = createReservation({
      tenantId: tenantId(),
      itemId: String(body.itemId ?? ""),
      warehouseId: String(body.warehouseId ?? ""),
      quantity: Number(body.quantity ?? 0),
      consumerResource: String(body.consumerResource ?? ""),
      consumerId: String(body.consumerId ?? ""),
      memo: typeof body.memo === "string" ? body.memo : undefined,
      allowOver: body.allowOver === true,
    });
    return c.json(r, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

fulfillmentRoutes.get("/reservations/:id", (c) => {
  const r = getReservation(tenantId(), c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  return c.json(r);
});

fulfillmentRoutes.get("/reservations/by-consumer/:resource/:id", (c) => {
  return c.json({
    rows: listReservationsForConsumer(tenantId(), c.req.param("resource"), c.req.param("id")),
  });
});

fulfillmentRoutes.post("/reservations/:id/cancel", (c) => {
  try {
    return c.json(cancelReservation(tenantId(), c.req.param("id")));
  } catch (err) {
    return handle(err, c) as never;
  }
});

/* --- Pick lists --------------------------------------------------------- */

fulfillmentRoutes.get("/pick-lists", (c) => c.json({ rows: listPickLists(tenantId()) }));

fulfillmentRoutes.get("/pick-lists/:id", (c) => {
  const pl = getPickList(tenantId(), c.req.param("id"));
  if (!pl) return c.json({ error: "not found" }, 404);
  return c.json(pl);
});

fulfillmentRoutes.post("/pick-lists", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = currentUser(c);
  try {
    const pl = createPickList({
      tenantId: tenantId(),
      warehouseId: String(body.warehouseId ?? ""),
      number: typeof body.number === "string" ? body.number : undefined,
      assignee: typeof body.assignee === "string" ? body.assignee : undefined,
      memo: typeof body.memo === "string" ? body.memo : undefined,
      reservationIds: Array.isArray(body.reservationIds) ? (body.reservationIds as string[]) : undefined,
      lines: Array.isArray(body.lines) ? (body.lines as never) : undefined,
      createdBy: user.email,
    });
    return c.json(pl, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

fulfillmentRoutes.post("/pick-lists/:id/picks", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const pl = recordPickQuantity({
      tenantId: tenantId(),
      pickListId: c.req.param("id"),
      itemId: String(body.itemId ?? ""),
      warehouseId: String(body.warehouseId ?? ""),
      quantity: Number(body.quantity ?? 0),
    });
    return c.json(pl);
  } catch (err) {
    return handle(err, c) as never;
  }
});

/* --- Shipments ---------------------------------------------------------- */

fulfillmentRoutes.get("/shipments", (c) => c.json({ rows: listShipments(tenantId()) }));

fulfillmentRoutes.get("/shipments/:id", (c) => {
  const sh = getShipment(tenantId(), c.req.param("id"));
  if (!sh) return c.json({ error: "not found" }, 404);
  return c.json(sh);
});

fulfillmentRoutes.post("/shipments/pack", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = currentUser(c);
  try {
    const sh = packShipment({
      tenantId: tenantId(),
      pickListId: String(body.pickListId ?? ""),
      number: typeof body.number === "string" ? body.number : undefined,
      carrier: typeof body.carrier === "string" ? body.carrier : undefined,
      consumerResource: typeof body.consumerResource === "string" ? body.consumerResource : undefined,
      consumerId: typeof body.consumerId === "string" ? body.consumerId : undefined,
      memo: typeof body.memo === "string" ? body.memo : undefined,
      createdBy: user.email,
    });
    return c.json(sh, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

fulfillmentRoutes.post("/shipments/:id/ship", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = currentUser(c);
  try {
    const sh = shipShipment({
      tenantId: tenantId(),
      id: c.req.param("id"),
      trackingNo: typeof body.trackingNo === "string" ? body.trackingNo : undefined,
      shippedAt: typeof body.shippedAt === "string" ? body.shippedAt : undefined,
      shippedBy: user.email,
    });
    return c.json(sh);
  } catch (err) {
    return handle(err, c) as never;
  }
});

fulfillmentRoutes.post("/shipments/:id/deliver", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = currentUser(c);
  try {
    const sh = markDelivered({
      tenantId: tenantId(),
      id: c.req.param("id"),
      deliveredAt: typeof body.deliveredAt === "string" ? body.deliveredAt : undefined,
      by: user.email,
    });
    return c.json(sh);
  } catch (err) {
    return handle(err, c) as never;
  }
});

fulfillmentRoutes.post("/shipments/:id/cancel", (c) => {
  const user = currentUser(c);
  try {
    const sh = cancelShipment({
      tenantId: tenantId(),
      id: c.req.param("id"),
      by: user.email,
    });
    return c.json(sh);
  } catch (err) {
    return handle(err, c) as never;
  }
});
