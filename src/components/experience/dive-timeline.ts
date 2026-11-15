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
  /** The whiteout midpoint: the surfaces swap here, hidden behind the veil. */
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

/** ~2.2 s: window opens around you, the Moon rushes in, light blooms, the deck resolves. */
export function buildDive({ root, dive, onPeak, onDone }: Options, reduced: boolean) {
  const l = layers(root);
  gsap.set(l.deck, { opacity: 0 });

  if (reduced) {
    return gsap
      .timeline({ onComplete: onDone })
      .to(l.cabin, { opacity: 0, duration: 0.3, ease: "none" }, 0)
      .to(l.deck, { opacity: 1, duration: 0.3, ease: "none" }, 0)
      .call(onPeak, [], 0.15);
  }

  gsap.set(l.deck, { scale: 1.03 });
  gsap.set([l.frame, l.flame, l.bloom], { willChange: "transform, opacity" });

  return gsap
    .timeline({
      onComplete: () => {
        gsap.set([l.frame, l.flame, l.bloom], { willChange: "auto" });
        onDone();
      },
    })
    // 1. Press feedback, then the copy lets go of the glass.
    .to(l.cta, { scale: 0.95, duration: 0.1, ease: "power2.out" }, 0)
    .to(l.copy, { opacity: 0, y: -16, duration: 0.42, ease: "power2.out" }, 0.05)
    .to(l.cta, { opacity: 0, duration: 0.3, ease: "power2.out" }, 0.12)
    // 2. The cupola frame sweeps past the camera while the Moon dollies in.
    .to(l.frame, { scale: 2.9, duration: 1.4, ease: "power2.in" }, 0)
    .to(l.frame, { opacity: 0, duration: 0.2, ease: "none" }, 1.2)
    .to(dive, { p: 1, duration: 1.5, ease: "power2.in" }, 0)
    .to(l.flame, { scale: 3, opacity: 0, duration: 0.9, ease: "power2.in" }, 0.25)
    // 3. Light spills through the window and washes the frame out in Moon Dust.
    .fromTo(
      l.bloom,
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1.9, duration: 0.6, ease: "power2.out" },
      0.82,
    )
    .to(l.veil, { opacity: 1, duration: 0.25, ease: "power1.in" }, 1.3)
    .call(onPeak, [], 1.55)
    // 4. The light drains away and the dark console is already there behind it,
    //    its lit screens switching on as the whiteout clears.
    .set(l.deck, { opacity: 1 }, 1.55)
    .to(l.deck, { scale: 1, duration: 0.7, ease: easeOut }, 1.55)
    .to([l.veil, l.bloom], { opacity: 0, duration: 0.7, ease: easeOut }, 1.55);
}

/** ~0.65 s: a short wash of light, then the cabin settles back into place. */
export function buildReturn({ root, dive, onPeak, onDone }: Options, reduced: boolean) {
  const l = layers(root);

  if (reduced) {
    gsap.set(l.cabin, { opacity: 0 });
    return gsap
      .timeline({ onComplete: onDone })
      .to(l.cabin, { opacity: 1, duration: 0.3, ease: "none" }, 0)
      .to(l.deck, { opacity: 0, duration: 0.3, ease: "none" }, 0)
      .call(onPeak, [], 0.15);
  }

  // Cabin starts "already close", hidden under the deck, and eases back out.
  dive.p = 0.4;
  gsap.set(l.frame, { scale: 1.5, opacity: 0 });
  gsap.set([l.copy, l.cta], { opacity: 0, y: 14 });
  gsap.set(l.flame, { scale: 1.6, opacity: 0 });
  gsap.set([l.frame, l.flame], { willChange: "transform, opacity" });

  return gsap
    .timeline({
      onComplete: () => {
        gsap.set([l.frame, l.flame], { willChange: "auto" });
        onDone();
      },
    })
    .to(l.veil, { opacity: 1, duration: 0.2, ease: "power1.in" }, 0)
    .to(l.deck, { opacity: 0, scale: 0.985, duration: 0.2, ease: "power1.in" }, 0)
    .call(onPeak, [], 0.2)
    .to(l.veil, { opacity: 0, duration: 0.42, ease: easeOut }, 0.2)
    .to(l.frame, { scale: 1, opacity: 1, duration: 0.55, ease: easeOut }, 0.2)
    .to(dive, { p: 0, duration: 0.55, ease: easeOut }, 0.2)
    .to(l.flame, { scale: 1, opacity: 1, duration: 0.5, ease: easeOut }, 0.24)
    .to([l.copy, l.cta], { opacity: 1, y: 0, duration: 0.45, ease: easeOut, stagger: 0.06 }, 0.3);
}
