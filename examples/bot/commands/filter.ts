import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayingPlayer } from "./utils/player";

export const filterCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Applies or clears playback filters")
    .addStringOption((option) =>
      option
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
  execute: async (context) => {
    const preset = context.interaction.options.getString("preset", true);
    const player = await getExistingPlayingPlayer(context);
    if (!player) {
      return;
    }

    try {
      switch (preset) {
        case "bassboost":
          await player.setBassboost();
          await respond(context.interaction, "Applied filter: **bassboost**");
          break;
        case "nightcore":
          await player.setNightcore();
          await respond(context.interaction, "Applied filter: **nightcore**");
          break;
        case "vaporwave":
          await player.setVaporwave();
          await respond(context.interaction, "Applied filter: **vaporwave**");
          break;
        case "karaoke":
          await player.setKaraoke();
          await respond(context.interaction, "Applied filter: **karaoke**");
          break;
        case "clear":
          await player.clearFilters();
          await respond(context.interaction, "Cleared all filters.");
          break;
        default:
          await respond(
            context.interaction,
            "Unknown filter. Use bassboost, nightcore, vaporwave, karaoke, or clear."
          );
          break;
      }
    } catch (error) {
      console.error(error);
      await respond(context.interaction, "Failed to update filters.");
    }
  },
};
