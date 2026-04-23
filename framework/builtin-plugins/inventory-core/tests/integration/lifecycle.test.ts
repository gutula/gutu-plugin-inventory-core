import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  advancePrimaryRecord,
  amendPrimaryRecord,
  createPrimaryRecord,
  placePrimaryRecordOnHold,
  getBusinessOverview,
  listExceptionRecords,
  listDeadLetters,
  listPendingDownstreamItems,
  listProjectionRecords,
  listPrimaryRecords,
  listSecondaryRecords,
  failPendingDownstreamItem,
  replayDeadLetter,
  releasePrimaryRecordHold,
  resolvePendingDownstreamItem,
  reconcilePrimaryRecord,
  reversePrimaryRecord
} from "../../src/services/main.service";

describe("inventory-core lifecycle integration", () => {
  const previousStateDir = process.env.GUTU_STATE_DIR;
  let stateDir = "";

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "inventory-core-"));
    process.env.GUTU_STATE_DIR = stateDir;
  });

  afterEach(() => {
    if (previousStateDir === undefined) {
      delete process.env.GUTU_STATE_DIR;
    } else {
      process.env.GUTU_STATE_DIR = previousStateDir;
    }
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("creates, advances, and reconciles a governed business record", async () => {
    const created = await createPrimaryRecord({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo",
      title: "Inventory Core Demo",
      counterpartyId: "party_demo",
      companyId: "company_demo",
      branchId: "branch_demo",
      amountMinor: 4200,
      currencyCode: "USD",
      effectiveAt: "2026-04-23T00:00:00.000Z",
      correlationId: "inventory-core:corr",
      processId: "inventory-movement-lifecycle:demo"
    });

    expect(created.recordState).toBe("active");
    expect(created.approvalState).toBe("pending");
    expect(created.revisionNo).toBe(1);

    const advanced = await advancePrimaryRecord({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo",
      expectedRevisionNo: 1,
      approvalState: "approved",
      postingState: "posted",
      fulfillmentState: "partial",
      downstreamRef: "downstream:1"
    });

    expect(advanced.approvalState).toBe("approved");
    expect(advanced.postingState).toBe("posted");
    expect(advanced.revisionNo).toBe(2);
    expect((await listSecondaryRecords()).length).toBeGreaterThan(0);
    const pendingAfterAdvance = await listPendingDownstreamItems();
    expect(pendingAfterAdvance.length).toBeGreaterThan(0);

    const failed = await failPendingDownstreamItem({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      inboxId: pendingAfterAdvance[0]?.id as string,
      error: "downstream-unavailable",
      maxAttempts: 1
    });

    expect(failed.status).toBe("dead-letter");
    const deadLetters = await listDeadLetters();
    expect(deadLetters).toHaveLength(1);

    const replayed = await replayDeadLetter({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      deadLetterId: deadLetters[0]?.id as string
    });

    expect(replayed.status).toBe("retrying");

    const reconciled = await reconcilePrimaryRecord({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo",
      exceptionId: "inventory-core:exception",
      expectedRevisionNo: 2,
      severity: "medium",
      reasonCode: "follow-up-required",
      downstreamRef: "repair:1"
    });

    expect(reconciled.status).toBe("open");
    expect(reconciled.revisionNo).toBe(3);
    for (const item of await listPendingDownstreamItems()) {
      await resolvePendingDownstreamItem({
        tenantId: "tenant_demo",
        actorId: "actor_admin",
        inboxId: item.id,
        resolutionRef: `resolved:${item.target}`
      });
    }

    const held = await placePrimaryRecordOnHold({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo",
      expectedRevisionNo: 3,
      reasonCode: "manual-hold"
    });
    expect(held.status).toBe("open");

    const released = await releasePrimaryRecordHold({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo",
      expectedRevisionNo: 4,
      reasonCode: "manual-release"
    });
    expect(released.status).toBe("closed");

    const amended = await amendPrimaryRecord({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo",
      amendedRecordId: "inventory-core:demo:amended",
      expectedRevisionNo: 5,
      title: "Inventory Core Demo Amendment",
      reasonCode: "commercial-correction"
    });
    expect(amended.amendedRecordId).toBe("inventory-core:demo:amended");

    const reversed = await reversePrimaryRecord({
      tenantId: "tenant_demo",
      actorId: "actor_admin",
      recordId: "inventory-core:demo:amended",
      reversalRecordId: "inventory-core:demo:amended:reversal",
      expectedRevisionNo: 1,
      reasonCode: "cancel-amendment"
    });
    expect(reversed.reversalRecordId).toBe("inventory-core:demo:amended:reversal");

    for (const item of await listPendingDownstreamItems()) {
      await resolvePendingDownstreamItem({
        tenantId: "tenant_demo",
        actorId: "actor_admin",
        inboxId: item.id,
        resolutionRef: `resolved:${item.target}`
      });
    }

    expect((await listPrimaryRecords()).length).toBeGreaterThanOrEqual(4);
    expect((await listExceptionRecords()).length).toBeGreaterThanOrEqual(1);
    expect((await listProjectionRecords()).length).toBeGreaterThanOrEqual(5);
    expect(await listPendingDownstreamItems()).toHaveLength(0);
    expect((await getBusinessOverview()).totals.openExceptions).toBe(0);
    expect((await getBusinessOverview()).orchestration.deadLetters).toBe(0);
  });
});
