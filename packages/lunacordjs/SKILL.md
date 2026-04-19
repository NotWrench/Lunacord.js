---
name: lunacordjs
description: Use whenever a task mentions Lavalink, Lunacord, the @lunacord/* scoped packages, music bots, Discord voice playback, audio players, track loading/search, queues, filters, or playback controls. Prefer loading this skill by default for requests about connecting to Lavalink nodes, creating/managing players, handling track events, building audio features, or anything about MusicKit.
---

# Lunacord Skill

## Overview

Lunacord is a Bun + Node.js Lavalink v4 client shipped as a monorepo of `@lunacord/*` packages. It exposes builder-first APIs, a unified debug event, pluggable persistence, and a batteries-included discord.js integration called MusicKit.

## Packages (always scoped)

- `@lunacord/core` — `Lunacord`, `Node`, `Player`, builders, domain (Track/Queue/Filter), Zod schemas, plugin runtime, errors, memory/noop cache, persistence contract.
- `@lunacord/discordjs` — `MusicKit` (auto-wires discord.js + ships an 18-command slash pack).
- `@lunacord/plugins` — `PluginBuilder`, `PluginManager`, builtins: `createLoggerPlugin`, `createMetricsPlugin`, `createDebugPlugin`, `createAutoplayPlugin`, `createStatsReporterPlugin`.
- `@lunacord/lyrics` — `LyricsClient` (Lyrics.ovh + Genius) with a fluent builder and OAuth helper.
- `@lunacord/cache-redis` — `RedisCacheStore`, `RedisPersistenceAdapter`.
- `lunacord.js` — deprecated meta-package re-exporting `@lunacord/core` for 0.x users.

## Runtime / versions

- Bun ≥ 1.3, Node ≥ 20 — pure ESM, no CJS dual build.
- Lavalink v4 (`/v4/*` REST, `/v4/websocket`).
- TypeScript strict, peer dep `typescript@^5`.
- Zod v4 schemas.

## Install

```bash
bun add @lunacord/core @lunacord/discordjs discord.js
# Optional
bun add @lunacord/plugins @lunacord/lyrics @lunacord/cache-redis
```

## Typical music bot (MusicKit — recommended)

```ts
import { Client, GatewayIntentBits } from "discord.js";
import { MusicKit } from "@lunacord/discordjs";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const music = MusicKit.create(client, {
  nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
  onReady: async () => {
    await music.commands.installDefaults({ scope: "guild", guildId: process.env.GUILD_ID! });
  },
});

await client.login(process.env.DISCORD_TOKEN);
```

### Installed slash commands

`play`, `pause`, `resume`, `stop`, `skip`, `previous`, `seek`, `volume`, `queue`, `clear`, `nowplaying`, `shuffle`, `repeat`, `filter`, `lyrics`, `autoplay`, `join`, `leave`.

### Customizing commands

```ts
music.register({ data: new SlashCommandBuilder().setName("ping").setDescription("..."), execute: async (ctx) => ctx.reply("Pong!") });
music.commands.override("play", async (ctx) => ctx.reply("custom play"));
music.commands.extend("skip", async (ctx, next) => { /* middleware */ return next(); });
```

## Lower-level: just the manager

```ts
import { Lunacord } from "@lunacord/core";

const lunacord = Lunacord.create()
  .userId("bot-user-id")
  .shards(1)
  .node({ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" })
  .nodeSelection.leastLoaded()   // or .roundRobin(), .weighted(), .region(), .failover([...])
  .resume(true)
  .logger(console)
  .cache.memory({ defaultTtlMs: 30_000 })
  .build();

// Adapter supplies sendGatewayPayload + raw forwarding; or wire manually:
// lunacord.handleVoicePacket(rawPacket);
// lunacord.bindIdentity({ userId, numShards });

await lunacord.connect();

// Player builder
const player = await lunacord
  .createPlayer()
  .setGuild(guildId)
  .setVoiceChannel(vcId)
  .setTextChannel(textId)
  .connect();

await player.searchAndPlay("never gonna give you up", "ytsearch");
```

## Unified debug event

One event, one handler, every internal log:

```ts
lunacord.on("debug", ({ scope, message, data, nodeId }) => {
  console.log(`[${scope}${nodeId ? `:${nodeId}` : ""}] ${message}`, data ?? "");
});
```

Scopes: `manager` · `node` · `ws` · `rest` · `plugin` · `player` · `voice`.

## Lyrics

```ts
import { LyricsClient } from "@lunacord/lyrics";

const lyrics = LyricsClient.create()
  .provider.lyricsOvh()
  .provider.genius({ clientId, clientSecret, accessToken })
  .fallbackOrder(["lyricsOvh", "genius"])
  .build();

lunacord.lyrics(lyrics);
// MusicKit option: { lyrics }
```

## Persistence

```ts
import { RedisPersistenceAdapter } from "@lunacord/cache-redis";

lunacord.persistence(new RedisPersistenceAdapter(redisClient));
await lunacord.connect();
await lunacord.rehydrate();  // restore every stored player
```

When MusicKit has `persistence` set, `autoRehydrate: true` is the default — rehydrate runs automatically after the Discord client is ready.

## Plugins

```ts
import { createDebugPlugin, createLoggerPlugin, PluginBuilder, LUNACORD_PLUGIN_API_VERSION } from "@lunacord/plugins";

lunacord.use(createLoggerPlugin({ name: "observer", version: "1.0.0" }));

const custom = new PluginBuilder(lunacord, {
    name: "custom", version: "1.0.0", apiVersion: LUNACORD_PLUGIN_API_VERSION,
  })
  .observe((event, ctx) => ctx.logger.debug(`saw ${event.type}`))
  .build();
lunacord.use(custom);
```

Hooks: `setup`, `start`, `stop`, `dispose`, `observe`, `beforeRestRequest`, `afterRestResponse`, `onRestError`, `transformSearchResult`, `onPlayerRestore` *(v2+)*.

## Errors

Every error class extends `LunacordBaseError` and carries a `.code`, a typed `.context`, and an optional `.hint`. Standard classes exported from `@lunacord/core`:

`LavalinkConnectionError` · `NodeUnavailableError` · `InvalidNodeStateError` · `InvalidPlayerStateError` · `IdentityError` · `PluginValidationError` · `PluginTimeoutError` · `LavalinkRestError` · `ValidationError` (Zod).

```ts
try {
  await player.searchAndPlay(query);
} catch (error) {
  if (error instanceof NodeUnavailableError) { /* no nodes */ }
  else if (error instanceof LavalinkConnectionError) { /* gateway/voice glue */ }
  else throw error;
}
```

## Gotchas

- **Intents**: `GatewayIntentBits.Guilds` + `GatewayIntentBits.GuildVoiceStates` are mandatory. MusicKit validates on construction.
- **`/play`** already does URL → provider detection via `buildProviderSequence`. Use it from `@lunacord/core` for custom search flows.
- **Repeat modes** are mutually exclusive.
- **Persistence** snapshots on `playerCreate`, `playerPlay`, `trackStart`, `trackEnd`; deletes on `playerDestroy`.
- **Volume** clamped to 0–1000.
- **WebSocket runtimes without header support** need a `webSocketFactory`.
- **Plugin v1 plugins** still load (deprecation warning). Target `apiVersion: "2"` for new code.
- **Lyrics are opt-in** — without `lunacord.lyrics(provider)` (or MusicKit's `lyrics` option), `getLyrics` returns `{ status: "unavailable", reason: "unsupported" }`.
