# Inventory Core Business Rules

## Invariants

- The plugin remains authoritative only for the data declared in `inventory-core` and its owned resource set.
- Integrators must respect the declared permission and idempotency semantics of each exported action.
- Cross-plugin automation must use explicit commands, resources, jobs, or workflows instead of hidden coupling.
- ERP parity references are tracked against: `Stock`.

## Lifecycle notes

- This plugin currently exports 3 action(s), 3 resource(s), 2 job definition(s), and 1 workflow definition(s).
- The domain catalog currently tracks 8 owned entity surface(s), 6 report surface(s), and 4 exception queue(s).
- Durable data behavior is bounded by the declared schema and compatibility contract: postgres, sqlite.
- Maturity is currently assessed as `Hardened`, which means the documentation and operational promises must stay within that boundary.

## Settings and governance surfaces

- `Stock Settings`
- `Delivery Settings`
- `Putaway Rule`

## Actor expectations

- Host applications own installation, manifest solving, and runtime registration.
- Operators and automation should invoke exported actions or follow the job/workflow catalog instead of mutating state ad hoc.
- Contributors should keep README, DEVELOPER, TODO, and nested docs synchronized whenever the public contract changes.

## Decision boundaries

- Safe retries are only those already supported by the action/job semantics documented in this repo.
- Human or operator review is still expected whenever the exported surface does not provide an explicit automation contract.
- Future roadmap ideas belong in the recommended-next section, not in current-capability claims.
