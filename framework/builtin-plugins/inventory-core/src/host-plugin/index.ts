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
};

// Re-export the lib API so other plugins can `import` from
// "@gutu-plugin/inventory-core".
export * from "./lib";
