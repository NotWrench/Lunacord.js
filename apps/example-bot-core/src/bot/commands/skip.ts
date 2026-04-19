import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types";

export const skipCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current track."),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error("Nothing is playing right now.");
    }

    await player.skip();
    return ctx.reply("Skipped.");
  },
};
