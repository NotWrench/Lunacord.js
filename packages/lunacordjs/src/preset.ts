import type { MusicKitOptions } from "@lunacord/discordjs";
import { MusicKit } from "@lunacord/discordjs";
import { Client, type ClientOptions, GatewayIntentBits } from "discord.js";

const defaultMusicIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];

export type CreateLunacordMusicClientOptions = MusicKitOptions & {
  /**
   * discord.js `Client` options. If `intents` is omitted, defaults to Guilds +
   * GuildVoiceStates (required by MusicKit).
   */
  discord?: Omit<ClientOptions, "intents"> & { intents?: ClientOptions["intents"] };
};

/**
 * Creates a discord.js {@link Client} and a {@link MusicKit} wired the same way as
 * {@link MusicKit.create}, with sensible default intents for slash + voice music bots.
 */
export function createLunacordMusicClient(options: CreateLunacordMusicClientOptions): {
  client: Client;
  music: MusicKit;
} {
  const { discord, ...musicKitOptions } = options;
  const intents = discord?.intents ?? defaultMusicIntents;
  const client = new Client({
    ...discord,
    intents,
  });
  const music = MusicKit.create(client, musicKitOptions);
  return { client, music };
}
