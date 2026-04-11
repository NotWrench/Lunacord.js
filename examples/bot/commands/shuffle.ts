import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayer } from "./utils/player";

export const shuffleCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffles the current queue"),
  execute: async (context) => {
    const player = await getExistingPlayer(context);
    if (!player) {
      await respond(context.interaction, "Nothing is playing.");
      return;
    }

    player.shuffleQueue();
    await respond(context.interaction, "Shuffled the queue.");
  },
};
