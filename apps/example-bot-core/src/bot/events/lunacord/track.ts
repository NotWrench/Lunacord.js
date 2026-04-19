import type { LunacordEventHandler } from "../../types";

export const trackEventHandler: LunacordEventHandler = (client) => {
  client.lunacord.on("trackStart", ({ player, track }) => {
    console.log(`[track:start] ${player.guildId} -> ${track.title}`);
  });

  client.lunacord.on("trackEnd", ({ player, reason }) => {
    console.log(`[track:end] ${player.guildId} -> ${reason}`);
  });
};
