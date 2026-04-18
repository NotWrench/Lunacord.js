import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const repeatCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("repeat")
    .setDescription("Set repeat mode")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("track | queue | off")
        .setRequired(true)
        .addChoices(
          { name: "track", value: "track" },
          { name: "queue", value: "queue" },
          { name: "off", value: "off" }
        )
    ),
  execute: async (ctx) => {
    const mode = ctx.interaction.options.getString("mode", true);
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }

    switch (mode) {
      case "track":
        player.repeatTrack(true);
        return ctx.reply(ctx.music.message("repeatTrackOn"));
      case "queue":
        player.repeatQueue(true);
        return ctx.reply(ctx.music.message("repeatQueueOn"));
      default:
        player.repeatTrack(false);
        player.repeatQueue(false);
        return ctx.reply(ctx.music.message("repeatTrackOff"));
    }
  },
};
