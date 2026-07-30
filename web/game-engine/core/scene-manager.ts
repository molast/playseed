import type { Container, Ticker } from "pixi.js";

import type { Scene } from "./scene";

export class SceneManager {
  private currentScene: Scene | null = null;

  constructor(private readonly stage: Container) {}

  set(scene: Scene) {
    if (this.currentScene === scene) return scene;
    this.currentScene?.destroy();
    this.currentScene = scene;
    this.stage.addChild(scene.root);
    scene.start();
    return scene;
  }

  clear(scene?: Scene) {
    if (!this.currentScene || (scene && scene !== this.currentScene)) return;
    this.currentScene.destroy();
    this.currentScene = null;
  }

  update(ticker: Ticker) {
    this.currentScene?.update(ticker);
  }

  destroy() {
    this.clear();
  }
}
