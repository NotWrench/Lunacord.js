import type {
  GeniusOptions,
  LyricsRequestOptions,
  LyricsResult,
  LyricsUnavailableReason,
  Track,
} from "@lunacord/core";
import { z } from "zod";
import {
  buildGeniusQueries,
  DEFAULT_LYRICS_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  normalizeForComparison,
  scoreSimilarity,
} from "../shared";

const GENIUS_API_BASE_URL = "https://api.genius.com";
const MINIMUM_MATCH_SCORE = 0.35;
const LYRICS_CONTAINER_MARKERS = [
  'data-lyrics-container="true"',
  "data-lyrics-container='true'",
] as const;
const LEGACY_LYRICS_REGEX = /<div[^>]*class="lyrics"[^>]*>([\s\S]*?)<\/div>/i;
const BR_TAG_REGEX = /<br\s*\/?>/gi;
const SELF_CLOSING_TAG_REGEX = /\/\s*>$/;
const BLOCK_CLOSE_TAG_REGEX = /<\/(p|div|h2|h3|li|section)>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const WHITESPACE_BEFORE_NEWLINE_REGEX = /[ \t]+\n/g;
const EXCESS_NEWLINES_REGEX = /\n{3,}/g;
const LEADING_CONTRIBUTOR_LINE_REGEX = /^\d+\s+contributors?(translations.*)?$/i;
const LEADING_TRANSLATIONS_LINE_REGEX =
  /^(translations?|contributors?|english|espa[ñn]ol|portugu[eê]s|fran[cç]ais|deutsch|italiano|dansk|cymraeg|русский|українська|ελληνικά)\b/i;
const SECTION_HEADER_REGEX = /^\[[^\]]+]$/;
const TRAILING_EMBED_LINE_REGEX = /^\d*\s*embed$/i;
const HTML_ENTITY_REGEX = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;

const GeniusSearchHitSchema = z.object({
  result: z.object({
    id: z.number(),
    title: z.string(),
    url: z.string(),
    song_art_image_url: z.string().nullable().optional(),
    release_date_for_display: z.string().nullable().optional(),
    primary_artist: z.object({
      name: z.string(),
    }),
  }),
});

const GeniusSearchResponseSchema = z.object({
  response: z.object({
    hits: z.array(GeniusSearchHitSchema),
  }),
});

type GeniusSearchHit = z.infer<typeof GeniusSearchHitSchema>;
type GeniusSearchOutcome =
  | {
      hits: GeniusSearchHit[];
    }
  | LyricsResult;

export class GeniusClient {
  private readonly options: GeniusOptions | undefined;
  private readonly requestTimeoutMs: number;

  constructor(options?: GeniusOptions) {
    this.options = options;
    this.requestTimeoutMs = options?.requestTimeoutMs ?? DEFAULT_LYRICS_REQUEST_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return Boolean(this.options?.accessToken && this.options.clientId && this.options.clientSecret);
  }

  async getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
    if (!this.isConfigured()) {
      return unavailable("missing_credentials");
    }

    const queries = buildGeniusQueries(track, options);

    for (const query of queries) {
      const searchResult = await this.search(query);
      if (!("hits" in searchResult)) {
        if (searchResult.status === "not_found") {
          continue;
        }

        return searchResult;
      }

      const match = this.pickBestMatch(track, searchResult.hits);
      if (!match) {
        continue;
      }

      const lyricsText = await this.fetchLyricsText(match.result.url);
      if (!("value" in lyricsText)) {
        return lyricsText;
      }

      return {
        status: "found",
        lyrics: {
          title: match.result.title,
          artist: match.result.primary_artist.name,
          url: match.result.url,
          lyricsText: lyricsText.value,
          albumArtUrl: match.result.song_art_image_url ?? null,
          releaseDate: match.result.release_date_for_display ?? null,
          geniusId: match.result.id,
        },
      };
    }

