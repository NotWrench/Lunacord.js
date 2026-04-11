import { Client } from "discord.js";
import { Lunacord } from "../../src/index";
import { createLunacordOptions, demoIntents, loadDemoConfig } from "./config";
import { registerDiscordEvents } from "./events/discord/registerDiscordEvents";
import { registerSlashCommandsForGuild } from "./events/discord/registerSlashCommands";
import { registerLunacordEvents } from "./events/lunacord/registerLunacordEvents";

const config = loadDemoConfig();

const client = new Client({ intents: demoIntents });

let lunacord: Lunacord | null = null;

registerDiscordEvents({
  client,
  getLunacord: () => lunacord,
});

client.once("clientReady", async () => {
  console.log(`[Discord] Logged in as ${client.user?.tag}`);

  const userId = client.user?.id;
  if (!userId) {
    console.error("[Discord] Ready event fired without bot user ID.");
    return;
  }

  lunacord = new Lunacord(
    createLunacordOptions(config, userId, (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return;
      }

      guild.shard.send(payload);
    })
  );

  registerLunacordEvents(lunacord);

  try {
    await lunacord
      .createNode()
      .setId(config.node.id)
      .setHost(config.node.host)
      .setPort(config.node.port)
      .setPassword(config.node.password)
      .setSecure(config.node.secure)
      .setRegions(config.node.regions)
      .register();

    await lunacord.connect();
    await registerSlashCommandsForGuild(client, config.discordGuildId);
  } catch (error) {
    console.error(
      "[Lavalink] Failed during startup:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

client
  .login(config.discordToken)
  .catch((error) => console.error("[Discord] Login failed:", error.message));
