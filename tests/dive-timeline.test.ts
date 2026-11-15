import { beforeEach, expect, it, vi } from "vitest";
const recording = vi.hoisted(() => ({
  moves: [] as {
    target: { layer?: string };
    values: Record<string, unknown>;
  }[],
  callbacks: [] as number[],
}));
vi.mock("gsap", () => ({
  default: {
    set: vi.fn(),
    timeline: () => {
      const timeline = {
        to: (target: { layer?: string }, values: Record<string, unknown>) => {
          recording.moves.push({ target, values });
          return timeline;
        },
        call: (_callback: () => void, _args: unknown[], at: number) => {
          recording.callbacks.push(at);
          return timeline;
        },
      };
      return timeline;
    },
  },
}));
import { buildDive, buildReturn } from "@/components/experience/dive-timeline";
beforeEach(() => {
  recording.moves = [];
  recording.callbacks = [];
});
const root = {
  querySelector: (selector: string) => ({ layer: selector }),
} as unknown as HTMLElement;
it("crossfades through darkness in under a second without a veil, bloom or scaled canvas ancestor", () => {
  buildDive({ root, dive: { p: 0 }, onPeak() {}, onDone() {} }, false);
  expect(recording.moves).toHaveLength(3);
  expect(
    recording.moves.every(
      ({ target, values }) =>
        !/veil|bloom/.test(target.layer ?? "") && !values.scale,
    ),
  ).toBe(true);
  expect(
    recording.moves.every(({ values }) => Number(values.duration) <= 0.7),
  ).toBe(true);
  expect(recording.callbacks).toEqual([0.35]);
});
it("removes camera movement for reduced motion and keeps a short return", () => {
  buildDive({ root, dive: { p: 0 }, onPeak() {}, onDone() {} }, true);
  expect(recording.moves.at(-1)?.values.p).toBe(0);
  expect(recording.moves[0].values.duration).toBe(0.2);
  recording.moves = [];
  buildReturn({ root, dive: { p: 0.12 }, onPeak() {}, onDone() {} }, false);
  expect(
    recording.moves.every(({ values }) => Number(values.duration) <= 0.35),
  ).toBe(true);
});
