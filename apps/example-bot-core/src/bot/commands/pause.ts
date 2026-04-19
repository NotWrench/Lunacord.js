import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types";

export const pauseCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause playback."),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error("Nothing is playing right now.");
    }

    await player.pause(true);
    return ctx.reply("Paused.");
  },
};
