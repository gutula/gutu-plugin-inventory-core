/** Host-plugin contribution for inventory-core.
 *
 *  Mounts at /api/<routes> via the shell's plugin loader. */
import type { HostPlugin } from "@gutu-host/plugin-contract";
import { migrate } from "./db/migrate";
import { stockLedgerRoutes } from "./routes/stock-ledger";
import { fulfillmentRoutes } from "./routes/fulfillment";


export const hostPlugin: HostPlugin = {
  id: "inventory-core",
  version: "1.0.0",
  dependsOn: ["template-core", "notifications-core"],
  migrate,
  routes: [
    { mountPath: "/stock", router: stockLedgerRoutes },
    { mountPath: "/fulfillment", router: fulfillmentRoutes }
  ],
  resources: [
    "inventory.alert",
    "inventory.batch",
    "inventory.bin",
    "inventory.delivery-note",
    "inventory.delivery-trip",
    "inventory.item",
    "inventory.item-price",
    "inventory.item-supplier",
    "inventory.item-variant",
    "inventory.landed-cost",
    "inventory.material-request",
    "inventory.packing-slip",
    "inventory.pick-list",
    "inventory.purchase-receipt",
    "inventory.serial-number",
    "inventory.stock-entry",
    "inventory.stock-reconciliation",
    "inventory.warehouse",
  ],
};

// Re-export the lib API so other plugins can `import` from
// "@gutu-plugin/inventory-core".
export * from "./lib";
