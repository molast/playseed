import type { Application } from "pixi.js";

import type { SceneManager } from "./core/scene-manager";
import type { AudioSystem } from "./systems/audio-system";
import type { InputSystem } from "./systems/input-system";
import type { ResourceManager } from "./systems/resource-manager";
import type { RewardSystem } from "./systems/reward-system";
import type { TimelineSystem } from "./systems/timeline-system";
import type { TweenSystem } from "./systems/tween-system";

export interface EngineContext {
  app: Application;
  scenes: SceneManager;
  input: InputSystem;
  resources: ResourceManager;
  audio: AudioSystem;
  rewards: RewardSystem;
  timeline: TimelineSystem;
  tweens: TweenSystem;
}
