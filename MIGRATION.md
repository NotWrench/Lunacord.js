# Migration guide — Lunacord 0.x → 1.0

Lunacord 1.0 restructures the project into a monorepo of scoped `@lunacord/*` packages. The full walkthrough lives in [`apps/docs/content/docs/migration.mdx`](apps/docs/content/docs/migration.mdx); this file is the short version.

## Install

```bash
# Old
bun add lunacord.js

# New — pick the bits you need
bun add @lunacord/core @lunacord/discordjs discord.js
bun add @lunacord/plugins @lunacord/lyrics @lunacord/cache-redis   # optional
```

`lunacord.js` on npm is an **umbrella** package: it re-exports the scoped libraries, keeps subpaths (`lunacord.js/plugins`, `/lyrics`, `/cache`), and adds **`createLunacordMusicClient()`** (discord.js `Client` + `MusicKit`). You can stay on `lunacord.js` or switch to `@lunacord/*` for smaller installs.

## Imports

| Before | After (scoped) | `lunacord.js` still works |
|--------|------------------|---------------------------|
| `from "lunacord.js"` | `from "@lunacord/core"` | root re-exports core + more |
| `from "lunacord.js/plugins"` | `from "@lunacord/plugins"` | `./plugins` |
| `from "lunacord.js/lyrics"` | `from "@lunacord/lyrics"` | `./lyrics` |
| `from "lunacord.js/cache"` (`RedisCacheStore`) | `from "@lunacord/cache-redis"` | `./cache` |
| `from "lunacord.js/errors"` | `from "@lunacord/core"` (errors re-exported from root) | root |

## Behavior changes

- **`userId` / `numShards` are now optional** at construction. Adapters bind them after the Discord client is ready.
- **Unified `debug` event** — `{ scope, message, data?, nodeId? }`. The old per-node-scoped `debug` shape is replaced; node debug events are folded into this stream.
- **Plugin API v2** — `apiVersion: "1"` plugins still load with a deprecation warning. New hook: `onPlayerRestore`.
- **`lyrics` option is now a provider** (not `LyricsOptions`). Build one with `@lunacord/lyrics` and pass it to `.lyrics(...)`.
- **`RedisCacheStore` and new `RedisPersistenceAdapter`** live in `@lunacord/cache-redis`.
- **Batteries-included MusicKit** — if you're building a bot, prefer `@lunacord/discordjs` over manual wiring.

## New in 1.0

- `Lunacord.create()` — builder-first entrypoint.
- Persistence adapter interface + automatic rehydrate after bot restarts.
- Smart search URL → provider detection exported from root.
- `@lunacord/plugins` adds `createDebugPlugin`, `createAutoplayPlugin`, `createStatsReporterPlugin`.
- `@lunacord/discordjs` ships 18 default slash commands plus middleware, embed factory, and localization hooks.
