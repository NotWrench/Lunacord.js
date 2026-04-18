import {
  Lunacord,
  type LunacordLogger,
  type LunacordNodeOptions,
  type LunacordNodeSelectionStrategy,
  type LunacordPlugin,
  type LyricsProvider,
  type PersistenceAdapter,
  type Player,
} from "@lunacord/core";
import {
  type ChatInputCommandInteraction,
  type Client,
  GuildMember,
  type Interaction,
  MessageFlags,
} from "discord.js";
import { intentName, validateIntents } from "./adapter/intents";
import { CommandRegistry } from "./CommandRegistry";
import { defaultEmbedFactory, type MusicEmbedFactory } from "./embeds";
import { DEFAULT_MESSAGES, resolveMessage } from "./messages";
import type { CommandContext, MessageKey, MessageTable, MusicCommand } from "./types";

export interface MusicKitOptions {
  /** Auto-migrate players off dead nodes. Default `true`. */
  autoMigrate?: boolean | { preferredNodeIds?: readonly string[] };
  /** Auto-rehydrate players from persistence on startup. Default `true` when a persistence adapter is installed. */
  autoRehydrate?: boolean;
  /** Custom client name passed to Lavalink. */
  clientName?: string;
  /** Custom embed factory. */
  embeds?: MusicEmbedFactory;
  /** Attach a logger. Debug events are forwarded automatically if set. */
  logger?: LunacordLogger;
  /** Optional lyrics provider (e.g. `@lunacord/lyrics`). */
  lyrics?: LyricsProvider;
  /** Custom message strings (localization). */
  messages?: MessageTable;
  /** Node selection strategy. Defaults to `leastLoaded`. */
  nodeSelection?: LunacordNodeSelectionStrategy;
  /**
   * Lavalink nodes. Required to actually play anything.
   */
  nodes: readonly LunacordNodeOptions[];
  /** Called after `client` is ready and Lunacord is connected. */
  onReady?: (musicKit: MusicKit) => void | Promise<void>;
  /** Optional persistence adapter (e.g. `@lunacord/cache-redis` RedisPersistenceAdapter). */
  persistence?: PersistenceAdapter;
  /** Additional plugins to install. */
  plugins?: readonly LunacordPlugin[];
  /** Enable Lavalink resume. Default `true`. */
  resume?: boolean;
  /** Skip intent validation (not recommended). */
  skipIntentCheck?: boolean;
}

/**
 * Batteries-included music layer for discord.js — the all-in-one entrypoint.
 *
 * ```ts
 * import { Client, GatewayIntentBits } from "discord.js";
 * import { MusicKit } from "@lunacord/discordjs";
 *
 * const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
 * const music = MusicKit.create(client, {
 *   nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
 * });
 *
 * await music.commands.installDefaults();
 * await client.login(process.env.DISCORD_TOKEN);
 * ```
 */
export class MusicKit {
  /** Factory. Wires raw-packet forwarding, op:4 sends, intent validation, and identity binding. */
  static create(client: Client, options: MusicKitOptions): MusicKit {
    return new MusicKit(client, options);
  }

  readonly client: Client;
  readonly lunacord: Lunacord;
  readonly commands: CommandRegistry;
  readonly embeds: MusicEmbedFactory;
  private readonly messageTable: MessageTable;
  private readonly options: MusicKitOptions;
  private readyBound = false;

  private constructor(client: Client, options: MusicKitOptions) {
    this.client = client;
    this.options = options;
    this.embeds = options.embeds ?? defaultEmbedFactory;
    this.messageTable = { ...DEFAULT_MESSAGES, ...(options.messages ?? {}) };

    // Validate intents eagerly with a helpful error.
    if (!options.skipIntentCheck) {
      const result = validateIntents(client);
      if (!result.ok) {
        const names = result.missing.map(intentName).join(", ");
        throw new Error(
          `@lunacord/discordjs: missing Discord gateway intents: ${names}.\n  → Add GatewayIntentBits.Guilds and GatewayIntentBits.GuildVoiceStates to your Client intents.`
        );
      }
    }

    // Build Lunacord with all wiring pre-configured.
    const builder = Lunacord.create()
      .nodes(options.nodes)
      .autoConnect(false)
      .resume(options.resume ?? true)
      .sendGatewayPayload((guildId, payload) => {
        const guild = this.client.guilds.cache.get(guildId);
        guild?.shard.send(payload);
      });

    if (options.clientName !== undefined) {
      builder.clientName(options.clientName);
    }
    if (options.nodeSelection === undefined) {
      builder.nodeSelection.leastLoaded();
    } else {
      builder.nodeSelection.custom(options.nodeSelection);
    }
    if (options.autoMigrate !== false) {
      builder.autoMigrate(options.autoMigrate === undefined ? true : options.autoMigrate);
    }
    if (options.logger) {
      builder.logger(options.logger);
    }
    if (options.lyrics) {
      builder.lyrics(options.lyrics);
    }
    if (options.persistence) {
      builder.persistence(options.persistence);
    }

    this.lunacord = builder.build();

    for (const plugin of options.plugins ?? []) {
      this.lunacord.use(plugin);
    }

    this.commands = new CommandRegistry(this);

    this.attachGatewayForwarding();
    this.attachInteractionHandler();
    this.attachReadyHandler();
  }

