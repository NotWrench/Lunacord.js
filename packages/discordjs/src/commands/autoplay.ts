import { SlashCommandBuilder } from "discord.js";
import type { MusicCommand } from "../types";

/**
 * Toggle stub for autoplay. Actual autoplay logic is pluggable through the
 * `createAutoplayPlugin` builtin from `@lunacord/plugins` — this command just surfaces
 * the current state via `player.userData.autoplay` so users can wire their own UX.
 */
export const autoplayCommand: MusicCommand = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay for this guild"),
  execute: async (ctx) => {
    const player = await ctx.getPlayer();
    if (!player) {
      return ctx.error(ctx.music.message("nothingPlaying"));
    }
    const current =
      (player as unknown as { userData?: { autoplay?: boolean } }).userData?.autoplay ?? false;
    const next = !current;
    (player as unknown as { userData: { autoplay?: boolean } }).userData = {
      ...((player as unknown as { userData?: Record<string, unknown> }).userData ?? {}),
      autoplay: next,
    };
    return ctx.reply(`Autoplay: **${next ? "on" : "off"}**`);
  },
};
