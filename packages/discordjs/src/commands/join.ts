import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

export const joinCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("join").setDescription("Join your voice channel"),
  execute: async (ctx) => {
    const player = await ctx.joinAndGetPlayer();
    if (!player) {
      return undefined;
    }
    return ctx.reply(ctx.music.message("playerConnecting"));
  },
};

export const leaveCommand: MusicCommand = {
  data: new SlashCommandBuilder().setName("leave").setDescription("Leave the voice channel"),
  execute: async (ctx) => {
    const guildId = ctx.interaction.guildId;
    if (!guildId) {
      return ctx.error(ctx.music.message("notInServer"));
    }
    const player = ctx.lunacord.getPlayer(guildId);
    if (!player) {
      return ctx.reply(ctx.music.message("disconnected"));
    }
    await ctx.lunacord.destroyPlayer(guildId);
    return ctx.reply(ctx.music.message("disconnected"));
  },
};