  /** Resolve a message by key, with optional string interpolation via `${name}`. */
  message(key: MessageKey, vars?: Record<string, string | number>): string {
    return resolveMessage(this.messageTable, key, vars);
  }

  /** Return the player for a guild (or undefined). */
  getPlayer(guildId: string): Player | undefined {
    return this.lunacord.getPlayer(guildId);
  }

  /**
   * Resolve the user's current voice channel id from an interaction. Works both for
   * cached members and when only a partial member object is on the interaction.
   */
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

  /**
   * Returns the existing player for the interaction's guild, or `undefined`. Updates the
   * player's text-channel id to the interaction channel as a side effect.
   */
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

  /**
   * Returns the player for the interaction's guild, creating it and joining the user's
   * voice channel if necessary. Sends an ephemeral error reply and returns `undefined` if
   * the user isn't in a voice channel.
   */
  async joinAndGetPlayer(interaction: ChatInputCommandInteraction): Promise<Player | undefined> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await this.replyEphemeral(interaction, this.message("notInServer"));
      return undefined;
    }

    const existing = this.lunacord.getPlayer(guildId);
    if (existing) {
      existing.setTextChannel(interaction.channelId);
      if (existing.isConnected) {
        return existing;
      }
      const channelId = await this.resolveVoiceChannel(interaction);
      if (!channelId) {
        await this.replyEphemeral(interaction, this.message("joinVoiceFirst"));
        return undefined;
      }
      await existing.connect(channelId);
      return existing;
    }

    const channelId = await this.resolveVoiceChannel(interaction);
    if (!channelId) {
      await this.replyEphemeral(interaction, this.message("joinVoiceFirst"));
      return undefined;
    }

    return this.lunacord
      .createPlayer()
      .setGuild(guildId)
      .setVoiceChannel(channelId)
      .setTextChannel(interaction.channelId)
      .connect();
  }

  /**
   * Explicitly register a custom command. Most apps call
   * `music.commands.installDefaults()` instead.
   */
  register(command: MusicCommand): this {
    this.commands.register(command.data.name ?? "", command);
    return this;
  }

  destroy(): Promise<void> {
    return this.lunacord.disconnect();
  }

  /** Build a typed CommandContext for a given interaction. */
  buildContext(interaction: ChatInputCommandInteraction): CommandContext {
    return {
      client: this.client,
      interaction,
      lunacord: this.lunacord,
      music: this,
      getPlayer: () => this.getExistingPlayer(interaction),
      joinAndGetPlayer: () => this.joinAndGetPlayer(interaction),
      resolveVoiceChannel: () => this.resolveVoiceChannel(interaction),
      reply: (payload) => this.reply(interaction, payload),
      error: (message) => this.replyEphemeral(interaction, message),
    };
  }

  private attachGatewayForwarding(): void {
    // Forward every raw gateway packet — Lunacord filters VOICE_STATE_UPDATE / VOICE_SERVER_UPDATE.
    this.client.on("raw", (packet) => {
      this.lunacord.handleVoicePacket(packet);
    });
  }

  private attachInteractionHandler(): void {
    this.client.on("interactionCreate", async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }
      const command = this.commands.get(interaction.commandName);
      if (!command) {
        return;
      }
      const ctx = this.buildContext(interaction);
      try {
        await this.commands.dispatch(command.data.name, ctx);
      } catch (error) {
        await ctx.error(error instanceof Error ? error.message : "Command failed unexpectedly.");
      }
    });
  }

  private attachReadyHandler(): void {
    const onReady = async (): Promise<void> => {
      if (this.readyBound) {
        return;
      }
      this.readyBound = true;
      const user = this.client.user;
      if (!user) {
        return;
      }
      const numShards =
        this.client.shard?.count ??
        (this.client.ws.shards ? this.client.ws.shards.size : undefined) ??
        1;
      this.lunacord.bindIdentity({ userId: user.id, numShards });
      await this.lunacord.connect();
      if (this.options.autoRehydrate !== false && this.options.persistence) {
        await this.lunacord.rehydrate();
      }
      await this.options.onReady?.(this);
    };

    const swallow = (error: unknown): void => {
      const message = error instanceof Error ? error.message : String(error);
      this.lunacord.emitDebug("manager", "MusicKit ready handler failed", { error: message });
    };
    this.client.once("clientReady", () => {
      onReady().catch(swallow);
    });
    this.client.once("ready", () => {
      onReady().catch(swallow);
    });
  }

  private reply(
    interaction: ChatInputCommandInteraction,
    payload: string | object
  ): Promise<unknown> {
    const options = typeof payload === "string" ? { content: payload } : payload;
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(options);
    }
    return interaction.reply(options as never);
  }

  private replyEphemeral(
    interaction: ChatInputCommandInteraction,
    content: string
  ): Promise<unknown> {
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
