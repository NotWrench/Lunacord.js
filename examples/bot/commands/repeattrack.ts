import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayer } from "./utils/player";

export const repeatTrackCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("repeattrack")
    .setDescription("Toggles repeat for the current track"),
  execute: async (context) => {
    const player = await getExistingPlayer(context);
    if (!player) {
      await respond(context.interaction, "Nothing is playing.");
      return;
    }

    const enabled = player.repeatTrack();
    await respond(
      context.interaction,
      `Repeat track is now **${enabled ? "enabled" : "disabled"}**.`
    );
  },
};
