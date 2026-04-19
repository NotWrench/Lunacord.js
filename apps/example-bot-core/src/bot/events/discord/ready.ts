import type { DiscordEventHandler } from "../../types";

export const readyEventHandler: DiscordEventHandler = (client) => {
  const onReady = (): void => {
    client.onReady().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      client.lunacord.emitDebug("manager", "CoreBot ready handler failed", {
        error: message,
      });
    });
  };

  client.once("clientReady", onReady);
  client.once("ready", onReady); // Going to be deprecated in discord.js v14, but we still want to support it for now
};
