import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const seekCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seek to a position in the current track (seconds)")
    .addIntegerOption((opt) =>
      opt.setName("position").setDescription("Position in seconds").setRequired(true).setMinValue(0)
    ),
  execute: async (ctx) => {
    const positionSeconds = ctx.interaction.options.getInteger("position", true);
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    await player.seek(positionSeconds * 1000);
    return ctx.reply(ctx.music.message("seekTo", { position: `${positionSeconds}s` }));
  },
};
