import type { LunacordEventHandler } from "../../types";
import { debugEventHandler } from "./debug";
import { nodeErrorEventHandler } from "./nodeError";
import { playerEventHandler } from "./player";
import { trackEventHandler } from "./track";

export const lunacordEventHandlers: readonly LunacordEventHandler[] = [
  debugEventHandler,
  nodeErrorEventHandler,
  trackEventHandler,
  playerEventHandler,
] as const;
