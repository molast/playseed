import { Container, type Ticker } from "pixi.js";

export class GameObject {
  readonly view: Container;
  active = true;

  constructor(view = new Container()) {
    this.view = view;
  }

  update(ticker: Ticker) {
    void ticker;
  }

  setVisible(visible: boolean) {
    this.view.visible = visible;
  }

  destroy() {
    this.active = false;
    this.view.removeFromParent();
    this.view.destroy({ children: true });
  }
}
