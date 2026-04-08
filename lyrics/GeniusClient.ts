import { z } from "zod";
import type { Track } from "../structures/Track";
import type {
  GeniusOptions,
  Lyrics,
  LyricsRequestOptions,
  LyricsResult,
  LyricsUnavailableReason,
} from "../types";

const GENIUS_API_BASE_URL = "https://api.genius.com";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MINIMUM_MATCH_SCORE = 0.35;
const LYRICS_CONTAINER_REGEX = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
const LEGACY_LYRICS_REGEX = /<div[^>]*class="lyrics"[^>]*>([\s\S]*?)<\/div>/i;
const BR_TAG_REGEX = /<br\s*\/?>/gi;
const BLOCK_CLOSE_TAG_REGEX = /<\/(p|div|h2|h3|li|section)>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const WHITESPACE_BEFORE_NEWLINE_REGEX = /[ \t]+\n/g;
const EXCESS_NEWLINES_REGEX = /\n{3,}/g;
const LEADING_CONTRIBUTOR_LINE_REGEX = /^\d+\s+contributors?(translations.*)?$/i;
const LEADING_TRANSLATIONS_LINE_REGEX =
  /^(translations?|contributors?|english|espa[ñn]ol|portugu[eê]s|fran[cç]ais|deutsch|italiano|dansk|cymraeg|русский|українська|ελληνικά)\b/i;
const SECTION_HEADER_REGEX = /^\[[^\]]+]$/;
const TRAILING_EMBED_LINE_REGEX = /^\d*\s*embed$/i;
const BRACKETED_CONTENT_REGEX = /\[[^\]]*]|\([^)]*\)|\{[^}]*}/g;
const TITLE_NOISE_REGEX =
  /\b(official( music)? video|official audio|lyrics?|audio|video|hd|4k|visualizer)\b/gi;
const SEPARATOR_REGEX = /[-–—:|]/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/g;
const MULTISPACE_REGEX = /\s+/g;
const HTML_ENTITY_REGEX = /&(#x?[0-9a-f]+|[a-z]+);/gi;

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

  constructor(options?: GeniusOptions) {
    this.options = options;
  }

  isConfigured(): boolean {
    return Boolean(this.options?.accessToken && this.options.clientId && this.options.clientSecret);
  }

  async getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
    if (!this.isConfigured()) {
      return unavailable("missing_credentials");
    }

    const queries = this.buildQueries(track, options);

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

  private buildQueries(track: Track, options?: LyricsRequestOptions): string[] {
    if (options?.query) {
      return [options.query.trim()].filter((query) => query.length > 0);
    }

    const primaryQuery =
      `${sanitizeQueryPart(track.title)} ${sanitizeQueryPart(track.author)}`.trim();
    const fallbackQuery = sanitizeQueryPart(track.title);
    return [...new Set([primaryQuery, fallbackQuery].filter((query) => query.length > 0))];
  }

  private async search(query: string): Promise<GeniusSearchOutcome> {
    const response = await this.fetchWithTimeout(
      `${GENIUS_API_BASE_URL}/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${this.options!.accessToken}`,
        },
      }
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
    const response = await this.fetchWithTimeout(url, {});

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

  private async fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.options?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);

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
  const matches = [...html.matchAll(LYRICS_CONTAINER_REGEX)].map((match) => match[1] ?? "");
  if (matches.length > 0) {
    return normalizeLyricsHtml(matches.join("\n"));
  }

  const legacyMatch = html.match(LEGACY_LYRICS_REGEX)?.[1];
  if (legacyMatch) {
    return normalizeLyricsHtml(legacyMatch);
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
      case "#39":
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

const sanitizeQueryPart = (value: string): string =>
  value.replace(BRACKETED_CONTENT_REGEX, " ").replace(TITLE_NOISE_REGEX, " ").trim();

const normalizeForComparison = (value: string): string =>
  sanitizeQueryPart(value)
    .replace(SEPARATOR_REGEX, " ")
    .replace(NON_ALPHANUMERIC_REGEX, " ")
    .replace(MULTISPACE_REGEX, " ")
    .trim()
    .toLowerCase();

const scoreSimilarity = (left: string, right: string): number => {
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

const unavailable = (reason: LyricsUnavailableReason): LyricsResult => ({
  status: "unavailable",
  reason,
});
