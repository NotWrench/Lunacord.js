import { normalizeForComparison } from "../lyrics/shared";
import type { Track } from "../structures/Track";

export const buildTrackCacheKey = (track: Track): string => {
  const normalizedIsrc = track.isrc?.trim().toLowerCase();
  if (normalizedIsrc) {
    return `isrc:${normalizedIsrc}`;
  }

  const normalizedSourceName = track.sourceName.trim().toLowerCase();
  const normalizedIdentifier = track.identifier.trim().toLowerCase();
  if (normalizedSourceName && normalizedIdentifier) {
    return `source:${normalizedSourceName}:${normalizedIdentifier}`;
  }

  const normalizedArtist = normalizeForComparison(track.author);
  const normalizedTitle = normalizeForComparison(track.title);
  if (normalizedArtist || normalizedTitle) {
    return `meta:${normalizedArtist}:${normalizedTitle}`;
  }

  return `encoded:${track.encoded}`;
};
