export const domainCatalog = {
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
} as const;
