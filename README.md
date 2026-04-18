# Lunacord — Lavalink v4, builder-first.

Monorepo for the `@lunacord/*` family of packages — a modern, type-safe, batteries-included Lavalink v4 client for Bun and Node.js.

## Packages

| Package | Description |
|---------|-------------|
| [`@lunacord/core`](packages/core) | The Lavalink manager: nodes, players, queue, filters, cache, persistence, plugin runtime, errors, Zod schemas. |
| [`@lunacord/discordjs`](packages/discordjs) | `MusicKit`: batteries-included discord.js adapter with auto-wiring and an 18-command slash pack. |
| [`@lunacord/plugins`](packages/plugins) | `PluginBuilder`, `PluginManager`, and builtins (logger, metrics, debug, autoplay, stats reporter). |
| [`@lunacord/lyrics`](packages/lyrics) | Composable `LyricsClient` with Lyrics.ovh + Genius providers and a Genius OAuth helper. |
| [`@lunacord/cache-redis`](packages/cache-redis) | `RedisCacheStore` + `RedisPersistenceAdapter` for post-restart rehydrate. |
| [`@lunacord/test-utils`](packages/test-utils) *(private)* | Mock Lavalink server + stub WebSocket factory. |
| `lunacord.js` *(deprecated)* | Meta-package that re-exports `@lunacord/core` for 0.x users. |

## Apps

| App | Description |
|-----|-------------|
| [`apps/docs`](apps/docs) | Documentation site — Next.js 15 + Fumadocs. |
| [`apps/example-bot`](apps/example-bot) | Runnable discord.js music bot using MusicKit. |

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

See [`apps/docs`](apps/docs) for the full guide or [`apps/example-bot`](apps/example-bot) for a runnable version with Redis + lyrics + plugin wiring.

## Development

```bash
bun install
bunx turbo build              # build every library
bunx turbo run test           # run every test suite
bunx turbo run typecheck      # tsc --noEmit across the monorepo
bun --filter @lunacord/docs dev
bun --filter @lunacord/example-bot dev
```

### Tooling

- **Bun workspaces** + **Turborepo** for orchestration.
- **Biome via [Ultracite](https://ultracite.dev)** for lint + format.
- **Changesets** for multi-package versioning.
- **lefthook** pre-commit + commit-msg (conventional commits via `commitlint`).

## Migration from 0.x

See [MIGRATION.md](MIGRATION.md) for a short version, or the full [migration doc](apps/docs/content/docs/migration.mdx).

## License

MIT — see [`LICENSE`](LICENSE).
