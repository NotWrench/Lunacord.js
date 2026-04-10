import type { CreatePlayerOptions, Lunacord } from "../core/Lunacord";
import type { VoiceConnectOptions } from "../core/Node";
import type { Player } from "../core/Player";
import { InvalidPlayerStateError } from "../errors/LunacordError";

type BuilderFlag = true | false;

type PlayerBuilderState = {
  guild: BuilderFlag;
  text: BuilderFlag;
  voice: BuilderFlag;
};

type PlayerBuilderConfig = CreatePlayerOptions &
  VoiceConnectOptions & {
    guildId?: string;
    textChannelId?: string;
    voiceChannelId?: string;
  };

export type PlayerBuilderStart = PlayerBuilder<{
  guild: false;
  text: false;
  voice: false;
}>;

type WithState<TState extends PlayerBuilderState, TKey extends keyof PlayerBuilderState> = Omit<
  TState,
  TKey
> &
  Record<TKey, true>;

type PlayerBuilderReadyState = {
  guild: true;
  text: true;
  voice: true;
};

/**
 * Fluent type-state builder for player creation.
 */
export class PlayerBuilder<TState extends PlayerBuilderState> {
  private readonly client: Lunacord;
  private readonly config: PlayerBuilderConfig;

  constructor(client: Lunacord, config: PlayerBuilderConfig = {}) {
    this.client = client;
    this.config = config;
  }

  /**
   * Builds and connects the player once all required fields are configured.
   */
  readonly connect = (async (): Promise<Player> =>
    this.connectInternal()) as TState extends PlayerBuilderReadyState
    ? () => Promise<Player>
    : never;

  /**
   * Sets the guild that owns the player.
   */
  setGuild(guildId: string): PlayerBuilder<WithState<TState, "guild">> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      guildId,
    });
  }

  /**
   * Sets the voice channel the player will connect to.
   */
  setVoiceChannel(channelId: string): PlayerBuilder<WithState<TState, "voice">> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      voiceChannelId: channelId,
    });
  }

  /**
   * Sets the text channel associated with this player.
   */
  setTextChannel(channelId: string): PlayerBuilder<WithState<TState, "text">> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      textChannelId: channelId,
    });
  }

  /**
   * Prefers a region when choosing a node for this player.
   */
  preferRegion(region: string): PlayerBuilder<TState> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      region,
    });
  }

  /**
   * Restricts node selection to a preferred subset.
   */
  preferNodes(nodeIds: readonly string[]): PlayerBuilder<TState> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      preferredNodeIds: [...nodeIds],
    });
  }

  /**
   * Overrides the queue history size for this player.
   */
  withHistoryLimit(historyMaxSize: number): PlayerBuilder<TState> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      historyMaxSize,
    });
  }

  /**
   * Configures the queue-empty callback for this player.
   */
  onQueueEmpty(handler: NonNullable<CreatePlayerOptions["onQueueEmpty"]>): PlayerBuilder<TState> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      onQueueEmpty: handler,
    });
  }

  /**
   * Configures the voice self-deaf flag used during connect.
   */
  withSelfDeaf(selfDeaf: boolean): PlayerBuilder<TState> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      selfDeaf,
    });
  }

  /**
   * Configures the voice self-mute flag used during connect.
   */
  withSelfMute(selfMute: boolean): PlayerBuilder<TState> {
    return new PlayerBuilder(this.client, {
      ...this.config,
      selfMute,
    });
  }

  private async connectInternal(): Promise<Player> {
    const guildId = this.config.guildId;
    const voiceChannelId = this.config.voiceChannelId;
    const textChannelId = this.config.textChannelId;

    if (!guildId || !voiceChannelId || !textChannelId) {
      throw new InvalidPlayerStateError({
        code: "PLAYER_NOT_READY",
        message: "Cannot connect a player before guild, voice channel, and text channel are set",
        context: {
          guildId: guildId ?? "unknown",
          operation: "playerBuilder.connect",
        },
      });
    }

    const player = this.client.createPlayer(guildId, {
      historyMaxSize: this.config.historyMaxSize,
      onQueueEmpty: this.config.onQueueEmpty,
      preferredNodeIds: this.config.preferredNodeIds,
      region: this.config.region,
    });

    player.setTextChannel(textChannelId);
    await player.connect(voiceChannelId, {
      selfDeaf: this.config.selfDeaf,
      selfMute: this.config.selfMute,
      timeoutMs: this.config.timeoutMs,
    });

    return player;
  }
}
