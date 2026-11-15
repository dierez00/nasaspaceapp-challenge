import { describe, expect, it } from "vitest";
import { siteConfig } from "@/shared/config/site";

describe("site configuration", () => {
  it("provides the Atlas application identity", () => {
    expect(siteConfig.name).toBe("Atlas del Fuego Lunar");
    expect(siteConfig.healthService).toBe("atlas-frontend");
    expect(siteConfig.description.length).toBeGreaterThan(20);
  });
});
