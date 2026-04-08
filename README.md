# Lunacord.js

Lunacord is a manager-first Lavalink client for Bun and TypeScript. Create one `Lunacord` instance, let it manage your nodes and players, and use high-level helpers for search, queueing, filters, and lyrics.

## Genius Lyrics

Lyrics are fetched through the Genius API and Genius song pages, not through a Lavalink plugin.

Configure Genius in your `Lunacord` instance:

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
    genius: {
      clientId: process.env.GENIUS_CLIENT_ID!,
      clientSecret: process.env.GENIUS_CLIENT_SECRET!,
      accessToken: process.env.GENIUS_ACCESS_TOKEN!,
    },
  },
});
```

Notes:

- `clientId`, `clientSecret`, and `accessToken` are accepted by the library.
- The access token is required for requests in this version.
- OAuth token exchange is not implemented in the library yet.
- If Genius is not configured, lyrics APIs return a graceful `unavailable` result instead of crashing.

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
