import { Container, Graphics, type Ticker } from "pixi.js";

export interface BurstParticleConfig {
  color: number;
  count?: number;
  radius?: number;
  speed?: number;
  gravity?: number;
  life?: number;
}

interface Particle {
  view: Graphics;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private readonly particles: Particle[] = [];

  constructor(readonly layer = new Container()) {}

  burst(x: number, y: number, config: BurstParticleConfig) {
    const count = config.count ?? 16;
    const radius = config.radius ?? 4;
    const speed = config.speed ?? 3;
    const life = config.life ?? 34;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const velocity = speed * (0.8 + (index % 4) * 0.18);
      const view = new Graphics().circle(0, 0, radius * (0.75 + (index % 3) * 0.2)).fill(config.color);
      view.position.set(x, y);
      this.layer.addChild(view);
      this.particles.push({
        view,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        gravity: config.gravity ?? 0.09,
        life,
        maxLife: life,
      });
    }
  }

  update(ticker: Ticker) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.view.x += particle.vx * ticker.deltaTime;
      particle.view.y += particle.vy * ticker.deltaTime;
      particle.vy += particle.gravity * ticker.deltaTime;
      particle.life -= ticker.deltaTime;
      particle.view.alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.life <= 0) {
        particle.view.removeFromParent();
        particle.view.destroy();
        this.particles.splice(index, 1);
      }
    }
  }

  clear() {
    for (const particle of this.particles) {
      particle.view.removeFromParent();
      particle.view.destroy();
    }
    this.particles.length = 0;
    this.layer.removeChildren();
  }

  destroy() {
    this.clear();
    this.layer.removeFromParent();
    this.layer.destroy({ children: true });
  }
}
