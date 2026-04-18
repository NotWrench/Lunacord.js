import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const queueCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue")
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("How many tracks to show (default 10)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    const limit = ctx.interaction.options.getInteger("limit", false) ?? 10;
    return ctx.reply({ embeds: [ctx.music.embeds.queue(player, { limit })] });
  },
};

export const clearCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("clear").setDescription("Clear the upcoming queue"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    player.clearQueue();
    return ctx.reply(ctx.music.message("cleared"));
  },
};

export const nowplayingCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show what's currently playing"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player?.current) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    return ctx.reply({ embeds: [ctx.music.embeds.nowPlaying(player)] });
  },
};
