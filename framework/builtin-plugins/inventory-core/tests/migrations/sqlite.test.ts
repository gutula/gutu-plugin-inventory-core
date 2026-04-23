import { describe, expect, it } from "bun:test";

import {
  buildInventoryCoreSqliteMigrationSql,
  buildInventoryCoreSqliteRollbackSql,
  getInventoryCoreSqliteLookupIndexName,
  getInventoryCoreSqliteStatusIndexName
} from "../../src/sqlite";

describe("inventory-core sqlite helpers", () => {
  it("creates the business tables and indexes", () => {
    const sql = buildInventoryCoreSqliteMigrationSql().join("\n");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS inventory_core_primary_records");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS inventory_core_secondary_records");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS inventory_core_exception_records");
    expect(sql).toContain(getInventoryCoreSqliteLookupIndexName("inventory_core_"));
    expect(sql).toContain(getInventoryCoreSqliteStatusIndexName("inventory_core_"));
  });

  it("rolls the sqlite tables back safely", () => {
    const sql = buildInventoryCoreSqliteRollbackSql({ tablePrefix: "inventory_core_preview_" }).join("\n");
    expect(sql).toContain("DROP TABLE IF EXISTS inventory_core_preview_exception_records");
  });
});
