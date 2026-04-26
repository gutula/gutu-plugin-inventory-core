/** Stock Ledger / Bin REST API.
 *
 *  Routes:
 *    Items:
 *      GET   /items
 *      POST  /items
 *      GET   /items/:id
 *
 *    Warehouses:
 *      GET   /warehouses
 *      POST  /warehouses
 *
 *    Movement:
 *      POST  /movements                  receipt / issue / adjustment
 *      POST  /transfers                  two-leg transfer
 *      GET   /balance                    bin list
 *      GET   /reorder                    reorder suggestions
 */

import { Hono } from "@gutu-host";
import { requireAuth } from "@gutu-host";
import { getTenantContext } from "@gutu-host";
import {
  StockError,
  createStockItem,
  createWarehouse,
  getStockItem,
  getWarehouse,
  listStockItems,
  listWarehouses,
  recordStockMovement,
  recordStockTransfer,
  reorderSuggestions,
  stockBalance,
  type Movement,
} from "@gutu-plugin/inventory-core";

export const stockLedgerRoutes = new Hono();
stockLedgerRoutes.use("*", requireAuth);

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

function handle(err: unknown, c: Parameters<Parameters<typeof stockLedgerRoutes.get>[1]>[0]) {
  if (err instanceof StockError) return c.json({ error: err.message, code: err.code }, 400);
  throw err;
}

stockLedgerRoutes.get("/items", (c) => c.json({ rows: listStockItems(tenantId()) }));

stockLedgerRoutes.get("/items/:id", (c) => {
  const i = getStockItem(tenantId(), c.req.param("id"));
  if (!i) return c.json({ error: "not found" }, 404);
  return c.json(i);
});

stockLedgerRoutes.post("/items", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const i = createStockItem({
      tenantId: tenantId(),
      code: String(body.code ?? ""),
      name: String(body.name ?? ""),
      uom: typeof body.uom === "string" ? body.uom : undefined,
      valuationMethod: (body.valuationMethod as never) ?? undefined,
      reorderLevel: typeof body.reorderLevel === "number" ? body.reorderLevel : undefined,
    });
    return c.json(i, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

stockLedgerRoutes.get("/warehouses", (c) => c.json({ rows: listWarehouses(tenantId()) }));

stockLedgerRoutes.post("/warehouses", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const w = createWarehouse({
      tenantId: tenantId(),
      companyId: (body.companyId as string | null | undefined) ?? null,
      number: String(body.number ?? ""),
      name: String(body.name ?? ""),
      parentId: (body.parentId as string | null | undefined) ?? null,
      isGroup: body.isGroup === true,
    });
    return c.json(w, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

stockLedgerRoutes.get("/warehouses/:id", (c) => {
  const w = getWarehouse(tenantId(), c.req.param("id"));
  if (!w) return c.json({ error: "not found" }, 404);
  return c.json(w);
});

stockLedgerRoutes.post("/movements", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const out = recordStockMovement({
      tenantId: tenantId(),
      itemId: String(body.itemId ?? ""),
      warehouseId: String(body.warehouseId ?? ""),
      kind: (body.kind as Movement) ?? "receipt",
      quantity: Number(body.quantity ?? 0),
      uom: typeof body.uom === "string" ? body.uom : undefined,
      conversion: typeof body.conversion === "number" ? body.conversion : undefined,
      rateMinor: typeof body.rateMinor === "number" ? body.rateMinor : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      sourceResource: typeof body.sourceResource === "string" ? body.sourceResource : undefined,
      sourceRecordId: typeof body.sourceRecordId === "string" ? body.sourceRecordId : undefined,
      postingDate: typeof body.postingDate === "string" ? body.postingDate : undefined,
      allowNegative: body.allowNegative === true,
    });
    return c.json(out, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

stockLedgerRoutes.post("/transfers", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const out = recordStockTransfer({
      tenantId: tenantId(),
      itemId: String(body.itemId ?? ""),
      fromWarehouseId: String(body.fromWarehouseId ?? ""),
      toWarehouseId: String(body.toWarehouseId ?? ""),
      quantity: Number(body.quantity ?? 0),
      uom: typeof body.uom === "string" ? body.uom : undefined,
      postingDate: typeof body.postingDate === "string" ? body.postingDate : undefined,
      sourceResource: typeof body.sourceResource === "string" ? body.sourceResource : undefined,
      sourceRecordId: typeof body.sourceRecordId === "string" ? body.sourceRecordId : undefined,
    });
    return c.json(out, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

stockLedgerRoutes.get("/balance", (c) =>
  c.json({
    rows: stockBalance({
      tenantId: tenantId(),
      itemId: c.req.query("item") ?? undefined,
    }),
  }),
);

stockLedgerRoutes.get("/reorder", (c) =>
  c.json({ rows: reorderSuggestions({ tenantId: tenantId() }) }),
);
