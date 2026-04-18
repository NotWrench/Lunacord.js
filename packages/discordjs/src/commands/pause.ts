import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const pauseCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause playback"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    await player.pause(true);
    return ctx.reply(ctx.music.message("paused"));
  },
};

export const resumeCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume playback"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    await player.pause(false);
    return ctx.reply(ctx.music.message("resumed"));
  },
};
