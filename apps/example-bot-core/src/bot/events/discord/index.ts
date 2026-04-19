import type { DiscordEventHandler } from "../../types";
import { interactionCreateEventHandler } from "./interactionCreate";
import { rawEventHandler } from "./raw";
import { readyEventHandler } from "./ready";

export const discordEventHandlers: readonly DiscordEventHandler[] = [
  rawEventHandler,
  interactionCreateEventHandler,
  readyEventHandler,
] as const;
