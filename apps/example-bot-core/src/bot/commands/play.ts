import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types";

export const playCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song.")
    .addStringOption((option) =>
      option.setName("query").setDescription("The song to play.").setRequired(true)
    ),
  execute: async (ctx) => {
    const query = ctx.interaction.options.getString("query", true);

    const player = await ctx.joinAndGetPlayer();
    if (!player) {
      return;
    }

    const result = await player.searchAndPlay(query, "ytsearch");
    if (result.loadType === "error" && result.error) {
      return ctx.error(result.error.message ?? "Failed to load track.");
    }

    return ctx.reply(`Playing ${result.tracks[0]?.title ?? query}`);
  },
};
