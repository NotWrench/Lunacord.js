import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { filterCommand } from "./filter";
import { lyricsCommand } from "./lyrics";
import { playCommand } from "./play";
import { repeatQueueCommand } from "./repeatqueue";
import { repeatTrackCommand } from "./repeattrack";
import { seekCommand } from "./seek";
import { shuffleCommand } from "./shuffle";
import { skipCommand } from "./skip";
import { stopCommand } from "./stop";
import type { SlashCommand } from "./types";

export const slashCommands: SlashCommand[] = [
  playCommand,
  skipCommand,
  repeatTrackCommand,
  repeatQueueCommand,
  filterCommand,
  seekCommand,
  lyricsCommand,
  shuffleCommand,
  stopCommand,
];

const commandEntries = slashCommands.map(
  (command) => [command.data.toJSON().name, command] as const
);

export const slashCommandsByName = new Map<string, SlashCommand>(commandEntries);

export const slashCommandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
  slashCommands.map((command) => command.data.toJSON());
