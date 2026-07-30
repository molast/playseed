import type { Container, FederatedPointerEvent } from "pixi.js";

export type InputDisposer = () => void;

export class InputSystem {
  private readonly pressedKeys = new Set<string>();
  private readonly disposers = new Set<InputDisposer>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement === this.canvas && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      this.pressedKeys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => this.pressedKeys.delete(event.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.disposers.add(() => window.removeEventListener("keydown", onKeyDown));
    this.disposers.add(() => window.removeEventListener("keyup", onKeyUp));
  }

  bindTap(target: Container, handler: (event: FederatedPointerEvent) => void, cursor = "pointer") {
    target.eventMode = "static";
    target.cursor = cursor;
    target.on("pointertap", handler);
    const dispose = () => {
      target.off("pointertap", handler);
      target.eventMode = "none";
      this.disposers.delete(dispose);
    };
    this.disposers.add(dispose);
    return dispose;
  }

  isKeyDown(code: string) {
    return this.pressedKeys.has(code);
  }

  focus() {
    this.canvas.focus();
  }

  destroy() {
    for (const dispose of [...this.disposers]) dispose();
    this.disposers.clear();
    this.pressedKeys.clear();
  }
}
