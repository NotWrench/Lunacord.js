import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayer } from "./utils/player";

export const stopCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stops playback and disconnects"),
  execute: async (context) => {
    const player = await getExistingPlayer(context);
    if (!player) {
      await respond(context.interaction, "Nothing is playing.");
      return;
    }

    await player.stop();
    await respond(context.interaction, "Stopped and disconnected.");
  },
};