    return {
      status: "not_found",
    };
  }

  private async search(query: string): Promise<GeniusSearchOutcome> {
    const response = await fetchWithTimeout(
      `${GENIUS_API_BASE_URL}/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${this.options?.accessToken}`,
        },
      },
      this.requestTimeoutMs
    );

    if (!response.ok) {
      return unavailable(this.getUnavailableReason(response.status));
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return unavailable("provider_unavailable");
    }

    const parsed = GeniusSearchResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return unavailable("provider_unavailable");
    }

    if (parsed.data.response.hits.length === 0) {
      return {
        status: "not_found",
      };
    }

    return {
      hits: parsed.data.response.hits,
    };
  }

  private pickBestMatch(track: Track, hits: GeniusSearchHit[]): GeniusSearchHit | undefined {
    const normalizedTrackTitle = normalizeForComparison(track.title);
    const normalizedTrackAuthor = normalizeForComparison(track.author);

    let bestScore = 0;
    let bestHit: GeniusSearchHit | undefined;

    for (const hit of hits) {
      const normalizedHitTitle = normalizeForComparison(hit.result.title);
      const normalizedHitArtist = normalizeForComparison(hit.result.primary_artist.name);
      const titleScore = scoreSimilarity(normalizedTrackTitle, normalizedHitTitle);
      const artistScore = scoreSimilarity(normalizedTrackAuthor, normalizedHitArtist);
      const totalScore = titleScore * 0.7 + artistScore * 0.3;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestHit = hit;
      }
    }

    return bestScore >= MINIMUM_MATCH_SCORE ? bestHit : undefined;
  }

  private async fetchLyricsText(url: string): Promise<
    | {
        value: string;
      }
    | LyricsResult
  > {
    const response = await fetchWithTimeout(url, {}, this.requestTimeoutMs);

    if (!response.ok) {
      return unavailable(this.getUnavailableReason(response.status));
    }

    let html: string;
    try {
      html = await response.text();
    } catch {
      return unavailable("provider_unavailable");
    }

    const lyricsText = extractLyricsText(html);
    if (!lyricsText) {
      return unavailable("unsupported");
    }

    return {
      value: lyricsText,
    };
  }

  private getUnavailableReason(status: number): LyricsUnavailableReason {
    switch (status) {
      case 401:
      case 403:
        return "invalid_token";
      case 429:
        return "rate_limited";
      case 400:
      case 404:
      case 405:
      case 501:
        return "unsupported";
      default:
        return "provider_unavailable";
    }
  }
}

const extractLyricsText = (html: string): string | null => {
  const matches = extractLyricsContainers(html);
  if (matches.length > 0) {
    return normalizeLyricsHtml(matches.join("\n"));
  }

  const legacyMatch = html.match(LEGACY_LYRICS_REGEX)?.[1];
  if (legacyMatch) {
    return normalizeLyricsHtml(legacyMatch);
  }

  return null;
};

const extractLyricsContainers = (html: string): string[] => {
  const containers: string[] = [];
  const lowerHtml = html.toLowerCase();
  let searchIndex = 0;

  while (searchIndex < html.length) {
    const markerMatch = findNearestLyricsContainerMarker(lowerHtml, searchIndex);
    if (!markerMatch) {
      break;
    }

    const openTagStartIndex = lowerHtml.lastIndexOf("<div", markerMatch.index);
    if (openTagStartIndex === -1) {
      searchIndex = markerMatch.index + markerMatch.marker.length;
      continue;
    }

    const openTagEndIndex = html.indexOf(">", markerMatch.index);
    if (openTagEndIndex === -1) {
      break;
    }

    const contentStartIndex = openTagEndIndex + 1;
    const content = extractDivInnerHtml(html, contentStartIndex);
    if (content !== null) {
      containers.push(content);
    }

    searchIndex = contentStartIndex;
  }

  return containers;
};

