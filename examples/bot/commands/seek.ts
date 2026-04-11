import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayingPlayer } from "./utils/player";

export const seekCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seeks to a position in the current track")
    .addNumberOption((option) =>
      option
        .setName("seconds")
        .setDescription("Position in seconds")
        .setRequired(true)
        .setMinValue(0)
    ),
  execute: async (context) => {
    const player = await getExistingPlayingPlayer(context);
    if (!player) {
      return;
    }

    const seconds = context.interaction.options.getNumber("seconds", true);

    try {
      await player.seek(seconds * 1000);
      await respond(context.interaction, `Seeked to **${seconds}s**.`);
    } catch (error) {
      console.error(error);
      await respond(context.interaction, "Failed to seek the current track.");
    }
  },
};
