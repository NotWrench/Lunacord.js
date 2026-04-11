import type { Track } from "../../domain/track/Track";
import type { LyricsRequestOptions } from "../../types";

const BRACKETED_CONTENT_REGEX = /\[[^\]]*]|\([^)]*\)|\{[^}]*}/g;
const TITLE_NOISE_REGEX =
  /\b(official( music)? video|official audio|lyrics?|audio|video|hd|4k|visualizer)\b/gi;
const SEPARATOR_REGEX = /[-–—:|]/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/g;
const MULTISPACE_REGEX = /\s+/g;
const QUERY_SPLIT_REGEX = /\s[-–—:|]\s/;
const LEADING_ARTIST_PREFIX_REGEX = /^(.+?)\s*[-–—:|]\s*(.+)$/;

export interface LyricsLookupCandidate {
  artist: string;
  title: string;
}

export const DEFAULT_LYRICS_REQUEST_TIMEOUT_MS = 10_000;

export const sanitizeQueryPart = (value: string): string =>
  value.replace(BRACKETED_CONTENT_REGEX, " ").replace(TITLE_NOISE_REGEX, " ").trim();

export const normalizeForComparison = (value: string): string =>
  sanitizeQueryPart(value)
    .replace(SEPARATOR_REGEX, " ")
    .replace(NON_ALPHANUMERIC_REGEX, " ")
    .replace(MULTISPACE_REGEX, " ")
    .trim()
    .toLowerCase();

export const scoreSimilarity = (left: string, right: string): number => {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.9;
  }

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap++;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
};

export const buildLyricsLookupCandidates = (
  track: Track,
  options?: LyricsRequestOptions
): LyricsLookupCandidate[] => {
  const candidates: LyricsLookupCandidate[] = [];
  const addCandidate = (artist: string, title: string): void => {
    const nextArtist = artist.trim();
    const nextTitle = title.trim();

    if (!nextArtist || !nextTitle) {
      return;
    }

    if (
      candidates.some(
        (candidate) => candidate.artist === nextArtist && candidate.title === nextTitle
      )
    ) {
      return;
    }

    candidates.push({
      artist: nextArtist,
      title: nextTitle,
    });
  };

  const sanitizedArtist = sanitizeQueryPart(track.author);
  const sanitizedTitle = sanitizeQueryPart(track.title);
  const dedupedTitle = stripArtistPrefix(track.title, track.author);
  const sanitizedDedupedTitle = stripArtistPrefix(sanitizedTitle, sanitizedArtist);

  if (options?.query) {
    const query = options.query.trim();
    const [artistPart, titlePart] = query.split(QUERY_SPLIT_REGEX, 2);
    if (artistPart && titlePart) {
      addCandidate(artistPart, titlePart);
    }

    addCandidate(track.author, query);
    addCandidate(sanitizedArtist, query);
  }

  addCandidate(track.author, dedupedTitle);
  addCandidate(sanitizedArtist, sanitizedDedupedTitle);
  addCandidate(track.author, track.title);
  addCandidate(sanitizedArtist, sanitizedTitle);

  return candidates;
};

export const buildGeniusQueries = (track: Track, options?: LyricsRequestOptions): string[] => {
  const queries: string[] = [];
  const addQuery = (query: string): void => {
    const nextQuery = query.trim();
    if (!nextQuery || queries.includes(nextQuery)) {
      return;
    }

    queries.push(nextQuery);
  };

  if (options?.query) {
    addQuery(options.query);
  }

  const sanitizedArtist = sanitizeQueryPart(track.author);
  const sanitizedTitle = sanitizeQueryPart(track.title);
  const dedupedTitle = stripArtistPrefix(track.title, track.author);
  const sanitizedDedupedTitle = stripArtistPrefix(sanitizedTitle, sanitizedArtist);

  addQuery(`${track.title} ${track.author}`);
  addQuery(`${dedupedTitle} ${track.author}`);
  addQuery(`${sanitizedTitle} ${sanitizedArtist}`);
  addQuery(`${sanitizedDedupedTitle} ${sanitizedArtist}`);
  addQuery(track.title);
  addQuery(dedupedTitle);
  addQuery(sanitizedTitle);
  addQuery(sanitizedDedupedTitle);

  return queries;
};

const stripArtistPrefix = (title: string, artist: string): string => {
  const match = title.match(LEADING_ARTIST_PREFIX_REGEX);
  if (!match) {
    return title.trim();
  }

  const [, possibleArtist, possibleTitle] = match;
  if (!possibleArtist || !possibleTitle) {
    return title.trim();
  }

  return normalizeForComparison(possibleArtist) === normalizeForComparison(artist)
    ? possibleTitle.trim()
    : title.trim();
};

export const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    return new Response(null, {
      status: 503,
      statusText: "Provider unavailable",
    });
  } finally {
    clearTimeout(timeout);
  }
};
