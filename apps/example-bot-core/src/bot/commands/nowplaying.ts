import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types";

export const nowPlayingCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current track."),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    const track = player?.current;

    if (!track) {
      return ctx.error("Nothing is playing right now.");
    }

    return ctx.reply(`Now playing: ${track.title}`);
  },
};
