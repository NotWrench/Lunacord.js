import type { DiscordEventHandler } from "../../types";

export const rawEventHandler: DiscordEventHandler = (client) => {
  client.on("raw", (packet) => {
    client.lunacord.handleVoicePacket(packet);
  });
};
