import { describe, expect, it } from "vitest";
import { tenantSlugPattern, toTenantSlug } from "@/shared/lib/slug";

describe("tenant slugs", () => {
  it("normalizes accents, spaces and punctuation", () => {
    expect(toTenantSlug("  Acme Studio — Mérida! ")).toBe("acme-studio-merida");
  });

  it("limits output and strips edge separators", () => {
    expect(toTenantSlug("---A---")).toBe("a");
    expect(toTenantSlug("a".repeat(80))).toHaveLength(48);
  });

  it("accepts only route-safe slugs of the database-supported length", () => {
    expect(tenantSlugPattern.test("mi-organizacion")).toBe(true);
    expect(tenantSlugPattern.test("ab")).toBe(false);
    expect(tenantSlugPattern.test("-incorrecto")).toBe(false);
  });
});
