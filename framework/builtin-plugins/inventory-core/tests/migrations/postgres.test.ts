import { describe, expect, it } from "bun:test";

import {
  buildInventoryCoreMigrationSql,
  buildInventoryCoreRollbackSql,
  getInventoryCoreLookupIndexName,
  getInventoryCoreStatusIndexName
} from "../../src/postgres";

describe("inventory-core postgres helpers", () => {
  it("creates the business tables and indexes", () => {
    const sql = buildInventoryCoreMigrationSql().join("\n");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS inventory_core.primary_records");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS inventory_core.secondary_records");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS inventory_core.exception_records");
    expect(sql).toContain(getInventoryCoreLookupIndexName());
    expect(sql).toContain(getInventoryCoreStatusIndexName());
  });

  it("rolls the schema back safely", () => {
    const sql = buildInventoryCoreRollbackSql({ schemaName: "inventory_core_preview", dropSchema: true }).join("\n");
    expect(sql).toContain("DROP TABLE IF EXISTS inventory_core_preview.exception_records");
    expect(sql).toContain("DROP SCHEMA IF EXISTS inventory_core_preview CASCADE");
  });
});
