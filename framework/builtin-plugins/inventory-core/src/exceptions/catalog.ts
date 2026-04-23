export const exceptionQueueDefinitions = [
  {
    "id": "negative-stock-blocks",
    "label": "Negative Stock Blocks",
    "severity": "medium",
    "owner": "warehouse",
    "reconciliationJobId": "inventory.reconciliation.run"
  },
  {
    "id": "cycle-count-differences",
    "label": "Cycle Count Differences",
    "severity": "medium",
    "owner": "warehouse",
    "reconciliationJobId": "inventory.reconciliation.run"
  },
  {
    "id": "transfer-discrepancies",
    "label": "Transfer Discrepancies",
    "severity": "medium",
    "owner": "warehouse",
    "reconciliationJobId": "inventory.reconciliation.run"
  },
  {
    "id": "valuation-reposting-review",
    "label": "Valuation Reposting Review",
    "severity": "medium",
    "owner": "warehouse",
    "reconciliationJobId": "inventory.reconciliation.run"
  }
] as const;
