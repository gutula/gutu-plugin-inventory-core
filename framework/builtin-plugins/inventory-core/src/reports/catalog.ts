export const reportDefinitions = [
  {
    "id": "inventory-core.report.01",
    "label": "Stock Ledger",
    "owningPlugin": "inventory-core",
    "source": "erpnext-parity",
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ]
  },
  {
    "id": "inventory-core.report.02",
    "label": "Stock Balance",
    "owningPlugin": "inventory-core",
    "source": "erpnext-parity",
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ]
  },
  {
    "id": "inventory-core.report.03",
    "label": "Projected Quantity",
    "owningPlugin": "inventory-core",
    "source": "erpnext-parity",
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ]
  },
  {
    "id": "inventory-core.report.04",
    "label": "Batch-Wise Balance History",
    "owningPlugin": "inventory-core",
    "source": "erpnext-parity",
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ]
  },
  {
    "id": "inventory-core.report.05",
    "label": "Warehouse Wise Item Balance Age and Value",
    "owningPlugin": "inventory-core",
    "source": "erpnext-parity",
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ]
  },
  {
    "id": "inventory-core.report.06",
    "label": "BOM Stock Report",
    "owningPlugin": "inventory-core",
    "source": "erpnext-parity",
    "exceptionQueues": [
      "negative-stock-blocks",
      "cycle-count-differences",
      "transfer-discrepancies",
      "valuation-reposting-review"
    ]
  }
] as const;
