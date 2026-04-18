import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const stopCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback, clear queue, and leave voice"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    await player.stop(true, true);
    return ctx.reply(ctx.music.message("stopped"));
  },
};
