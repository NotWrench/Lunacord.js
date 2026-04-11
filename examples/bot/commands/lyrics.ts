import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayer } from "./utils/player";

export const lyricsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Fetches lyrics for the current track"),
  execute: async (context) => {
    const player = await getExistingPlayer(context);
    if (!player) {
      await respond(context.interaction, "Nothing is playing.");
      return;
    }

    try {
      const result = await player.getLyrics();

      switch (result.status) {
        case "found": {
          const excerpt =
            result.lyrics.lyricsText.length > 1_500
              ? `${result.lyrics.lyricsText.slice(0, 1_497).trimEnd()}...`
              : result.lyrics.lyricsText;

          await respond(
            context.interaction,
            `Lyrics for **${result.lyrics.title}** by **${result.lyrics.artist}**\n${result.lyrics.url}\n\n${excerpt || "*No lyric text available.*"}`
          );
          return;
        }
        case "not_found":
          await respond(context.interaction, "Lyrics were not found for the current track.");
          return;
        case "unavailable":
          switch (result.reason) {
            case "invalid_token":
              await respond(
                context.interaction,
                "Lyrics fallback is configured with an invalid Genius access token."
              );
              return;
            case "rate_limited":
              await respond(
                context.interaction,
                "The lyrics services are rate limited right now. Try again shortly."
              );
              return;
            default:
              await respond(
                context.interaction,
                "Lyrics are currently unavailable. lyrics.ovh is used first, with Genius as optional fallback."
              );
              return;
          }
        case "no_track":
        default:
          await respond(context.interaction, "Nothing is currently playing.");
          return;
      }
    } catch (error) {
      console.error(error);
      await respond(context.interaction, "Failed to fetch lyrics.");
    }
  },
};
