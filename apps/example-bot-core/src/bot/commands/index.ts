import type { BotCommand } from "../types";
import { nowPlayingCommand } from "./nowplaying";
import { pauseCommand } from "./pause";
import { pingCommand } from "./ping";
import { playCommand } from "./play";
import { skipCommand } from "./skip";
import { stopCommand } from "./stop";

export const defaultCommands: readonly BotCommand[] = [
  pingCommand,
  playCommand,
  pauseCommand,
  skipCommand,
  stopCommand,
  nowPlayingCommand,
] as const;

export const registerDefaultCommands = (register: (command: BotCommand) => void): void => {
  for (const command of defaultCommands) {
    register(command);
  }
};
