import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayer } from "./utils/player";

export const repeatQueueCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("repeatqueue").setDescription("Toggles queue loop mode"),
  execute: async (context) => {
    const player = await getExistingPlayer(context);
    if (!player) {
      await respond(context.interaction, "Nothing is playing.");
      return;
    }

    const enabled = player.repeatQueue();
    await respond(
      context.interaction,
      `Repeat queue is now **${enabled ? "enabled" : "disabled"}**.`
    );
  },
};
