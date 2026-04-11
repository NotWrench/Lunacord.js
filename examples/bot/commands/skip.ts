import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types";
import { respond } from "./utils/interaction";
import { getExistingPlayingPlayer } from "./utils/player";

export const skipCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skips the current track"),
  execute: async (context) => {
    const player = await getExistingPlayingPlayer(context);
    if (!player) {
      return;
    }

    const repeatTrackEnabled = player.isRepeatTrackEnabled;
    const repeatQueueEnabled = player.isRepeatQueueEnabled;
    const hadQueuedTrack = !player.queue.isEmpty;

    await player.skip();

    if (repeatTrackEnabled) {
      await respond(
        context.interaction,
        "Track repeat is enabled, so skip replayed the same track."
      );
      return;
    }

    if (repeatQueueEnabled && !hadQueuedTrack) {
      await respond(
        context.interaction,
        "Queue repeat is enabled and this was the last track, so playback continued from the loop."
      );
      return;
    }

    await respond(context.interaction, "Skipped!");
  },
};
