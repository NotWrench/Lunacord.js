import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types";

export const stopCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stop playback and leave voice."),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error("Nothing to stop.");
    }

    await player.stop(true, true);
    return ctx.reply("Stopped and disconnected.");
  },
};
