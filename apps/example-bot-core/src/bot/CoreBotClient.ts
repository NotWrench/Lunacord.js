import { RedisCache, RedisPersistenceAdapter } from "@lunacord/cache-redis";
import { CacheManager, Lunacord, type Player } from "@lunacord/core";
import { LyricsClient } from "@lunacord/lyrics";
import { createDebugPlugin, createLoggerPlugin } from "@lunacord/plugins";
import {
  type ChatInputCommandInteraction,
  Client,
  GuildMember,
  type InteractionReplyOptions,
  MessageFlags,
} from "discord.js";
import { createClient, type RedisClientType } from "redis";
import type { DemoConfig } from "../config";
import { BotCommandRegistry } from "./commands/registry";
import { DEFAULT_INTENTS, PLAYER_PERSISTENCE_PREFIX } from "./constants";
import type { CommandContext, DiscordEventHandler, LunacordEventHandler } from "./types";

export class CoreBotClient extends Client {
  readonly commands: BotCommandRegistry;
  readonly config: DemoConfig;
  readonly lunacord: Lunacord;

  private readyBound = false;
  private servicesReady = false;
  private redis?: RedisClientType;

  constructor(config: DemoConfig) {
    super({ intents: DEFAULT_INTENTS });
    this.config = config;
    this.commands = new BotCommandRegistry(this);

    this.lunacord = Lunacord.create()
      .nodes(config.nodes)
      .autoConnect(false)
      .resume(true)
      .logger(console)
      .sendGatewayPayload((guildId, payload) => {
        const guild = this.guilds.cache.get(guildId);
        guild?.shard.send(payload);
      })
      .build();

    this.lunacord.use(createLoggerPlugin({ name: "observer", version: "1.0.0" }));
    this.lunacord.use(createDebugPlugin({ name: "debug", version: "1.0.0" }));
  }

  registerDiscordEvents(handlers: readonly DiscordEventHandler[]): this {
    for (const handler of handlers) {
      handler(this);
    }
    return this;
  }

  registerLunacordEvents(handlers: readonly LunacordEventHandler[]): this {
    for (const handler of handlers) {
      handler(this);
    }
    return this;
  }

  async initializeServices(): Promise<void> {
    if (this.servicesReady) {
      return;
    }

    let lyricsCacheManager: CacheManager | undefined;

    if (this.config.redis) {
      this.redis = createClient({ url: this.config.redis.url });
      this.redis.on("error", (error) => console.error("[Redis]", error.message));
      await this.redis.connect();

      this.lunacord.persistence(
        new RedisPersistenceAdapter(this.redis, {
          prefix: PLAYER_PERSISTENCE_PREFIX,
        })
      );

      const lyricsCacheStore = RedisCache.from(this.redis).build();
      lyricsCacheManager = new CacheManager({ store: lyricsCacheStore });
      this.lunacord.emitDebug("manager", "Redis cache wired", {
        url: this.config.redis.url,
      });
    }

    const lyricsBuilder = LyricsClient.create().provider.lyricsOvh();
    if (this.config.genius) {
      lyricsBuilder.provider.genius(this.config.genius);
    }
    if (lyricsCacheManager) {
      lyricsBuilder.cache(lyricsCacheManager.cache("lyrics"));
    }

    this.lunacord.lyrics(lyricsBuilder.build());
    this.servicesReady = true;
  }

  async onReady(): Promise<void> {
    if (this.readyBound) {
      return;
    }

    this.readyBound = true;
    await this.initializeServices();

    const user = this.user;
    if (!user) {
      return;
    }

    const numShards = this.shard?.count ?? (this.ws.shards ? this.ws.shards.size : undefined) ?? 1;

    this.lunacord.bindIdentity({ userId: user.id, numShards });
    await this.lunacord.connect();
    if (this.redis) {
      await this.lunacord.rehydrate();
    }

    await this.commands.publish({
      applicationId: user.id,
      guildId: this.config.installGuildId,
    });

    console.log(`[CoreBot] Ready with ${this.config.nodes.length} node(s).`);
  }

  buildCommandContext(interaction: ChatInputCommandInteraction): CommandContext {
    return {
      client: this,
      interaction,
      lunacord: this.lunacord,
      getPlayer: () => this.getExistingPlayer(interaction),
      joinAndGetPlayer: () => this.joinAndGetPlayer(interaction),
      resolveVoiceChannel: () => this.resolveVoiceChannel(interaction),
      reply: (payload) => this.reply(interaction, payload),
      error: (message) => this.replyError(interaction, message),
    };
  }

  async resolveVoiceChannel(interaction: ChatInputCommandInteraction): Promise<string | undefined> {
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
  }

  getExistingPlayer(interaction: ChatInputCommandInteraction): Promise<Player | undefined> {
    const guildId = interaction.guildId;
    if (!guildId) {
      return Promise.resolve(undefined);
    }

    const player = this.lunacord.getPlayer(guildId);
    if (player) {
      player.setTextChannel(interaction.channelId);
    }

    return Promise.resolve(player);
  }

  async joinAndGetPlayer(interaction: ChatInputCommandInteraction): Promise<Player | undefined> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await this.replyError(interaction, "This command can only be used in a server.");
      return undefined;
    }

    const channelId = await this.resolveVoiceChannel(interaction);
    if (!channelId) {
      await this.replyError(interaction, "Join a voice channel first.");
      return undefined;
    }

    const existing = this.lunacord.getPlayer(guildId);
    if (existing) {
      existing.setTextChannel(interaction.channelId);
      if (!existing.isConnected) {
        await existing.connect(channelId);
      }
      return existing;
    }

    return this.lunacord
      .createPlayer()
      .setGuild(guildId)
      .setVoiceChannel(channelId)
      .setTextChannel(interaction.channelId)
      .connect();
  }

  private reply(
    interaction: ChatInputCommandInteraction,
    payload: string | InteractionReplyOptions
  ): Promise<unknown> {
    if (interaction.deferred || interaction.replied) {
      if (typeof payload === "string") {
        return interaction.editReply({ content: payload });
      }

      // editReply does not accept the ephemeral flag.
      const { flags: _flags, ...editOptions } = payload;
      return interaction.editReply(editOptions);
    }

    return interaction.reply(payload as never);
  }

  private replyError(interaction: ChatInputCommandInteraction, content: string): Promise<unknown> {
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
