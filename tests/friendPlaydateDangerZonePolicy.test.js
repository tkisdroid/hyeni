import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260505000000_exclude_danger_zones_from_playdate.sql";
const downMigrationPath = "supabase/migrations/down/20260505000000_exclude_danger_zones_from_playdate.sql";

describe("friend playdate danger-zone exclusion migration", () => {
  test("excludes danger-zone-overlapping safe places from candidate matching", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(downMigrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.find_playdate_candidates");
    expect(migration).toContain("NOT EXISTS");
    expect(migration).toContain("public.danger_zones");
    expect(migration).toContain("COALESCE(dz.radius_m, 200)");
    expect(migration).toContain("other_dz");
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("COMMIT;");
  });
});