const findNearestLyricsContainerMarker = (
  lowerHtml: string,
  startIndex: number
):
  | {
      index: number;
      marker: (typeof LYRICS_CONTAINER_MARKERS)[number];
    }
  | undefined => {
  let nearestIndex = Number.POSITIVE_INFINITY;
  let nearestMarker: (typeof LYRICS_CONTAINER_MARKERS)[number] | undefined;

  for (const marker of LYRICS_CONTAINER_MARKERS) {
    const markerIndex = lowerHtml.indexOf(marker, startIndex);
    if (markerIndex !== -1 && markerIndex < nearestIndex) {
      nearestIndex = markerIndex;
      nearestMarker = marker;
    }
  }

  if (nearestMarker === undefined) {
    return undefined;
  }

  return {
    index: nearestIndex,
    marker: nearestMarker,
  };
};

const extractDivInnerHtml = (html: string, contentStartIndex: number): string | null => {
  const lowerHtml = html.toLowerCase();
  let cursor = contentStartIndex;
  let depth = 1;

  while (cursor < html.length) {
    const nextOpenTagIndex = lowerHtml.indexOf("<div", cursor);
    const nextCloseTagIndex = lowerHtml.indexOf("</div", cursor);

    if (nextCloseTagIndex === -1) {
      return null;
    }

    const hasOpenBeforeClose = nextOpenTagIndex !== -1 && nextOpenTagIndex < nextCloseTagIndex;

    if (hasOpenBeforeClose) {
      const openTagEndIndex = html.indexOf(">", nextOpenTagIndex);
      if (openTagEndIndex === -1) {
        return null;
      }

      const openTag = html.slice(nextOpenTagIndex, openTagEndIndex + 1);
      if (!SELF_CLOSING_TAG_REGEX.test(openTag)) {
        depth++;
      }

      cursor = openTagEndIndex + 1;
      continue;
    }

    const closeTagEndIndex = html.indexOf(">", nextCloseTagIndex);
    if (closeTagEndIndex === -1) {
      return null;
    }

    depth--;

    if (depth === 0) {
      return html.slice(contentStartIndex, nextCloseTagIndex);
    }

    cursor = closeTagEndIndex + 1;
  }

  return null;
};

const normalizeLyricsHtml = (html: string): string | null => {
  const text = decodeHtmlEntities(
    html
      .replace(BR_TAG_REGEX, "\n")
      .replace(BLOCK_CLOSE_TAG_REGEX, "\n")
      .replace(HTML_TAG_REGEX, "")
  )
    .replace(WHITESPACE_BEFORE_NEWLINE_REGEX, "\n")
    .replace(EXCESS_NEWLINES_REGEX, "\n\n")
    .trim();

  const cleanedText = stripPageChrome(text);
  return cleanedText.length > 0 ? cleanedText : null;
};

const stripPageChrome = (text: string): string => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let startIndex = 0;
  while (startIndex < lines.length) {
    const line = lines[startIndex] ?? "";
    if (SECTION_HEADER_REGEX.test(line)) {
      break;
    }

    if (LEADING_CONTRIBUTOR_LINE_REGEX.test(line) || LEADING_TRANSLATIONS_LINE_REGEX.test(line)) {
      startIndex++;
      continue;
    }

    break;
  }

  let endIndex = lines.length;
  while (endIndex > startIndex) {
    const line = lines[endIndex - 1] ?? "";
    if (TRAILING_EMBED_LINE_REGEX.test(line)) {
      endIndex--;
      continue;
    }

    break;
  }

  return lines.slice(startIndex, endIndex).join("\n").trim();
};

const decodeHtmlEntities = (value: string): string =>
  value.replace(HTML_ENTITY_REGEX, (match, entity: string) => {
    const lower = entity.toLowerCase();

    if (lower.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    }

    if (lower.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    }

    switch (lower) {
      case "amp":
        return "&";
      case "apos":
        return "'";
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "nbsp":
        return " ";
      case "quot":
        return '"';
      default:
        return match;
    }
  });

const unavailable = (reason: LyricsUnavailableReason): LyricsResult => ({
  status: "unavailable",
  reason,
});
