"use client";

import { useEffect, useRef } from "react";

interface RewardStageProps {
  visible: boolean;
}

export function RewardStage({ visible }: RewardStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !hostRef.current) return;

    let disposed = false;
    let cleanup = () => {};

    async function mount() {
      const { Application, Graphics } = await import("pixi.js");
      if (disposed || !hostRef.current) return;

      const app = new Application();
      await app.init({
        width: 360,
        height: 120,
        antialias: true,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio, 2),
      });

      if (disposed || !hostRef.current) {
        app.destroy(true);
        return;
      }

      app.canvas.setAttribute("aria-hidden", "true");
      hostRef.current.replaceChildren(app.canvas);

      const colors = [0xf6c945, 0x2f7d59, 0xe96b4a, 0x3878c5];
      const pieces = Array.from({ length: 24 }, (_, index) => {
        const graphic = new Graphics()
          .roundRect(-4, -4, 8, 8, 2)
          .fill(colors[index % colors.length]);
        graphic.x = 24 + ((index * 47) % 312);
        graphic.y = 18 + ((index * 29) % 80);
        graphic.rotation = index * 0.4;
        app.stage.addChild(graphic);
        return { graphic, speed: 0.4 + (index % 5) * 0.12 };
      });

      app.ticker.add(() => {
        for (const piece of pieces) {
          piece.graphic.y += piece.speed;
          piece.graphic.rotation += 0.025;
          if (piece.graphic.y > 126) piece.graphic.y = -6;
        }
      });

      cleanup = () => app.destroy(true, { children: true });
    }

    void mount();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [visible]);

  return <div className="reward-stage" ref={hostRef} />;
}
