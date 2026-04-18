export const SearchProvider = {
  YouTube: "ytsearch",
  YouTubeMusic: "ytmsearch",
  SoundCloud: "scsearch",
  Spotify: "spsearch",
  Deezer: "dzsearch",
  AppleMusic: "amsearch",
} as const;

export type SearchProvider = (typeof SearchProvider)[keyof typeof SearchProvider];
export type SearchProviderInput = SearchProvider | string;

export const DEFAULT_SEARCH_PROVIDER: SearchProvider = SearchProvider.YouTube;

const URL_WRAPPER_REGEX = /^<(.+)>$/;

const parseHttpUrl = (value: string): URL | null => {
  const normalizedValue = value.replace(URL_WRAPPER_REGEX, "$1").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

export const buildSearchIdentifier = (
  query: string,
  provider: SearchProviderInput = DEFAULT_SEARCH_PROVIDER
): string => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Search query must not be empty");
  }

  const queryUrl = parseHttpUrl(trimmedQuery);
  if (queryUrl) {
    return queryUrl.toString();
  }

  const providerInput = provider?.trim() || DEFAULT_SEARCH_PROVIDER;
  const providerUrl = parseHttpUrl(providerInput);
  if (providerUrl) {
    return providerUrl.toString();
  }

  return `${providerInput}:${trimmedQuery}`;
};

/**
 * Detect the best SearchProvider from a URL's hostname. Returns `null` if the URL
 * is not a known provider (caller should fall back to the default or accept the URL as-is).
 */
export const detectProviderFromUrl = (url: URL): SearchProviderInput | null => {
  const hostname = url.hostname.toLowerCase();

  if (hostname === "music.youtube.com") {
    return SearchProvider.YouTubeMusic;
  }
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") {
    return SearchProvider.YouTube;
  }
  if (hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com")) {
    return SearchProvider.SoundCloud;
  }
  if (hostname === "bandcamp.com" || hostname.endsWith(".bandcamp.com")) {
    return "bcsearch";
  }
  if (
    hostname === "spotify.com" ||
    hostname.endsWith(".spotify.com") ||
    hostname === "open.spotify.com"
  ) {
    return SearchProvider.Spotify;
  }
  if (hostname === "deezer.com" || hostname.endsWith(".deezer.com")) {
    return SearchProvider.Deezer;
  }
  if (hostname === "music.apple.com") {
    return SearchProvider.AppleMusic;
  }

  return null;
};

/**
 * Try to parse a string as an HTTP/HTTPS URL, tolerating Discord's `<url>` wrappers.
 */
export const tryParseHttpUrl = parseHttpUrl;

/**
 * Build a default provider fallback chain for a raw query. Useful when a search should
 * transparently try multiple providers before giving up.
 */
export const DEFAULT_FALLBACK_PROVIDERS: readonly SearchProviderInput[] = [
  SearchProvider.YouTube,
  "bcsearch",
  SearchProvider.SoundCloud,
];

/**
 * Build an ordered list of providers to try for `query`. URLs resolve to a single detected
 * provider; plain strings get the default fallback chain.
 */
export const buildProviderSequence = (
  query: string,
  fallback: readonly SearchProviderInput[] = DEFAULT_FALLBACK_PROVIDERS
): readonly SearchProviderInput[] => {
  const parsed = parseHttpUrl(query);
  if (!parsed) {
    return fallback;
  }
  const detected = detectProviderFromUrl(parsed);
  return [detected ?? SearchProvider.YouTube];
};
