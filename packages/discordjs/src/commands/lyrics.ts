import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

const MAX_LYRICS_LENGTH = 1800;

export const lyricsCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Fetch lyrics for the current track")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Optional override query").setRequired(false)
    ),
  execute: async (ctx) => {
    await ctx.interaction.deferReply();
    const guildId = ctx.interaction.guildId;
    if (!guildId) {
      return ctx.reply(ctx.music.message("notInServer"));
    }
    const override = ctx.interaction.options.getString("query", false) ?? undefined;
    const result = await ctx.lunacord.getLyrics(
      guildId,
      override ? { query: override } : undefined
    );

    switch (result.status) {
      case "no_track":
        return ctx.reply(ctx.music.message("nothingPlaying"));
      case "not_found":
        return ctx.reply(ctx.music.message("lyricsNotFound"));
      case "unavailable":
        return ctx.reply(ctx.music.message("lyricsUnavailable"));
      case "found": {
        const text =
          result.lyrics.lyricsText.length > MAX_LYRICS_LENGTH
            ? `${result.lyrics.lyricsText.slice(0, MAX_LYRICS_LENGTH)}…`
            : result.lyrics.lyricsText;
        return ctx.reply(`**${result.lyrics.title}** — ${result.lyrics.artist}\n\n${text}`);
      }
      default:
        return ctx.reply(ctx.music.message("lyricsNotFound"));
    }
  },
};
