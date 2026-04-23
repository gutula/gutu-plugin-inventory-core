# Inventory Core TODO

**Maturity Tier:** `Hardened`

## Shipped Now

- Exports 7 governed actions: `inventory.receipts.record`, `inventory.reservations.allocate`, `inventory.transfers.request`, `inventory.receipts.hold`, `inventory.receipts.release`, `inventory.receipts.amend`, `inventory.receipts.reverse`.
- Owns 3 resource contracts: `inventory.stock-ledger`, `inventory.reservations`, `inventory.transfers`.
- Publishes 2 job definitions with explicit queue and retry policy metadata.
- Publishes 1 workflow definition with state-machine descriptions and mandatory steps.
- Adds richer admin workspace contributions on top of the base UI surface.
- Ships explicit SQL migration or rollback helpers alongside the domain model.
- Documents 8 owned entity surface(s): `Warehouse`, `Location`, `Stock Ledger`, `Reservation`, `Transfer`, `Pick Wave`, and more.
- Carries 6 report surface(s) and 4 exception queue(s) for operator parity and reconciliation visibility.
- Tracks ERPNext reference parity against module(s): `Stock`.
- Operational scenario matrix includes `receipt-to-putaway`, `reservation-to-pick-pack-ship`, `transfer-in-transit`, `cycle-count-and-recount`.
- Governs 3 settings or policy surface(s) for operator control and rollout safety.

## Current Gaps

- No additional gaps were identified beyond the plugin’s stated non-goals.

## Recommended Next

- Deepen warehouse execution, counting, and discrepancy handling before more downstream operational flows depend on inventory truth.
- Add stronger negative-stock, transfer, and quality-state enforcement where physical operations become denser.
- Broaden lifecycle coverage with deeper orchestration, reconciliation, and operator tooling where the business flow requires it.
- Add more explicit domain events or follow-up job surfaces when downstream systems need tighter coupling.
- Convert more ERP parity references into first-class runtime handlers where needed, starting from `Warehouse`, `Bin`, `Batch`.

## Later / Optional

- Outbound connectors, richer analytics, or portal-facing experiences once the core domain contracts harden.
