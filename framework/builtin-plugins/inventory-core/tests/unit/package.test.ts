import { describe, expect, it } from "bun:test";
import { domainCatalog } from "../../src/domain/catalog";
import { exceptionQueueDefinitions } from "../../src/exceptions/catalog";
import { businessFlowDefinitions, recordInventoryReceipt, allocateReservation, requestStockTransfer } from "../../src/flows/catalog";
import { reportDefinitions } from "../../src/reports/catalog";
import { scenarioDefinitions } from "../../src/scenarios/catalog";
import { settingsSurfaceDefinitions } from "../../src/settings/catalog";
import manifest from "../../package";

describe("plugin manifest", () => {
  it("keeps a stable package id and business contract surface", () => {
    expect(manifest.id).toBe("inventory-core");
    expect(manifest.kind).toBe("plugin");
    expect(manifest.publicCommands).toContain("inventory.receipts.record");
    expect(manifest.publicEvents).toContain("inventory.receipt-recorded.v1");
  });
});

describe("domain catalog", () => {
  it("keeps ERPNext parity references and operational surfaces visible", () => {
    expect(domainCatalog.ownedEntities.length).toBeGreaterThan(0);
    expect(domainCatalog.reports.length).toBeGreaterThan(0);
    expect(domainCatalog.exceptionQueues.length).toBeGreaterThan(0);
    expect(domainCatalog.operationalScenarios.length).toBeGreaterThan(0);
    expect(reportDefinitions).toHaveLength(domainCatalog.reports.length);
    expect(exceptionQueueDefinitions).toHaveLength(domainCatalog.exceptionQueues.length);
    expect(scenarioDefinitions).toHaveLength(domainCatalog.operationalScenarios.length);
    expect(settingsSurfaceDefinitions).toHaveLength(domainCatalog.settingsSurfaces.length);
    expect(businessFlowDefinitions).toHaveLength(manifest.publicCommands.length);
    expect(typeof recordInventoryReceipt).toBe("function");
    expect(typeof allocateReservation).toBe("function");
    expect(typeof requestStockTransfer).toBe("function");
  });
});
