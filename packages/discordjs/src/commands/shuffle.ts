import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const shuffleCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the upcoming queue"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    player.shuffleQueue();
    return ctx.reply(ctx.music.message("shuffled"));
  },
};
