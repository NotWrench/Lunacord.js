import { SlashCommandBuilder } from "discord.js";
import { SearchProvider } from "../../../src/types";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getOrCreateConnectedPlayer } from "./utils/player";

const providerChoices = Object.values(SearchProvider).map((provider) => ({
  name: provider,
  value: provider,
}));

const searchProviders = new Set<string>(Object.values(SearchProvider));

const isSearchProvider = (value: string): value is SearchProvider => searchProviders.has(value);

export const playCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Searches and plays a track")
    .addStringOption((option) =>
      option
        .setName("provider")
        .setDescription("Search provider")
        .setRequired(true)
        .addChoices(...providerChoices)
    )
    .addStringOption((option) =>
      option.setName("query").setDescription("Track or playlist query").setRequired(true)
    ),
  execute: async (context) => {
    const interaction = context.interaction;
    const providerArg = interaction.options.getString("provider", true).toLowerCase();
    const query = interaction.options.getString("query", true).trim();

    if (!isSearchProvider(providerArg)) {
      await respond(
        interaction,
        "Invalid provider. Use one of: ytsearch, ytmsearch, scsearch, spsearch, dzsearch, amsearch."
      );
      return;
    }

    if (!query) {
      await respond(interaction, "Query must not be empty.");
      return;
    }

    try {
      const player = await getOrCreateConnectedPlayer(context);
      if (!player) {
        return;
      }

      const result = await player.searchAndPlay(query, providerArg);
      if (result.loadType === "empty" || result.loadType === "error") {
        await respond(interaction, "No results found or an error occurred.");
        return;
      }

      const track = result.tracks[0];
      if (!track) {
        await respond(interaction, "No tracks found.");
        return;
      }

      const action = player.current?.encoded === track.encoded ? "Now playing" : "Queued";
      await respond(interaction, `${action}: **${track.title}**`);
    } catch (error) {
      console.error(error);
      await respond(interaction, "Failed to load track.");
    }
  },
};
