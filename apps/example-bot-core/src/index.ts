import { RedisCache, RedisPersistenceAdapter } from "@lunacord/cache-redis";
import { CacheManager, Lunacord, type Player } from "@lunacord/core";
import { LyricsClient } from "@lunacord/lyrics";
import { createDebugPlugin, createLoggerPlugin } from "@lunacord/plugins";
import {
  type ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  GuildMember,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { createClient } from "redis";
import { loadConfig } from "./config";

const config = loadConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const redis = config.redis ? createClient({ url: config.redis.url }) : undefined;
if (redis) {
  redis.on("error", (error) => console.error("[Redis]", error.message));
  await redis.connect();
}

const lyricsCacheStore = redis ? RedisCache.from(redis).build() : undefined;
const lyricsCacheManager = lyricsCacheStore
  ? new CacheManager({ store: lyricsCacheStore })
  : undefined;

const lyricsBuilder = LyricsClient.create().provider.lyricsOvh();
if (config.genius) {
  lyricsBuilder.provider.genius(config.genius);
}
if (lyricsCacheManager) {
  lyricsBuilder.cache(lyricsCacheManager.cache("lyrics"));
}
const lyrics = lyricsBuilder.build();

const lunacordBuilder = Lunacord.create()
  .nodes(config.nodes)
  .autoConnect(false)
  .resume(true)
  .logger(console)
  .lyrics(lyrics)
  .sendGatewayPayload((guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    guild?.shard.send(payload);
  });

if (redis) {
  lunacordBuilder.persistence(new RedisPersistenceAdapter(redis, { prefix: "lunacord:player" }));
}

const lunacord = lunacordBuilder.build();
lunacord.use(createLoggerPlugin({ name: "observer", version: "1.0.0" }));
lunacord.use(createDebugPlugin({ name: "debug", version: "1.0.0" }));

if (redis) {
  lunacord.emitDebug("manager", "Redis cache wired", { url: config.redis?.url });
}

const commandData = [
  new SlashCommandBuilder().setName("ping").setDescription("Pong."),
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song.")
    .addStringOption((option) =>
      option.setName("query").setDescription("The song to play.").setRequired(true)
    ),
].map((command) => command.toJSON());

const registerCommands = async (applicationId: string): Promise<void> => {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  if (config.installGuildId) {
    await rest.put(Routes.applicationGuildCommands(applicationId, config.installGuildId), {
      body: commandData,
    });
    return;
  }

  await rest.put(Routes.applicationCommands(applicationId), {
    body: commandData,
  });
};

const resolveVoiceChannel = async (
  interaction: ChatInputCommandInteraction
): Promise<string | undefined> => {
  if (!interaction.guild) {
    return undefined;
  }
  if (interaction.member instanceof GuildMember) {
    return interaction.member.voice.channelId ?? undefined;
  }
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.voice.channelId ?? undefined;
  } catch {
    return undefined;
  }
};

const joinAndGetPlayer = async (
  interaction: ChatInputCommandInteraction
): Promise<Player | undefined> => {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return undefined;
  }

  const channelId = await resolveVoiceChannel(interaction);
  if (!channelId) {
    await interaction.reply({
      content: "Join a voice channel first.",
      flags: MessageFlags.Ephemeral,
    });
    return undefined;
  }

  const existing = lunacord.getPlayer(guildId);
  if (existing) {
    existing.setTextChannel(interaction.channelId);
    if (!existing.isConnected) {
      await existing.connect(channelId);
      return existing;
    }
    const node = lunacord.getNodes().find((n) => n.getPlayer(guildId));
    const currentVoiceChannelId = node?.getVoiceChannelId(guildId);
    if (currentVoiceChannelId !== channelId) {
      await existing.connect(channelId);
    }
    return existing;
  }

  return lunacord
    .createPlayer()
    .setGuild(guildId)
    .setVoiceChannel(channelId)
    .setTextChannel(interaction.channelId)
    .connect();
};

client.on("raw", (packet) => {
  lunacord.handleVoicePacket(packet);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong!");
    return;
  }

  if (interaction.commandName !== "play") {
    return;
  }

  const query = interaction.options.getString("query", true);
  const player = await joinAndGetPlayer(interaction);
  if (!player) {
    return;
  }

  const result = await player.searchAndPlay(query, "ytsearch");
  if (result.loadType === "error" && result.error) {
    await interaction.reply({
      content: result.error.message ?? "Failed to load track.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply(`(core) playing ${result.tracks[0]?.title ?? query}`);
});

client.once("clientReady", async () => {
  const user = client.user;
  if (!user) {
    return;
  }

  const numShards =
    client.shard?.count ?? (client.ws.shards ? client.ws.shards.size : undefined) ?? 1;

  lunacord.bindIdentity({ userId: user.id, numShards });
  await lunacord.connect();
  if (redis) {
    await lunacord.rehydrate();
  }
  await registerCommands(user.id);

  console.log(`[Core] Ready with ${config.nodes.length} node(s).`);
});

await client.login(config.discordToken);
