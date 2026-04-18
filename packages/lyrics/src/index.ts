// Re-export core types so consumers don't need to import them separately
export type {
  GeniusOptions,
  Lyrics,
  LyricsOptions,
  LyricsProvider,
  LyricsRequestOptions,
  LyricsResult,
  LyricsUnavailableReason,
} from "@lunacord/core";
export { LyricsBuilder } from "./LyricsBuilder";
export type { TrackLyricsClient } from "./LyricsClient";
export { LyricsClient } from "./LyricsClient";
export { GeniusClient } from "./providers/GeniusClient";
export type {
  GeniusOAuthExchangeOptions,
  GeniusOAuthTokenResponse,
} from "./providers/GeniusOAuthHelper";
export { GeniusOAuthHelper } from "./providers/GeniusOAuthHelper";
export { LyricsOvhClient } from "./providers/LyricsOvhClient";
