import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Track } from "../../../src/domain/track/Track";
import { LyricsOvhClient } from "../../../src/integrations/lyrics/providers/LyricsOvhClient";
import type { RawTrack } from "../../../src/types";

const MOCK_TRACK: RawTrack = {
  encoded: "encoded",
  info: {
    identifier: "id",
    isSeekable: true,
    author: "AC/DC",
    length: 1000,
    isStream: false,
    position: 0,
    title: "Back In Black",
    uri: "https://example.com",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const DUPLICATED_ARTIST_TRACK: RawTrack = {
  encoded: "encoded-2",
  info: {
    identifier: "id-2",
    isSeekable: true,
    author: "Alan Walker",
    length: 1000,
    isStream: false,
    position: 0,
    title: "Alan Walker - Faded",
    uri: "https://example.com/faded",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const originalFetch = globalThis.fetch;

describe("LyricsOvhClient", () => {
  const track = new Track(MOCK_TRACK);

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should parse successful lyrics.ovh responses", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyrics: "Back in black\nI hit the sack" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as unknown as typeof fetch;

    const client = new LyricsOvhClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "found",
      lyrics: {
        title: "Back In Black",
        artist: "AC/DC",
        url: "https://api.lyrics.ovh/v1/AC%2FDC/Back%20In%20Black",
        lyricsText: "Back in black\nI hit the sack",
        albumArtUrl: null,
      },
    });
  });

  it("should return not_found on 404 responses", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 404 }))
    ) as unknown as typeof fetch;

    const client = new LyricsOvhClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("should return unavailable for malformed payloads", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyric: 123 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as unknown as typeof fetch;

    const client = new LyricsOvhClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
    });
  });

  it("should return unavailable for empty lyrics text", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyrics: "   " }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as unknown as typeof fetch;

    const client = new LyricsOvhClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
    });
  });

  it("should return unavailable for server failures", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 503 }))
    ) as unknown as typeof fetch;

    const client = new LyricsOvhClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
    });
  });

  it("should encode artist and title safely in the request URL", async () => {
    const urls: string[] = [];
    globalThis.fetch = mock((input: string | URL) => {
      urls.push(String(input));
      return Promise.resolve(new Response(null, { status: 404 }));
    }) as unknown as typeof fetch;

    const client = new LyricsOvhClient();
    await client.getLyricsForTrack(track);

    expect(urls[0]).toBe("https://api.lyrics.ovh/v1/AC%2FDC/Back%20In%20Black");
  });

  it("should strip duplicated artist prefixes from the lookup title", async () => {
    const urls: string[] = [];
    globalThis.fetch = mock((input: string | URL) => {
      urls.push(String(input));
      return Promise.resolve(new Response(null, { status: 404 }));
    }) as unknown as typeof fetch;

    const client = new LyricsOvhClient();
    await client.getLyricsForTrack(new Track(DUPLICATED_ARTIST_TRACK));

    expect(urls[0]).toBe("https://api.lyrics.ovh/v1/Alan%20Walker/Faded");
  });
});
