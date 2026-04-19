import { RedisCache, RedisPersistenceAdapter } from "@lunacord/cache-redis";
import { CacheManager } from "@lunacord/core";
import { MusicKit } from "@lunacord/discordjs";
import { LyricsClient } from "@lunacord/lyrics";
import { createDebugPlugin, createLoggerPlugin } from "@lunacord/plugins";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "redis";
import { loadConfig } from "./config";

const config = loadConfig();

// --- Discord client ----------------------------------------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// --- Optional Redis wiring ---------------------------------------------------
const redis = config.redis ? createClient({ url: config.redis.url }) : undefined;
if (redis) {
  redis.on("error", (error) => console.error("[Redis]", error.message));
  await redis.connect();
}

// --- Optional lyrics ---------------------------------------------------------
const lyricsBuilder = LyricsClient.create().provider.lyricsOvh();
if (config.genius) {
  lyricsBuilder.provider.genius(config.genius);
}
if (redis) {
  lyricsBuilder.cache(new CacheManager().cache("lyrics"));
}
const lyrics = lyricsBuilder.build();

// --- MusicKit — the all-in-one layer ----------------------------------------
const music = MusicKit.create(client, {
  nodes: config.nodes,
  lyrics,
  logger: console,
  plugins: [
    createLoggerPlugin({ name: "observer", version: "1.0.0" }),
    createDebugPlugin({ name: "debug", version: "1.0.0" }),
  ],
  ...(redis
    ? {
        persistence: new RedisPersistenceAdapter(redis, { prefix: "lunacord:player" }),
      }
    : {}),
  onReady: async () => {
    console.log(`[MusicKit] Ready with ${config.nodes.length} node(s).`);
    // Install every default slash command to one guild (instant) OR globally (up to 1h rollout).
    if (config.installGuildId) {
      await music.commands.installDefaults({ scope: "guild", guildId: config.installGuildId });
    } else {
      await music.commands.installDefaults();
    }
  },
});

// --- Example: custom 'ping' command (additive) -------------------------------
import { SlashCommandBuilder } from "discord.js";

music.register({
  data: new SlashCommandBuilder().setName("ping").setDescription("Pong."),
  execute: async (ctx) => ctx.reply("Pong!"),
});

music.register({
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song.")
    .addStringOption((option) =>
      option.setName("query").setDescription("The song to play.").setRequired(true)
    ),
  execute: async (ctx) => {
    const query = ctx.interaction.options.getString("query", true);

    const player = await ctx.joinAndGetPlayer();
    if (!player) {
      return ctx.error("Failed to join voice channel.");
    }

    const result = await player.searchAndPlay(query, "ytsearch");
    if (result.loadType === "error" && result.error) {
      return ctx.error(result.error.message as string);
    }

    return ctx.reply(`(custom) playing ${result.tracks[0]?.title}`);
  },
});

// --- Example: add middleware to /skip (logging) ------------------------------
// music.commands.extend("skip", (ctx, next) => {
//   console.log(`[skip] ${ctx.interaction.user.tag} in ${ctx.interaction.guild?.name}`);
//   return next();
// });

// --- Wire redis cache for @lunacord/core's cache manager (optional) ----------
if (redis) {
  music.lunacord.emitDebug("manager", "Redis cache wired", { url: config.redis?.url });
  // Construct once to validate the redis client; plugins can later pull this store.
  RedisCache.from(redis).build();
}

// --- Launch ------------------------------------------------------------------
await client.login(config.discordToken);
