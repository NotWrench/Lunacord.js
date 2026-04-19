# Lunacord.js

Yeah I pretty much vibed it with Opus 4.7 and decided to release it as is ;-;
Let me know how much cooked this is :>

## Packages

| Package | Description |
|---------|-------------|
| [`@lunacord/core`](packages/core) | The Lavalink manager: nodes, players, queue, filters, cache, persistence, plugin runtime, errors, Zod schemas. |
| [`@lunacord/discordjs`](packages/discordjs) | `MusicKit`: batteries-included discord.js adapter with auto-wiring and an 18-command slash pack. |
| [`@lunacord/plugins`](packages/plugins) | `PluginBuilder`, `PluginManager`, and builtins (logger, metrics, debug, autoplay, stats reporter). |
| [`@lunacord/lyrics`](packages/lyrics) | Composable `LyricsClient` with Lyrics.ovh + Genius providers and a Genius OAuth helper. |
| [`@lunacord/cache-redis`](packages/cache-redis) | `RedisCacheStore` + `RedisPersistenceAdapter` for post-restart rehydrate. |
| [`@lunacord/test-utils`](packages/test-utils) *(private)* | Mock Lavalink server + stub WebSocket factory. |
| [`lunacord.js`](packages/lunacord-meta) | Umbrella npm package: re-exports `@lunacord/*`, subpaths (`/plugins`, `/lyrics`, `/cache`), and `createLunacordMusicClient()` preset. |

## Apps

| App | Description |
|-----|-------------|
| [`apps/docs`](apps/docs) | Documentation site — Next.js + Fumadocs, live at [lunacord-js-docs.vercel.app](https://lunacord-js-docs.vercel.app/). |
| [`apps/example-bot-musickit`](apps/example-bot-musickit) | Runnable discord.js music bot using MusicKit. |
| [`apps/example-bot-core`](apps/example-bot-core) | Runnable discord.js music bot using only core + manual Discord wiring. |

## Quickstart — music bot in ~15 lines

```ts
import { Client, GatewayIntentBits } from "discord.js";
import { MusicKit } from "@lunacord/discordjs";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const music = MusicKit.create(client, {
  nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
  onReady: () => music.commands.installDefaults(),
});

await client.login(process.env.DISCORD_TOKEN);
```

Guides and API reference: **[lunacord-js-docs.vercel.app](https://lunacord-js-docs.vercel.app/)** (source in [`apps/docs`](apps/docs)). Demos: [`apps/example-bot-musickit`](apps/example-bot-musickit) (MusicKit), [`apps/example-bot-core`](apps/example-bot-core) (core-only).

## Development

```bash
bun install
bunx turbo build              # build every library
bunx turbo run test           # run every test suite
bunx turbo run typecheck      # tsc --noEmit across the monorepo
bun --filter @lunacord/docs dev
bun --filter @lunacord/example-bot-musickit dev
bun --filter @lunacord/example-bot-core dev
```

### Docs site (Vercel)

**[lunacord-js-docs.vercel.app](https://lunacord-js-docs.vercel.app/)**. 

## License

MIT — see [`LICENSE`](LICENSE).
