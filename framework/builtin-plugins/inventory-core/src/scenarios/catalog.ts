export const scenarioDefinitions = [
  {
    "id": "receipt-to-putaway",
    "owningPlugin": "inventory-core",
    "workflowId": "inventory-movement-lifecycle",
    "actionIds": [
      "inventory.receipts.record",
      "inventory.reservations.allocate",
      "inventory.transfers.request",
      "inventory.receipts.hold",
      "inventory.receipts.release",
      "inventory.receipts.amend",
      "inventory.receipts.reverse"
    ],
    "downstreamTargets": {
      "create": [],
      "advance": [
        "traceability.links.record"
      ],
      "reconcile": [
        "traceability.reconciliation.queue"
      ]
    }
  },
  {
    "id": "reservation-to-pick-pack-ship",
    "owningPlugin": "inventory-core",
    "workflowId": "inventory-movement-lifecycle",
    "actionIds": [
      "inventory.receipts.record",
      "inventory.reservations.allocate",
      "inventory.transfers.request",
      "inventory.receipts.hold",
      "inventory.receipts.release",
      "inventory.receipts.amend",
      "inventory.receipts.reverse"
    ],
    "downstreamTargets": {
      "create": [],
      "advance": [
        "traceability.links.record"
      ],
      "reconcile": [
        "traceability.reconciliation.queue"
      ]
    }
  },
  {
    "id": "transfer-in-transit",
    "owningPlugin": "inventory-core",
    "workflowId": "inventory-movement-lifecycle",
    "actionIds": [
      "inventory.receipts.record",
      "inventory.reservations.allocate",
      "inventory.transfers.request",
      "inventory.receipts.hold",
      "inventory.receipts.release",
      "inventory.receipts.amend",
      "inventory.receipts.reverse"
    ],
    "downstreamTargets": {
      "create": [],
      "advance": [
        "traceability.links.record"
      ],
      "reconcile": [
        "traceability.reconciliation.queue"
      ]
    }
  },
  {
    "id": "cycle-count-and-recount",
    "owningPlugin": "inventory-core",
    "workflowId": "inventory-movement-lifecycle",
    "actionIds": [
      "inventory.receipts.record",
      "inventory.reservations.allocate",
      "inventory.transfers.request",
      "inventory.receipts.hold",
      "inventory.receipts.release",
      "inventory.receipts.amend",
      "inventory.receipts.reverse"
    ],
    "downstreamTargets": {
      "create": [],
      "advance": [
        "traceability.links.record"
      ],
      "reconcile": [
        "traceability.reconciliation.queue"
      ]
    }
  }
] as const;
