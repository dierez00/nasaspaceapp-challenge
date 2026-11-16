import { describe, expect, it } from "vitest";
import {
  CopilotError,
  describeCopilotError,
  messageForStatus,
} from "@/modules/copilot/domain/errors";
import { resolveProbe } from "@/modules/atlas/domain/experiment";

describe("copilot error mapping", () => {
  it("keeps messages that are already user-safe", () => {
    expect(describeCopilotError(new CopilotError("Sin evidencia"))).toBe(
      "Sin evidencia",
    );
  });
  it("maps network failures without leaking technical text", () => {
    const message = describeCopilotError(
      new TypeError("Failed to fetch"),
      "es",
    );
    expect(message).not.toMatch(/fetch/i);
    expect(message).toMatch(/conexión/);
    expect(describeCopilotError(new TypeError("Failed to fetch"))).toMatch(
      /No connection/,
    );
  });
  it("maps unknown errors (malformed stream, schema) to a generic hint", () => {
    expect(
      describeCopilotError(new SyntaxError("Unexpected token"), "es"),
    ).toMatch(/incompleta/);
    expect(describeCopilotError("boom", "es")).toMatch(/incompleta/);
    expect(describeCopilotError("boom")).toMatch(/incomplete/);
  });
  it("gives actionable messages by HTTP status", () => {
    expect(messageForStatus(429, "es")).toMatch(/demasiadas/i);
    expect(messageForStatus(400, "es")).toMatch(/Reformúlala/);
    expect(messageForStatus(403, "es")).toMatch(/acceso/);
    expect(messageForStatus(500, "es")).toMatch(/no está disponible/);
    expect(messageForStatus(429)).toMatch(/too many/i);
    expect(messageForStatus(500)).toMatch(/unavailable/);
  });
});

describe("resolveProbe", () => {
  it("accepts and rounds points inside the lunar zone", () => {
    expect(resolveProbe(8.204, 34.126)).toEqual({
      ok: true,
      point: { pressure: 8.2, oxygen: 34.13 },
    });
    expect(resolveProbe(10.2, 30).ok).toBe(true);
  });
  it("rejects NaN and infinite values as invalid", () => {
    expect(resolveProbe(Number.NaN, 34)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(resolveProbe(8, Number.POSITIVE_INFINITY)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
  it("rejects points outside the lunar zone", () => {
    expect(resolveProbe(11, 34)).toEqual({ ok: false, reason: "out-of-zone" });
    expect(resolveProbe(5, 29.9)).toEqual({ ok: false, reason: "out-of-zone" });
    expect(resolveProbe(-1, 40)).toEqual({ ok: false, reason: "out-of-zone" });
  });
});
