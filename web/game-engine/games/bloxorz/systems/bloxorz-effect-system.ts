import { Container, Graphics } from "pixi.js";

import type { TweenSystem } from "../../../systems/tween-system";

export function playBloxorzBurst(
  layer: Container,
  tweens: TweenSystem,
  x: number,
  y: number,
  color = 0xf3cf57,
) {
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const particle = new Graphics().circle(0, 0, 3 + index % 3).fill(index % 2 ? color : 0xffffff);
    particle.position.set(x, y);
    layer.addChild(particle);
    tweens.add({
      durationMs: 560,
      update: (progress) => {
        const distance = 24 + progress * 54;
        particle.position.set(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.55);
        particle.alpha = 1 - progress;
        particle.scale.set(1 - progress * 0.45);
      },
      complete: () => particle.destroy(),
    });
  }
}

export function playBloxorzFragments(
  layer: Container,
  tweens: TweenSystem,
  x: number,
  y: number,
) {
  for (let index = 0; index < 8; index += 1) {
    const fragment = new Graphics()
      .poly([-6, -4, 6, -2, 3, 5, -5, 4])
      .fill(index % 2 ? 0xd59a58 : 0x815437);
    fragment.position.set(x, y);
    layer.addChild(fragment);
    const velocityX = (index - 3.5) * 1.8;
    const velocityY = -5 - index % 3;
    tweens.add({
      durationMs: 620,
      update: (progress) => {
        fragment.position.set(x + velocityX * progress * 18, y + velocityY * progress * 13 + progress * progress * 115);
        fragment.rotation = progress * (index % 2 ? 4 : -4);
        fragment.alpha = 1 - progress;
      },
      complete: () => fragment.destroy(),
    });
  }
}
