import { Client } from "discord.js";
import { createClient } from "redis";
import { RedisCacheStore } from "../../src/cache";
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

  const redisClient = createClient({
    ...(config.redis.password ? { password: config.redis.password } : {}),
    ...(config.redis.username ? { username: config.redis.username } : {}),
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
  });
  redisClient.on("error", (error) => {
    console.error("[Redis] Client error:", error.message);
  });

  try {
    await redisClient.connect();

    lunacord = new Lunacord(
      createLunacordOptions(
        config,
        userId,
        (guildId, payload) => {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) {
            return;
          }

          guild.shard.send(payload);
        },
        new RedisCacheStore(redisClient)
      )
    );

    registerLunacordEvents(lunacord);

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
    if (redisClient.isOpen) {
      await redisClient.quit();
    }

    console.error(
      "[Lavalink] Failed during startup:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

client
  .login(config.discordToken)
  .catch((error) => console.error("[Discord] Login failed:", error.message));
