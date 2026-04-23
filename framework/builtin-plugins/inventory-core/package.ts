import { definePackage } from "@platform/kernel";

export default definePackage({
  "id": "inventory-core",
  "kind": "plugin",
  "version": "0.1.0",
  "contractVersion": "1.0.0",
  "sourceRepo": "gutu-plugin-inventory-core",
  "displayName": "Inventory Core",
  "domainGroup": "Operational Data",
  "defaultCategory": {
    "id": "business",
    "label": "Business",
    "subcategoryId": "inventory_warehouse",
    "subcategoryLabel": "Inventory & Warehouse"
  },
  "description": "Warehouse truth, stock ledger state, reservation visibility, transfer execution, and physical reconciliation for inventory-controlled operations.",
  "extends": [],
  "dependsOn": [
    "auth-core",
    "org-tenant-core",
    "role-policy-core",
    "audit-core",
    "workflow-core",
    "product-catalog-core",
    "traceability-core"
  ],
  "dependencyContracts": [
    {
      "packageId": "auth-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    },
    {
      "packageId": "org-tenant-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    },
    {
      "packageId": "role-policy-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    },
    {
      "packageId": "audit-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    },
    {
      "packageId": "workflow-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    },
    {
      "packageId": "product-catalog-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    },
    {
      "packageId": "traceability-core",
      "class": "required",
      "rationale": "Required for Inventory Core to keep its boundary governed and explicit."
    }
  ],
  "optionalWith": [],
  "conflictsWith": [],
  "providesCapabilities": [
    "inventory.stock-ledger",
    "inventory.reservations",
    "inventory.transfers"
  ],
  "requestedCapabilities": [
    "ui.register.admin",
    "api.rest.mount",
    "data.write.inventory",
    "events.publish.inventory"
  ],
  "ownsData": [
    "inventory.stock-ledger",
    "inventory.reservations",
    "inventory.transfers",
    "inventory.reconciliation"
  ],
  "extendsData": [],
  "publicCommands": [
    "inventory.receipts.record",
    "inventory.reservations.allocate",
    "inventory.transfers.request"
  ],
  "publicQueries": [
    "inventory.stock-summary",
    "inventory.transfer-summary"
  ],
  "publicEvents": [
    "inventory.receipt-recorded.v1",
    "inventory.reservation-allocated.v1",
    "inventory.transfer-requested.v1"
  ],
  "domainCatalog": {
    "erpnextModules": [
      "Stock"
    ],
    "erpnextDoctypes": [
      "Warehouse",
      "Bin",
      "Batch",
      "Serial No",
      "Stock Entry",
      "Stock Reconciliation",
      "Stock Ledger Entry",
      "Stock Reservation Entry",
      "Pick List",
      "Packing Slip",
      "Shipment",
      "Landed Cost Voucher"
    ],
    "ownedEntities": [
      "Warehouse",
      "Location",
      "Stock Ledger",
      "Reservation",
      "Transfer",
      "Pick Wave",
      "Batch or Serial Genealogy",
      "Valuation Layer"
    ],
    "reports": [
      "Stock Ledger",
      "Stock Balance",
      "Projected Quantity",
      "Batch-Wise Balance History",
      "Warehouse Wise Item Balance Age and Value",
      "BOM Stock Report"
    ],
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ],
    "operationalScenarios": [
      "receipt-to-putaway",
      "reservation-to-pick-pack-ship",
      "transfer-in-transit",
      "cycle-count-and-recount"
    ],
    "settingsSurfaces": [
      "Stock Settings",
      "Delivery Settings",
      "Putaway Rule"
    ],
    "edgeCases": [
      "serial-batch mismatch",
      "negative stock prevention",
      "partial transfer receipt",
      "valuation corrections after backdated entry"
    ]
  },
  "slotClaims": [],
  "trustTier": "first-party",
  "reviewTier": "R1",
  "isolationProfile": "same-process-trusted",
  "compatibility": {
    "framework": "^0.1.0",
    "runtime": "bun>=1.3.12",
    "db": [
      "postgres",
      "sqlite"
    ]
  }
});
