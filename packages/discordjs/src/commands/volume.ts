import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const volumeCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Get or set the playback volume (0-1000)")
    .addIntegerOption((opt) =>
      opt
        .setName("level")
        .setDescription("Volume level (0-1000)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(1000)
    ),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    const level = ctx.interaction.options.getInteger("level", false);
    if (level === null) {
      return ctx.reply(`Current volume: **${player.volume}%**`);
    }
    await player.setVolume(level);
    return ctx.reply(ctx.music.message("volumeSet", { volume: level }));
  },
};
