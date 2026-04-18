import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const skipCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current track"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    await player.skip();
    return ctx.reply(ctx.music.message("skipped"));
  },
};

export const previousCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("previous")
    .setDescription("Go back to the previous track"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    const previous = await player.previous();
    if (!previous) {
      return ctx.error("No previous track in history.");
    }
    return ctx.reply(`Rewound to: **${previous.title}**`);
  },
};
