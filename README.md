# Inventory Core

<p align="center">
  <img src="./docs/assets/gutu-mascot.png" alt="Gutu mascot" width="220" />
</p>

Warehouse truth, stock ledger state, reservation visibility, transfer execution, and physical reconciliation for inventory-controlled operations.

![Maturity: Hardened](https://img.shields.io/badge/Maturity-Hardened-2563eb) ![Verification: Build+Typecheck+Lint+Test+Contracts+Migrations+Integration](https://img.shields.io/badge/Verification-Build%2BTypecheck%2BLint%2BTest%2BContracts%2BMigrations%2BIntegration-2563eb) ![DB: postgres+sqlite](https://img.shields.io/badge/DB-postgres%2Bsqlite-2563eb) ![Integration Model: Actions+Resources+Jobs+Workflows+UI](https://img.shields.io/badge/Integration%20Model-Actions%2BResources%2BJobs%2BWorkflows%2BUI-2563eb)

## Part Of The Gutu Stack

| Aspect | Value |
| --- | --- |
| Repo kind | First-party plugin |
| Domain group | Operational Data |
| Default category | Business / Inventory & Warehouse |
| Primary focus | stock truth, reservations, movement reconciliation |
| Best when | You need a governed domain boundary with explicit contracts and independent release cadence. |
| Composes through | Actions+Resources+Jobs+Workflows+UI |

- Gutu keeps plugins as independent repos with manifest-governed boundaries, compatibility channels, and verification lanes instead of hiding everything behind one giant mutable codebase.
- This plugin is meant to compose through explicit actions, resources, jobs, workflows, and runtime envelopes, not through undocumented hook chains.

## What It Does Now

Owns physical stock, reservations, transfers, and reconciliation state so warehouse truth remains explicit and durable.

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

## Maturity

**Maturity Tier:** `Hardened`

This tier is justified because unit coverage exists, contract coverage exists, integration coverage exists, migration coverage exists, job definitions are exported, and workflow definitions are exported.

## Verified Capability Summary

- Domain group: **Operational Data**
- Default category: **Business / Inventory & Warehouse**
- Verification surface: **Build+Typecheck+Lint+Test+Contracts+Migrations+Integration**
- Tests discovered: **5** total files across unit, contract, integration, migration lanes
- Integration model: **Actions+Resources+Jobs+Workflows+UI**
- Database support: **postgres + sqlite**

## Dependency And Compatibility Summary

| Field | Value |
| --- | --- |
| Package | `@plugins/inventory-core` |
| Manifest ID | `inventory-core` |
| Repo | [gutu-plugin-inventory-core](https://github.com/gutula/gutu-plugin-inventory-core) |
| Depends On | `auth-core`, `org-tenant-core`, `role-policy-core`, `audit-core`, `workflow-core`, `product-catalog-core`, `traceability-core` |
| Requested Capabilities | `ui.register.admin`, `api.rest.mount`, `data.write.inventory`, `events.publish.inventory` |
| Provided Capabilities | `inventory.stock-ledger`, `inventory.reservations`, `inventory.transfers` |
| Runtime | bun>=1.3.12 |
| Database | postgres, sqlite |
| Integration Model | Actions+Resources+Jobs+Workflows+UI |

## Capability Matrix

| Surface | Count | Details |
| --- | --- | --- |
| Actions | 7 | `inventory.receipts.record`, `inventory.reservations.allocate`, `inventory.transfers.request`, `inventory.receipts.hold`, `inventory.receipts.release`, `inventory.receipts.amend`, `inventory.receipts.reverse` |
| Resources | 3 | `inventory.stock-ledger`, `inventory.reservations`, `inventory.transfers` |
| Jobs | 2 | `inventory.projections.refresh`, `inventory.reconciliation.run` |
| Workflows | 1 | `inventory-movement-lifecycle` |
| UI | Present | base UI surface, admin contributions |
| Owned Entities | 8 | `Warehouse`, `Location`, `Stock Ledger`, `Reservation`, `Transfer`, `Pick Wave`, `Batch or Serial Genealogy`, `Valuation Layer` |
| Reports | 6 | `Stock Ledger`, `Stock Balance`, `Projected Quantity`, `Batch-Wise Balance History`, `Warehouse Wise Item Balance Age and Value`, `BOM Stock Report` |
| Exception Queues | 4 | `negative-stock-blocks`, `cycle-count-differences`, `transfer-discrepancies`, `valuation-reposting-review` |
| Operational Scenarios | 4 | `receipt-to-putaway`, `reservation-to-pick-pack-ship`, `transfer-in-transit`, `cycle-count-and-recount` |
| Settings Surfaces | 3 | `Stock Settings`, `Delivery Settings`, `Putaway Rule` |
| ERPNext Refs | 1 | `Stock` |

## Quick Start For Integrators

Use this repo inside a **compatible Gutu workspace** or the **ecosystem certification workspace** so its `workspace:*` dependencies resolve honestly.

```bash
# from a compatible workspace that already includes this plugin's dependency graph
bun install
bun run build
bun run test
bun run docs:check
```

```ts
import { manifest, recordInventoryReceiptAction, BusinessPrimaryResource, jobDefinitions, workflowDefinitions, adminContributions, uiSurface } from "@plugins/inventory-core";

console.log(manifest.id);
console.log(recordInventoryReceiptAction.id);
console.log(BusinessPrimaryResource.id);
```

Use the root repo scripts for day-to-day work **after the workspace is bootstrapped**, or run the nested package directly from `framework/builtin-plugins/inventory-core` if you need lower-level control.

## Current Test Coverage

- Root verification scripts: `bun run build`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:contracts`, `bun run test:unit`, `bun run test:integration`, `bun run test:migrations`, `bun run docs:check`
- Unit files: 1
- Contracts files: 1
- Integration files: 1
- Migrations files: 2

## Known Boundaries And Non-Goals

- Not a full vertical application suite; this plugin only owns the domain slice exported in this repo.
- Not a replacement for explicit orchestration in jobs/workflows when multi-step automation is required.
- Cross-plugin composition should use Gutu command, event, job, and workflow primitives. This repo should not be documented as exposing a generic WordPress-style hook system unless one is explicitly exported.

## Recommended Next Milestones

- Deepen warehouse execution, counting, and discrepancy handling before more downstream operational flows depend on inventory truth.
- Add stronger negative-stock, transfer, and quality-state enforcement where physical operations become denser.
- Broaden lifecycle coverage with deeper orchestration, reconciliation, and operator tooling where the business flow requires it.
- Add more explicit domain events or follow-up job surfaces when downstream systems need tighter coupling.
- Convert more ERP parity references into first-class runtime handlers where needed, starting from `Warehouse`, `Bin`, `Batch`.

## More Docs

See [DEVELOPER.md](./DEVELOPER.md), [TODO.md](./TODO.md), [SECURITY.md](./SECURITY.md), [CONTRIBUTING.md](./CONTRIBUTING.md). The internal domain sources used to build those docs live under:

- `plugins/gutu-plugin-inventory-core/framework/builtin-plugins/inventory-core/docs/AGENT_CONTEXT.md`
- `plugins/gutu-plugin-inventory-core/framework/builtin-plugins/inventory-core/docs/BUSINESS_RULES.md`
- `plugins/gutu-plugin-inventory-core/framework/builtin-plugins/inventory-core/docs/EDGE_CASES.md`
- `plugins/gutu-plugin-inventory-core/framework/builtin-plugins/inventory-core/docs/FLOWS.md`
- `plugins/gutu-plugin-inventory-core/framework/builtin-plugins/inventory-core/docs/GLOSSARY.md`
- `plugins/gutu-plugin-inventory-core/framework/builtin-plugins/inventory-core/docs/MANDATORY_STEPS.md`
