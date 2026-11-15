// Window events emitted by the hero 3D backdrop so the loading screen can follow real
// texture progress without importing three.js itself.
export const HERO_LOAD_PROGRESS_EVENT = "atlas:hero-load-progress";

export interface HeroLoadProgressDetail {
  /** Texture load progress, 0 to 100. */
  percent: number;
}

export function emitHeroLoadProgress(percent: number) {
  window.dispatchEvent(
    new CustomEvent<HeroLoadProgressDetail>(HERO_LOAD_PROGRESS_EVENT, {
      detail: { percent },
    })
  );
}
