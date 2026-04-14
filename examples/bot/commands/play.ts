import { SlashCommandBuilder } from "discord.js";
import { SearchProvider } from "../../../src/types";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getOrCreateConnectedPlayer } from "./utils/player";

const URL_WRAPPER_REGEX = /^<(.+)>$/;
const FALLBACK_SEARCH_PROVIDERS = [SearchProvider.YouTube, "bcsearch", SearchProvider.SoundCloud];
const DEFAULT_LOAD_ERROR_MESSAGE = "Lavalink returned an error while loading this query.";

const parseHttpUrl = (value: string): URL | null => {
  const normalizedValue = value.replace(URL_WRAPPER_REGEX, "$1").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

const getProviderFromUrl = (url: URL): string | null => {
  const hostname = url.hostname.toLowerCase();

  if (hostname === "music.youtube.com") {
    return SearchProvider.YouTubeMusic;
  }

  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") {
    return SearchProvider.YouTube;
  }

  if (hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com")) {
    return SearchProvider.SoundCloud;
  }

  if (hostname === "bandcamp.com" || hostname.endsWith(".bandcamp.com")) {
    return "bcsearch";
  }

  if (hostname === "spotify.com" || hostname.endsWith(".spotify.com")) {
    return SearchProvider.Spotify;
  }

  if (hostname === "deezer.com" || hostname.endsWith(".deezer.com")) {
    return SearchProvider.Deezer;
  }

  if (hostname === "music.apple.com") {
    return SearchProvider.AppleMusic;
  }

  return null;
};

const buildProviderSequence = (query: string): string[] => {
  const parsedUrl = parseHttpUrl(query);
  if (!parsedUrl) {
    return FALLBACK_SEARCH_PROVIDERS;
  }

  const detectedProvider = getProviderFromUrl(parsedUrl);
  return [detectedProvider ?? SearchProvider.YouTube];
};

const normalizeLoadErrorMessage = (message: string | null | undefined): string | null => {
  const trimmed = message?.trim();
  return trimmed ? trimmed : null;
};

export const playCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Searches and plays a track")
    .addStringOption((option) =>
      option.setName("query").setDescription("Track or playlist query").setRequired(true)
    ),
  execute: async (context) => {
    const interaction = context.interaction;
    const query = interaction.options.getString("query", true).trim();

    if (!query) {
      await respond(interaction, "Query must not be empty.");
      return;
    }

    try {
      const player = await getOrCreateConnectedPlayer(context);
      if (!player) {
        return;
      }

      const providersToTry = buildProviderSequence(query);
      let lastFailure: string | null = null;
      let hadLoadError = false;

      for (const provider of providersToTry) {
        const result = await player.searchAndPlay(query, provider);
        if (result.loadType === "error") {
          hadLoadError = true;
          lastFailure =
            normalizeLoadErrorMessage(result.error.message) ??
            normalizeLoadErrorMessage(result.error.cause) ??
            lastFailure;
          continue;
        }

        if (result.loadType === "playlist") {
          const playlistName = result.playlistInfo.name || "Untitled playlist";
          const trackCount = result.tracks.length;
          const trackLabel = trackCount === 1 ? "track" : "tracks";
          await respond(
            interaction,
            `Playlist loaded: **${playlistName}** (${trackCount} ${trackLabel}).`
          );
          return;
        }

        const track = result.tracks[0];
        if (!track) {
          continue;
        }

        const action = player.current?.encoded === track.encoded ? "Now playing" : "Queued";
        await respond(interaction, `${action}: **${track.title}**`);
        return;
      }

      if (hadLoadError) {
        await respond(
          interaction,
          `Failed to load track: ${lastFailure ?? DEFAULT_LOAD_ERROR_MESSAGE}`
        );
        return;
      }

      await respond(interaction, "No tracks found.");
    } catch (error) {
      console.error(error);
      await respond(interaction, "Failed to load track.");
    }
  },
};
