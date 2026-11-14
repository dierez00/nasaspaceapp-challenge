import { describe, expect, it } from "vitest";
import { siteConfig } from "@/shared/config/site";

describe("site configuration", () => {
  it("provides the reusable application identity", () => {
    expect(siteConfig.name).toBe("Plantilla");
    expect(siteConfig.healthService).toBe("plantilla");
    expect(siteConfig.description.length).toBeGreaterThan(20);
  });
});
