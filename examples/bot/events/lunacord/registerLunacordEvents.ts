import type { Client } from "discord.js";
import type { Lunacord } from "../../../../src/index";

interface RegisterLunacordEventsOptions {
  client: Client;
  lunacord: Lunacord;
}

const sendToPlayerTextChannel = async (
  client: Client,
  channelId: string | null,
  message: string
): Promise<void> => {
  if (!channelId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    await channel.send({ content: message });
  } catch (error) {
    console.warn(
      "[Discord] Failed to send player update:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

export const registerLunacordEvents = ({
  client,
  lunacord,
}: RegisterLunacordEventsOptions): void => {
  lunacord
    .createPlugin("demo-observer", "1.0.0")
    .observe((event) => {
      if (event.type === "playerSeek") {
        console.log(`[Plugin] Seeked guild ${event.guildId} to ${event.position}ms`);
      }
    })
    .use();

  lunacord.on("nodeCreate", ({ node }) => console.log(`[Lavalink] Node created: ${node.id}`));
  lunacord.on("nodeConnect", ({ node }) => console.log(`[Lavalink] Node connected: ${node.id}`));
  lunacord.on("trackStart", ({ player, track }) => {
    console.log(`[Lavalink] Playing: ${track.title}`);
    void sendToPlayerTextChannel(client, player.textChannelId, `Now playing: **${track.title}**`);
  });
  lunacord.on("trackEnd", ({ reason, track }) =>
    console.log(`[Lavalink] Track ended: ${track.title} (${reason})`)
  );
  lunacord.on("playerRepeatTrack", ({ enabled, guildId }) => {
    console.log(`[Lavalink] Repeat track ${enabled ? "enabled" : "disabled"} for guild ${guildId}`);
  });
  lunacord.on("playerRepeatQueue", ({ enabled, guildId }) => {
    console.log(`[Lavalink] Repeat queue ${enabled ? "enabled" : "disabled"} for guild ${guildId}`);
  });
  lunacord.on("trackException", ({ exception, track }) =>
    console.error(
      `[Lavalink] Track exception: ${track.title}`,
      `\n  Severity: ${exception.severity}`,
      `\n  Message: ${exception.message}`,
      exception.cause ? `\n  Cause: ${exception.cause}` : ""
    )
  );
  lunacord.on("ws", (event) => {
    switch (event.type) {
      case "nodeReconnecting":
        console.warn(
          `[Lavalink] Node ${event.node.id} reconnecting (attempt ${event.attempt}, retry in ${event.delay}ms)`
        );
        break;
      case "nodeDisconnect":
        console.warn(
          `[Lavalink] Node ${event.node.id} disconnected (${event.code} ${event.reason})`
        );
        break;
      default:
        break;
    }
  });
  lunacord.on("nodeVoiceSocketClosed", (event) => {
    const source = event.byRemote ? "remote" : "local";
    console.warn(
      `[Lavalink] Voice websocket closed (${source}) for guild ${event.guildId} on ${event.node.id}: ${event.code} ${event.reason}`
    );
  });
  lunacord.on("nodeError", (error) =>
    console.error(`[Lavalink] Node error (${error.node.id}):`, error.message)
  );
  lunacord.on("error", (error) => console.error("[Lavalink] Error:", error.message));
};
