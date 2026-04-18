import type { MessageKey, MessageTable } from "./types";

/**
 * Default command reply strings. Placeholders use the `{name}` form (plain curlies — NOT
 * template-literal `${name}`) so they can live inside regular string literals without
 * clashing with the `noTemplateCurlyInString` lint rule. They're interpolated by
 * {@link resolveMessage}.
 */
export const DEFAULT_MESSAGES: Record<MessageKey, string> = {
  notInServer: "This command can only be used in a server.",
  joinVoiceFirst: "Join a voice channel first.",
  nothingPlaying: "Nothing is playing.",
  emptyQueue: "The queue is empty.",
  failedLoad: "Failed to load track.",
  playerConnecting: "Connecting to voice…",
  nowPlaying: "Now playing: **{title}**",
  queued: "Queued: **{title}**",
  playlistLoaded: "Playlist loaded: **{name}** ({count} tracks).",
  paused: "Paused.",
  resumed: "Resumed.",
  stopped: "Stopped.",
  skipped: "Skipped.",
  cleared: "Queue cleared.",
  volumeSet: "Volume set to {volume}%.",
  seekTo: "Seeked to {position}.",
  repeatTrackOn: "Repeat track: on.",
  repeatTrackOff: "Repeat track: off.",
  repeatQueueOn: "Repeat queue: on.",
  repeatQueueOff: "Repeat queue: off.",
  filterApplied: "Filter applied: {name}.",
  filterCleared: "Filters cleared.",
  shuffled: "Queue shuffled.",
  disconnected: "Left the voice channel.",
  lyricsNotFound: "No lyrics found for the current track.",
  lyricsUnavailable: "Lyrics provider isn't configured on this bot.",
};

const VAR_REGEX = /\{(\w+)\}/g;

export const resolveMessage = (
  table: MessageTable,
  key: MessageKey,
  vars?: Record<string, string | number>
): string => {
  const template = table[key] ?? DEFAULT_MESSAGES[key] ?? key;
  if (!vars) {
    return template;
  }
  return template.replace(VAR_REGEX, (_, name) => {
    const value = vars[name as string];
    return value === undefined ? `{${name}}` : String(value);
  });
};
