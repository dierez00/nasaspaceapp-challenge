import { afterEach, describe, expect, it } from "vitest";
import { getPublicEnv } from "@/shared/config/env";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });

describe("public environment", () => {
  it("accepts a valid Supabase configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-key";
    expect(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("rejects missing public credentials", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(() => getPublicEnv()).toThrow();
  });
});
