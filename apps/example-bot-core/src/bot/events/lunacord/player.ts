import type { LunacordEventHandler } from "../../types";

export const playerEventHandler: LunacordEventHandler = (client) => {
  client.lunacord.on("playerCreate", ({ guildId }) => {
    console.log(`[player:create] ${guildId}`);
  });

  client.lunacord.on("playerDestroy", ({ guildId }) => {
    console.log(`[player:destroy] ${guildId}`);
  });

  client.lunacord.on("playerQueueAdd", ({ guildId, track }) => {
    console.log(`[queue:add] ${guildId} -> ${track.title}`);
  });

  client.lunacord.on("playerQueueEmpty", ({ guildId, reason }) => {
    console.log(`[queue:empty] ${guildId} -> ${reason}`);
  });
};
