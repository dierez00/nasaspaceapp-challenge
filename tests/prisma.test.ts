import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("allows importing database queries without database credentials", async () => {
  vi.stubEnv("DATABASE_URL", undefined);
  await expect(import("@/server/tenants/queries")).resolves.toBeDefined();
});

it("still requires database credentials when a client is requested", async () => {
  vi.stubEnv("DATABASE_URL", undefined);
  const { getPrisma } = await import("@/server/db/prisma");
  expect(() => getPrisma()).toThrow(/DATABASE_URL/);
});
