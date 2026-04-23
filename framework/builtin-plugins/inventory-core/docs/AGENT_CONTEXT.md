# Inventory Core Agent Context

## Mission

Owns physical stock, reservations, transfers, and reconciliation state so warehouse truth remains explicit and durable.

## Code map

- Package root: `framework/builtin-plugins/inventory-core`
- Service layer: `framework/builtin-plugins/inventory-core/src/services/main.service.ts`
- Action layer: `framework/builtin-plugins/inventory-core/src/actions/default.action.ts`
- Resource layer: `framework/builtin-plugins/inventory-core/src/resources/main.resource.ts`
- UI layer: `framework/builtin-plugins/inventory-core/src/ui`

## Safe assumptions

- Use `inventory-core` as the stable plugin identifier and `@plugins/inventory-core` as the package import name.
- Treat declared actions and resources as the public integration surface before reaching into services.
- Prefer explicit command, event, job, and workflow orchestration over undocumented side effects.

## Forbidden claims

- Do not document generic WordPress-style hooks unless they are explicitly exported.
- Do not promise live external connectors, distributed worker infrastructure, or portal/admin surfaces that are not present in the code.
- Do not claim a higher maturity tier than `Hardened` without adding the missing verification and operational depth first.

## Verification

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run test:contracts`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:migrations`
- `bun run docs:check`
