import { SlashCommandBuilder } from "discord.js";
import type { Filters } from "../../../src/types";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayingPlayer } from "./utils/player";

type FilterPreset = "bassboost" | "nightcore" | "vaporwave" | "karaoke" | "clear";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCustomFilters = (input: string): Partial<Filters> => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Custom filters must be valid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("Custom filters JSON must be an object");
  }

  return parsed as Partial<Filters>;
};

export const filterCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Applies or clears playback filters")
    .addStringOption((option) =>
      option
        .setName("preset")
        .setDescription("Filter preset")
        .setRequired(false)
        .addChoices(
          { name: "bassboost", value: "bassboost" },
          { name: "nightcore", value: "nightcore" },
          { name: "vaporwave", value: "vaporwave" },
          { name: "karaoke", value: "karaoke" },
          { name: "clear", value: "clear" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("custom")
        .setDescription("Custom Lavalink filter JSON payload")
        .setRequired(false)
    ),
  execute: async (context) => {
    const preset = context.interaction.options.getString("preset") as FilterPreset | null;
    const custom = context.interaction.options.getString("custom");
    const player = await getExistingPlayingPlayer(context);
    if (!player) {
      return;
    }

    if (!preset && !custom) {
      await respond(context.interaction, "Provide a preset, custom JSON, or both.");
      return;
    }

    if (preset === "clear" && custom) {
      await respond(context.interaction, "Cannot combine preset **clear** with custom JSON.");
      return;
    }

    try {
      if (preset === "clear") {
        await player.clearFilters();
        await respond(context.interaction, "Cleared all filters.");
        return;
      }

      let builder = player.createFilterBuilder();
      const applied: string[] = [];

      if (preset) {
        switch (preset) {
          case "bassboost":
            builder = builder.setBassboost();
            break;
          case "nightcore":
            builder = builder.setNightcore();
            break;
          case "vaporwave":
            builder = builder.setVaporwave();
            break;
          case "karaoke":
            builder = builder.setKaraoke();
            break;
          default:
            await respond(
              context.interaction,
              "Unknown preset. Use bassboost, nightcore, vaporwave, karaoke, or clear."
            );
            return;
        }

        applied.push(`preset **${preset}**`);
      }

      if (custom) {
        const customFilters = parseCustomFilters(custom);
        builder = builder.update(customFilters);
        applied.push("custom JSON filters");
      }

      await builder.apply();
      await respond(context.interaction, `Applied ${applied.join(" and ")}.`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to update filters.";
      await respond(context.interaction, `Failed to update filters: ${message}`);
    }
  },
};
