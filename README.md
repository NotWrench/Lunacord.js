# Lunacord.js

Lunacord is a manager-first Lavalink client for Bun and TypeScript. Create one `Lunacord` instance, let it manage your nodes and players, and use high-level helpers for search, queueing, filters, and lyrics.

## Public entrypoints

Use the root package for the stable high-level API:

```ts
import { Lunacord, SearchProvider } from "lunacord";
```

Use focused subpaths for advanced surfaces:

- `lunacord/cache`
- `lunacord/plugins`
- `lunacord/lyrics`
- `lunacord/errors`

## Filters

Lunacord supports full Lavalink-compatible filter payloads.

### Apply raw Lavalink filter payloads

```ts
await player.setFilters({
  timescale: { speed: 1.1, pitch: 1.05 },
  equalizer: [{ band: 0, gain: 0.15 }],
});

await player.updateFilters({
  karaoke: { level: 1 },
});
```

### Use typed helper methods

```ts
await player.setFilterVolume(0.85);
await player.setEqualizerBand(2, 0.2);
await player.updateTimescaleFilter({ speed: 1.08 });
await player.updateDistortionFilter({ sinScale: 0.5 });
await player.setPluginFilter("my-plugin", { enabled: true });
```

### Compose and apply once with builder

```ts
await player
  .createFilterBuilder()
  .setNightcore()
  .setEqualizerBand(0, 0.2)
  .updateChannelMix({ leftToLeft: 0.8 })
  .setPluginFilter("fx", { enabled: true })
  .apply();
```

Notes:

- Basic client-side guards reject obviously invalid values (for example non-finite numbers, negative volumes, invalid equalizer band indexes).
- `updateFilters` performs partial object merges; equalizer updates merge by band.
- `clearFilters` removes every active filter. Individual clear helpers are also available.

## Lyrics

Lyrics are fetched from `lyrics.ovh` by default. Genius is an optional fallback provider that improves coverage when `lyrics.ovh` misses or is temporarily unavailable.

Configure optional Genius fallback in your `Lunacord` instance:

```ts
import { Lunacord } from "lunacord";

const lunacord = new Lunacord({
  userId: "your-bot-user-id",
  numShards: 1,
  nodes: [
    {
      host: "localhost",
      port: 2333,
      password: "youshallnotpass",
    },
  ],
  lyrics: {
    genius: process.env.GENIUS_ACCESS_TOKEN
      ? {
          clientId: process.env.GENIUS_CLIENT_ID!,
          clientSecret: process.env.GENIUS_CLIENT_SECRET!,
          accessToken: process.env.GENIUS_ACCESS_TOKEN!,
        }
      : undefined,
  },
});
```

Notes:

- `lyrics.ovh` requires no configuration and is always attempted first.
- `clientId`, `clientSecret`, and `accessToken` are accepted for optional Genius fallback.
- The access token is required for Genius requests in this version.
- OAuth token exchange is not implemented in the library yet.
- If Genius is not configured, lyrics APIs still work through `lyrics.ovh` and degrade gracefully.
- Lyrics responses are cached in-memory globally per `Lunacord` instance and shared across guilds.
- Cached entries are retained while at least one guild is actively playing that song, then evicted after the last active playback ends.

### Player API

```ts
const result = await player.getLyrics();

if (result.status === "found") {
  console.log(result.lyrics.title);
  console.log(result.lyrics.artist);
  console.log(result.lyrics.lyricsText);
}
```

Possible result statuses:

- `found`
- `not_found`
- `no_track`
- `unavailable`
