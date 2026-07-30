import type { Container, Ticker } from "pixi.js";

export class Camera {
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeStrength = 0;
  private elapsed = 0;

  constructor(private readonly world: Container) {}

  setPosition(x: number, y: number) {
    this.world.pivot.set(x, y);
  }

  setZoom(zoom: number) {
    const safeZoom = Math.max(0.1, zoom);
    this.world.scale.set(safeZoom);
  }

  shake(durationMs = 240, strength = 8) {
    this.shakeTime = durationMs;
    this.shakeDuration = durationMs;
    this.shakeStrength = strength;
  }

  update(ticker: Ticker) {
    this.elapsed += ticker.deltaMS;
    if (this.shakeTime <= 0) {
      this.world.position.set(0, 0);
      return;
    }
    this.shakeTime = Math.max(0, this.shakeTime - ticker.deltaMS);
    const intensity = this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0;
    this.world.position.set(
      Math.sin(this.elapsed * 0.12) * this.shakeStrength * intensity,
      Math.cos(this.elapsed * 0.17) * this.shakeStrength * intensity,
    );
  }
}
