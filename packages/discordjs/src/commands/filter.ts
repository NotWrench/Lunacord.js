import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

const FILTER_PRESETS = ["bassboost", "nightcore", "vaporwave", "karaoke"] as const;
type FilterPreset = (typeof FILTER_PRESETS)[number];

export const filterCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Apply an audio filter preset (or clear)")
    .addStringOption((opt) =>
      opt
        .setName("preset")
        .setDescription("Filter preset")
        .setRequired(true)
        .addChoices(
          { name: "bassboost", value: "bassboost" },
          { name: "nightcore", value: "nightcore" },
          { name: "vaporwave", value: "vaporwave" },
          { name: "karaoke", value: "karaoke" },
          { name: "clear", value: "clear" }
        )
    ),
  execute: async (ctx) => {
    const preset = ctx.interaction.options.getString("preset", true) as FilterPreset | "clear";
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }

    if (preset === "clear") {
      await player.clearFilters();
      return ctx.reply(ctx.music.message("filterCleared"));
    }

    switch (preset) {
      case "bassboost":
        await player.setBassboost();
        break;
      case "nightcore":
        await player.setNightcore();
        break;
      case "vaporwave":
        await player.setVaporwave();
        break;
      case "karaoke":
        await player.setKaraoke();
        break;
      default:
        return ctx.error(`Unknown preset: ${preset}`);
    }

    return ctx.reply(ctx.music.message("filterApplied", { name: preset }));
  },
};
