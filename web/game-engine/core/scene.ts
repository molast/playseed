import { Container, type Ticker } from "pixi.js";

import { Camera } from "./camera";
import { GameObject } from "./game-object";

export class Scene {
  readonly root = new Container();
  readonly world = new Container();
  readonly overlay = new Container();
  readonly camera = new Camera(this.world);
  private readonly objects = new Set<GameObject>();
  private readonly updateHandlers = new Set<(ticker: Ticker) => void>();
  active = false;
  paused = false;

  constructor(readonly id: string) {
    this.root.label = `scene:${id}`;
    this.root.addChild(this.world, this.overlay);
  }

  add(object: GameObject, layer: "world" | "overlay" = "world") {
    this.objects.add(object);
    (layer === "world" ? this.world : this.overlay).addChild(object.view);
    return object;
  }

  remove(object: GameObject, destroy = true) {
    this.objects.delete(object);
    if (destroy) object.destroy();
    else object.view.removeFromParent();
  }

  onUpdate(handler: (ticker: Ticker) => void) {
    this.updateHandlers.add(handler);
    return () => this.updateHandlers.delete(handler);
  }

  start() {
    this.active = true;
    this.paused = false;
    this.root.visible = true;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  update(ticker: Ticker) {
    if (!this.active || this.paused) return;
    this.camera.update(ticker);
    for (const object of this.objects) {
      if (object.active) object.update(ticker);
    }
    for (const handler of this.updateHandlers) handler(ticker);
  }

  destroy() {
    this.active = false;
    this.updateHandlers.clear();
    for (const object of this.objects) object.destroy();
    this.objects.clear();
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }
}
