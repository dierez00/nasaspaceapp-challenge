import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/shared/lib/redirect";

describe("safeRedirectPath", () => {
  it("keeps local application paths", () => {
    expect(safeRedirectPath("/workspace/demo?tab=events")).toBe("/workspace/demo?tab=events");
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeRedirectPath("https://example.com", "/onboarding")).toBe("/onboarding");
    expect(safeRedirectPath("//example.com", "/onboarding")).toBe("/onboarding");
  });
});
