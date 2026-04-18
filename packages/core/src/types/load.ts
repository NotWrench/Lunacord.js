import type { z } from "zod";
import type {
  ExceptionSchema,
  FrameStatsSchema,
  GitObjectSchema,
  InfoResponseSchema,
  LoadResultEmptySchema,
  LoadResultErrorSchema,
  LoadResultPlaylistSchema,
  LoadResultSchema,
  LoadResultSearchSchema,
  LoadResultTrackSchema,
  PlayerSchema,
  PlayerStateSchema,
  PlayerUpdateOpSchema,
  PlayerUpdatePayloadSchema,
  PlaylistInfoSchema,
  PluginObjectSchema,
  ReadyPayloadSchema,
  RoutePlannerDetailsSchema,
  RoutePlannerFailingAddressSchema,
  RoutePlannerIpBlockSchema,
  RoutePlannerStatusSchema,
  SessionSchema,
  StatsSchema,
  TrackInfoSchema,
  TrackSchema,
  VersionObjectSchema,
  VersionResponseSchema,
} from "../schemas/lavalink";

export type Exception = z.infer<typeof ExceptionSchema>;
export type TrackInfo = z.infer<typeof TrackInfoSchema>;
export type RawTrack = z.infer<typeof TrackSchema>;
export type PlaylistInfo = z.infer<typeof PlaylistInfoSchema>;

export type LoadResultTrack = z.infer<typeof LoadResultTrackSchema>;
export type LoadResultPlaylist = z.infer<typeof LoadResultPlaylistSchema>;
export type LoadResultSearch = z.infer<typeof LoadResultSearchSchema>;
export type LoadResultEmpty = z.infer<typeof LoadResultEmptySchema>;
export type LoadResultError = z.infer<typeof LoadResultErrorSchema>;
export type LoadResult = z.infer<typeof LoadResultSchema>;

export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type PlayerUpdate = z.infer<typeof PlayerUpdateOpSchema>;
export type FrameStats = z.infer<typeof FrameStatsSchema>;
export type Stats = z.infer<typeof StatsSchema>;
export type ReadyPayload = z.infer<typeof ReadyPayloadSchema>;

export type PlayerUpdatePayload = z.infer<typeof PlayerUpdatePayloadSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Session = z.infer<typeof SessionSchema>;

export type VersionObject = z.infer<typeof VersionObjectSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
export type GitObject = z.infer<typeof GitObjectSchema>;
export type PluginObject = z.infer<typeof PluginObjectSchema>;
export type InfoResponse = z.infer<typeof InfoResponseSchema>;

export type RoutePlannerIpBlock = z.infer<typeof RoutePlannerIpBlockSchema>;
export type RoutePlannerFailingAddress = z.infer<typeof RoutePlannerFailingAddressSchema>;
export type RoutePlannerDetails = z.infer<typeof RoutePlannerDetailsSchema>;
export type RoutePlannerStatus = z.infer<typeof RoutePlannerStatusSchema>;
