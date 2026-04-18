import type { MusicCommand } from "../types";
import { autoplayCommand } from "./autoplay";
import { filterCommand } from "./filter";
import { joinCommand, leaveCommand } from "./join";
import { lyricsCommand } from "./lyrics";
import { pauseCommand, resumeCommand } from "./pause";
import { playCommand } from "./play";
import { clearCommand, nowplayingCommand, queueCommand } from "./queue";
import { repeatCommand } from "./repeat";
import { seekCommand } from "./seek";
import { shuffleCommand } from "./shuffle";
import { previousCommand, skipCommand } from "./skip";
import { stopCommand } from "./stop";
import { volumeCommand } from "./volume";

export const getDefaultCommands = (): MusicCommand[] => [
  playCommand,
  pauseCommand,
  resumeCommand,
  stopCommand,
  skipCommand,
  previousCommand,
  seekCommand,
  volumeCommand,
  queueCommand,
  clearCommand,
  nowplayingCommand,
  shuffleCommand,
  repeatCommand,
  filterCommand,
  lyricsCommand,
  autoplayCommand,
  joinCommand,
  leaveCommand,
];

export { autoplayCommand } from "./autoplay";
export { filterCommand } from "./filter";
export { joinCommand, leaveCommand } from "./join";
export { lyricsCommand } from "./lyrics";
export { pauseCommand, resumeCommand } from "./pause";
export { playCommand } from "./play";
export { clearCommand, nowplayingCommand, queueCommand } from "./queue";
export { repeatCommand } from "./repeat";
export { seekCommand } from "./seek";
export { shuffleCommand } from "./shuffle";
export { previousCommand, skipCommand } from "./skip";
export { stopCommand } from "./stop";
export { volumeCommand } from "./volume";
