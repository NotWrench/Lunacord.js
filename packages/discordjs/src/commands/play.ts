import { buildProviderSequence } from "@lunacord/core";
import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const playCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Search and play a track or playlist")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Track URL or search query").setRequired(true)
    ),
  execute: async (ctx) => {
    const query = ctx.interaction.options.getString("query", true).trim();
    if (!query) {
      return ctx.error("Query must not be empty.");
    }

    await ctx.interaction.deferReply();
    const player = await ctx.joinAndGetPlayer();
    if (!player) {
      return undefined;
    }

    const providers = buildProviderSequence(query);
    let lastErrorMessage: string | null = null;

    for (const provider of providers) {
      const result = await player.searchAndPlay(query, provider);

      if (result.loadType === "error") {
        lastErrorMessage = result.error.message ?? result.error.cause ?? lastErrorMessage;
        continue;
      }

      if (result.loadType === "playlist") {
        const name = result.playlistInfo.name || "Untitled playlist";
        return ctx.reply({
          embeds: [ctx.music.embeds.playlistLoaded(name, result.tracks.length)],
        });
      }

      const track = result.tracks[0];
      if (!track) {
        continue;
      }

      const isNowPlaying = player.current?.encoded === track.encoded;
      const message = isNowPlaying
        ? ctx.music.message("nowPlaying", { title: track.title })
        : ctx.music.message("queued", { title: track.title });
      return ctx.reply(message);
    }

    if (lastErrorMessage) {
      return ctx.reply(`${ctx.music.message("failedLoad")}: ${lastErrorMessage}`);
    }
    return ctx.reply("No tracks found.");
  },
};
