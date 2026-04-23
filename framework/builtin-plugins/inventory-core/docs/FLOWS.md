# Inventory Core Flows

## Happy paths

- `inventory.receipts.record`: Record Inventory Receipt
- `inventory.reservations.allocate`: Allocate Reservation
- `inventory.transfers.request`: Request Stock Transfer

## Operational scenario matrix

- `receipt-to-putaway`
- `reservation-to-pick-pack-ship`
- `transfer-in-transit`
- `cycle-count-and-recount`

## Action-level flows

### `inventory.receipts.record`

Record Inventory Receipt

Permission: `inventory.stock-ledger.write`

Business purpose: Expose the plugin’s write boundary through a validated, auditable action contract.

Preconditions:

- Caller input must satisfy the action schema exported by the plugin.
- The caller must satisfy the declared permission and any host-level installation constraints.
- Integration should honor the action’s idempotent semantics.

Side effects:

- Mutates or validates state owned by `inventory.stock-ledger`, `inventory.reservations`, `inventory.transfers`.
- May schedule or describe follow-up background work.

Forbidden shortcuts:

- Do not bypass the action contract with undocumented service mutations in application code.
- Do not document extra hooks, retries, or lifecycle semantics unless they are explicitly exported here.


### `inventory.reservations.allocate`

Allocate Reservation

Permission: `inventory.reservations.write`

Business purpose: Expose the plugin’s write boundary through a validated, auditable action contract.

Preconditions:

- Caller input must satisfy the action schema exported by the plugin.
- The caller must satisfy the declared permission and any host-level installation constraints.
- Integration should honor the action’s non-idempotent semantics.

Side effects:

- Mutates or validates state owned by `inventory.stock-ledger`, `inventory.reservations`, `inventory.transfers`.
- May schedule or describe follow-up background work.

Forbidden shortcuts:

- Do not bypass the action contract with undocumented service mutations in application code.
- Do not document extra hooks, retries, or lifecycle semantics unless they are explicitly exported here.


### `inventory.transfers.request`

Request Stock Transfer

Permission: `inventory.transfers.write`

Business purpose: Expose the plugin’s write boundary through a validated, auditable action contract.

Preconditions:

- Caller input must satisfy the action schema exported by the plugin.
- The caller must satisfy the declared permission and any host-level installation constraints.
- Integration should honor the action’s non-idempotent semantics.

Side effects:

- Mutates or validates state owned by `inventory.stock-ledger`, `inventory.reservations`, `inventory.transfers`.
- May schedule or describe follow-up background work.

Forbidden shortcuts:

- Do not bypass the action contract with undocumented service mutations in application code.
- Do not document extra hooks, retries, or lifecycle semantics unless they are explicitly exported here.


## Cross-package interactions

- Direct dependencies: `auth-core`, `org-tenant-core`, `role-policy-core`, `audit-core`, `workflow-core`, `product-catalog-core`, `traceability-core`
- Requested capabilities: `ui.register.admin`, `api.rest.mount`, `data.write.inventory`, `events.publish.inventory`
- Integration model: Actions+Resources+Jobs+Workflows+UI
- ERPNext doctypes used as parity references: `Warehouse`, `Bin`, `Batch`, `Serial No`, `Stock Entry`, `Stock Reconciliation`, `Stock Ledger Entry`, `Stock Reservation Entry`, `Pick List`, `Packing Slip`, `Shipment`, `Landed Cost Voucher`
- Recovery ownership should stay with the host orchestration layer when the plugin does not explicitly export jobs, workflows, or lifecycle events.
