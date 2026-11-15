import gsap from "gsap";

// Imperative choreography for the cabin <-> deck transitions. Everything animates
// transform/opacity (plus the 3D camera through `dive.p`). The shell passes the root
// that contains the `data-layer` nodes and callbacks for the React state hand-offs.

export interface DiveState {
  /** 0 = resting camera, 1 = skimming the Moon. Read by the 3D backdrop each frame. */
  p: number;
}

interface Options {
  root: HTMLElement;
  dive: DiveState;
  /** The overlapping crossfade midpoint: rendering passes to the incoming surface. */
  onPeak: () => void;
  onDone: () => void;
}

/** The theme's `--ease-out` (cubic-bezier(0.16, 1, 0.3, 1)) as a GSAP ease function. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= err / slope;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

export const easeOut = cubicBezier(0.16, 1, 0.3, 1);

const layer = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-layer="${name}"]`)!;

function layers(root: HTMLElement) {
  return {
    cabin: layer(root, "cabin"),
    frame: layer(root, "frame"),
    copy: layer(root, "copy"),
    flame: layer(root, "flame"),
    cta: layer(root, "cta"),
    bloom: layer(root, "bloom"),
    veil: layer(root, "veil"),
    deck: layer(root, "deck"),
  };
}

/** Removes every inline style GSAP left on the cabin so CSS owns the resting state. */
export function resetCabin(root: HTMLElement, dive: DiveState) {
  const l = layers(root);
  gsap.set([l.cabin, l.frame, l.copy, l.flame, l.cta, l.bloom, l.veil], {
    clearProps: "all",
  });
  dive.p = 0;
}

export function resetDeck(root: HTMLElement) {
  gsap.set(layers(root).deck, { clearProps: "opacity,transform,willChange" });
}

/** One continuous dark environment. The incoming instrument is the only lead. */
export function buildDive(
  { root, dive, onPeak, onDone }: Options,
  reduced: boolean,
) {
  const l = layers(root);
  gsap.set(l.deck, { opacity: 0 });
  const duration = reduced ? 0.2 : 0.7;
  return gsap
    .timeline({ onComplete: onDone })
    .to(l.cabin, { opacity: 0, duration, ease: "none" }, 0)
    .to(l.deck, { opacity: 1, duration, ease: "none" }, 0)
    .to(dive, { p: reduced ? 0 : 0.12, duration, ease: easeOut }, 0)
    .call(onPeak, [], duration / 2);
}

/** Return through the same darkness; no white veil or decorative afterimage. */
export function buildReturn(
  { root, dive, onPeak, onDone }: Options,
  reduced: boolean,
) {
  const l = layers(root);
  const duration = reduced ? 0.2 : 0.35;
  gsap.set(l.cabin, { opacity: 0 });
  return gsap
    .timeline({ onComplete: onDone })
    .to(l.cabin, { opacity: 1, duration, ease: "none" }, 0)
    .to(l.deck, { opacity: 0, duration, ease: "none" }, 0)
    .to(dive, { p: 0, duration, ease: easeOut }, 0)
    .call(onPeak, [], duration / 2);
}
