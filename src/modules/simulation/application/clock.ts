export type ClockSnapshot = { time: number; playing: boolean };
/** Shared simulation time. No wall-clock jump after a hidden tab or pause. */
export class SimulationClock {
  time = 0;
  playing = false;
  private published: ClockSnapshot = { time: 0, playing: false };
  private listeners = new Set<() => void>();
  private elapsedSincePublish = 0;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.published;
  private publish() {
    this.published = { time: this.time, playing: this.playing };
    this.listeners.forEach((listener) => listener());
  }
  play() {
    if (this.time >= 8) this.time = 0;
    this.playing = true;
    this.publish();
  }
  pause() {
    this.playing = false;
    this.publish();
  }
  seek(time: number) {
    this.time = Math.max(0, Math.min(8, time));
    if (this.time === 8) this.playing = false;
    this.publish();
  }
  restart(play: boolean) {
    this.time = 0;
    this.playing = play;
    this.publish();
  }
  step(delta: number) {
    if (!this.playing) return;
    const next = this.time + Math.min(delta, 0.1);
    const wrapped = next >= 8;
    this.time = next % 8;
    this.elapsedSincePublish += delta;
    if (this.elapsedSincePublish >= 0.1 || wrapped) {
      this.elapsedSincePublish = 0;
      this.publish();
    }
  }
}
