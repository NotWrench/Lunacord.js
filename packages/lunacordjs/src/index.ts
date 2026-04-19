/**
 * `lunacord.js` — single entry for Lunacord + optional Discord.js MusicKit, plugins,
 * lyrics, and Redis helpers. Prefer `@lunacord/*` scoped packages when you want tighter
 * dependency boundaries; this package re-exports them for convenience.
 */

export type { RedisPersistenceAdapterOptions } from "@lunacord/cache-redis";
export {
  RedisCache,
  RedisCacheBuilder,
  RedisCacheStore,
  RedisPersistenceAdapter,
} from "@lunacord/cache-redis";
export * from "@lunacord/core";
export type {
  ApplicationCommandsJsonBody,
  CommandContext,
  CommandMiddleware,
  CommandReplyOptions,
  DefaultCommandName,
  InstallDefaultsOptions,
  LocalizedString,
  MessageKey,
  MessageTable,
  MusicCommand,
  MusicEmbedFactory,
  MusicKitOptions,
  SlashCommandData,
} from "@lunacord/discordjs";
export {
  CommandRegistry,
  DEFAULT_MESSAGES,
  defaultEmbedFactory,
  MusicKit,
  resolveMessage,
} from "@lunacord/discordjs";
export type {
  GeniusOAuthExchangeOptions,
  GeniusOAuthTokenResponse,
  TrackLyricsClient,
} from "@lunacord/lyrics";
export {
  GeniusClient,
  GeniusOAuthHelper,
  LyricsBuilder,
  LyricsClient,
  LyricsOvhClient,
} from "@lunacord/lyrics";
export type {
  AutoplayContext,
  AutoplayPluginOptions,
  DebugPluginOptions,
  LoggerPluginOptions,
  StatsReporterPluginOptions,
} from "@lunacord/plugins";
export {
  createAutoplayPlugin,
  createDebugPlugin,
  createLoggerPlugin,
  createMetricsPlugin,
  createStatsReporterPlugin,
} from "@lunacord/plugins";
export type { CreateLunacordMusicClientOptions } from "./preset";
export { createLunacordMusicClient } from "./preset";
