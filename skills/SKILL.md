---
name: lunacordjs
description: Use this skill whenever a task mentions Lavalink, Lunacord.js, music bots, Discord voice playback, audio players, track loading/search, queues, filters, or playback controls. Prefer loading this skill by default for any request about connecting to Lavalink nodes, creating/managing players, handling track events, or building audio features with this specific library.
---

# Lavalink Client Skill

## Overview

Lunacord.js is a manager-first Lavalink client for Bun + TypeScript.

What it provides:

- A central `Lunacord` manager for nodes, players, events, migration, and plugins.
- Fluent builders for node/player/plugin setup.
- Player-level queue, repeat modes, filters, seek, lyrics, export/import restore state.
- Lavalink REST + WebSocket transports with validation and retry handling.

Version/runtime facts from this repo:

- Package name: `lunacord.js` (version `0.1.2` in this repo).
- Lavalink target: v4 endpoints (`/v4/*`, `/v4/websocket`).
- Runtime: Bun (`packageManager: bun@1.3.12`).
- TypeScript: strict TS, peer dependency `typescript@^5`.
- Root exports are intentionally small (`Lunacord` + root option/event types). Advanced APIs use subpaths.

## Installation & Setup

Install:

```bash
bun add lunacord.js
# Optional, only if you want Redis cache store
bun add redis
```

Import paths:

```ts
import { Lunacord } from "lunacord.js";

// Optional advanced subpaths
import { CacheManager, RedisCacheStore } from "lunacord.js/cache";
import { PluginBuilder, PluginManager } from "lunacord.js/plugins";
import { LyricsClient } from "lunacord.js/lyrics";
import {
  LavalinkConnectionError,
  NodeUnavailableError,
} from "lunacord.js/errors";
```

Instantiate manager (all options):

```ts
import { Lunacord } from "lunacord.js";

const lunacord = new Lunacord({
  userId: "your-bot-user-id", // required
  numShards: 1, // required
  nodes: [
    // required (can be empty, then add later)
    {
      id: "main",
      host: "localhost",
      port: 2333,
      password: "youshallnotpass",
      secure: false,
      regions: ["local"],
      requestTimeoutMs: 10_000,
      requestRetryAttempts: 1,
      requestRetryDelayMs: 250,
      initialReconnectDelayMs: 1000,
      maxReconnectAttempts: 5,
      maxReconnectDelayMs: 30_000,
    },
  ],

  // Optional
  autoConnect: false,
  autoMigrateOnDisconnect: true, // or { preferredNodeIds: ["main"] }
  clientName: "MyMusicBot",
  resume: true,
  timeout: 60_000,
  nodeSelection: { type: "leastLoaded" }, // roundRobin | weighted | region | failover

  // Required for voice connect flows from Lunacord/Player
  sendGatewayPayload: async (guildId, payload) => {
    // Forward op:4 VOICE_STATE_UPDATE to your gateway shard here
    // e.g. discord.js -> guild.shard.send(payload)
  },

  // Optional lyrics fallback
  lyrics: {
    genius: {
      clientId: process.env.GENIUS_CLIENT_ID!,
      clientSecret: process.env.GENIUS_CLIENT_SECRET!,
      accessToken: process.env.GENIUS_ACCESS_TOKEN!,
      requestTimeoutMs: 10_000,
    },
    requestTimeoutMs: 10_000,
  },

  // Optional cache + logger + custom websocket
  cache: {
    enabled: true,
    prefix: "lunacord",
    defaultTtlMs: 30_000,
  },
  logger: {
    debug: (m, d) => console.debug(m, d),
    warn: (m, d) => console.warn(m, d),
    error: (m, d) => console.error(m, d),
  },
  // webSocketFactory: ({ url, headers }) => customWS,
});
```

## Core Concepts

- Manager (`Lunacord`): owns all nodes and players, emits global events, dispatches plugin hooks.
- Node: one Lavalink connection. Each player belongs to one node.
- Player: guild-scoped playback state + queue + filters + lyrics access.
- Queue model:
  - `player.current` = currently playing track.
  - `player.queue` = upcoming tracks.
  - `player.history` = previously played/skipped tracks (default max 20).
- Voice model:
  - You must forward Discord `VOICE_STATE_UPDATE` + `VOICE_SERVER_UPDATE` packets via `lunacord.handleVoicePacket(packet)`.
  - Node syncs voice payload to Lavalink only after both packets are known.
- Track loading model:
  - `player.search(query, provider?)` returns transformed search result (`track|search|playlist|empty|error`).
  - `player.searchAndPlay(...)` queues result and starts if idle.

## Common Workflows (with full working code snippets)

1. Connecting to a Lavalink node

```ts
import { Lunacord } from "lunacord.js";

const lunacord = new Lunacord({
  userId: "123456789012345678",
  numShards: 1,
  nodes: [],
  sendGatewayPayload: async (guildId, payload) => {
    // Forward to Discord gateway shard
  },
});

await lunacord
  .createNode()
  .setId("local")
  .setHost("localhost")
  .setPort(2333)
  .setPassword("youshallnotpass")
  .register();

await lunacord.connect();
```

2. Searching/loading a track

```ts
const player = lunacord.createPlayer("guild-id");

// Provider is prefix string (default is ytsearch when omitted)
const result = await player.search("never gonna give you up", "ytsearch");

if (result.loadType === "error") {
  console.error("Search failed:", result.error.message);
}

if (result.loadType === "search" || result.loadType === "track") {
  console.log("Top match:", result.tracks[0]?.title);
}
```

3. Creating a player and joining a voice channel

```ts
// Recommended fluent builder
const player = await lunacord
  .createPlayer()
  .setGuild("guild-id")
  .setVoiceChannel("voice-channel-id")
  .setTextChannel("text-channel-id")
  .connect();

// Important in your gateway layer:
// client.on("raw", packet => lunacord.handleVoicePacket(packet));
```

4. Playing, pausing, stopping, skipping

```ts
const result = await player.searchAndPlay(
  "daft punk harder better faster stronger",
  "ytsearch",
);

if (result.loadType === "empty" || result.loadType === "error") {
  console.log("No playable tracks");
} else {
  await player.pause(true);
  await player.pause(false);

  await player.setVolume(250); // clamped 0..1000
  await player.seek(30_000); // ms

  player.repeatTrack(true); // mutually exclusive with repeatQueue
  player.repeatQueue(true); // enabling this disables repeatTrack

  await player.skip(); // skips without destroying player
  await player.stop(); // default: disconnect voice + destroy player
}
```

5. Handling events (`trackStart`, `trackEnd`, errors, etc.)

```ts
lunacord.on("nodeConnect", ({ node }) => {
  console.log("Node connected:", node.id);
});

lunacord.on("trackStart", ({ node, player, track }) => {
  console.log(`[${node.id}] ${player.guildId} started ${track.title}`);
});

lunacord.on("trackEnd", ({ node, player, track, reason }) => {
  console.log(
    `[${node.id}] ${player.guildId} ended ${track.title} (${reason})`,
  );
  // reason: finished | loadFailed | stopped | replaced | cleanup
});

lunacord.on("trackException", ({ exception, track }) => {
  console.error("Track exception:", track.title, exception.message);
});

lunacord.on("nodeError", (err) => {
  console.error("Node error:", err.code, err.message, err.context);
});

lunacord.on("pluginError", (event) => {
  console.error(
    "Plugin error:",
    event.plugin.name,
    event.hook,
    event.error.message,
  );
});
```

6. Destroying a player / cleanup

```ts
// Soft cleanup (disconnect voice only)
await lunacord.disconnectVoice("guild-id");

// Destroy managed player
await lunacord.destroyPlayer("guild-id");

// Shutdown manager (stop/dispose plugins + disconnect all nodes)
await lunacord.disconnect();
```

## API Reference Summary

Important note: root package only exports manager-first API; advanced modules are in subpaths.

### `Lunacord` (root)

Constructor:

- `new Lunacord(options: LunacordOptions)`

Key methods:

- `connect(): Promise<void>`
- `disconnect(): Promise<void>`
- `createNode(): NodeBuilderStart`
- `addNode(options: LunacordNodeOptions): Promise<Node>`
- `removeNode(nodeId: string): Promise<void>`
- `createPlayer(): PlayerBuilderStart`
- `createPlayer(guildId: string, options?: CreatePlayerOptions): Player`
- `connectPlayer(guildId: string, channelId: string, options?: VoiceConnectOptions, playerOptions?: CreatePlayerOptions): Promise<Player>`
- `destroyPlayer(guildId: string): Promise<void>`
- `connectVoice(guildId: string, channelId: string, options?: VoiceConnectOptions): Promise<void>`
- `disconnectVoice(guildId: string): Promise<void>`
- `movePlayer(guildId: string, targetNodeId: string): Promise<Player>`
- `getNode(id: string): Node | undefined`
- `getNodes(): Node[]`
- `getPlayer(guildId: string): Player | undefined`
- `isPlayerConnected(guildId: string): boolean`
- `getLyrics(guildId: string, options?: LyricsRequestOptions): Promise<LyricsResult>`
- `getStats(): AggregatedLunacordStats`
- `handleVoicePacket(packet: unknown): void`
- `createPlugin(name: string, version?: string): PluginBuilder`
- `createPlugin(metadata: PluginMetadata): PluginBuilder`
- `use(plugin: LunacordPlugin): this`

Primary events (listen with `lunacord.on(...)`):

- Node lifecycle: `nodeCreate`, `nodeConnect`, `nodeDisconnect`, `nodeReconnecting`, `nodeReconnectFailed`, `nodeRemove`, `nodeStats`, `nodeError`.
- Player lifecycle: `playerCreate`, `playerDestroy`, `playerConnect`, `playerDisconnect`, `playerPlay`, `playerPause`, `playerResume`, `playerStop`, `playerSkip`, `playerSeek`, `playerVolumeUpdate`.
- Queue events: `playerQueueAdd`, `playerQueueAddMany`, `playerQueueInsert`, `playerQueueMove`, `playerQueueRemove`, `playerQueueShuffle`, `playerQueueClear`, `playerQueueDedupe`, `playerQueueEmpty`.
- Repeat/filter events: `playerRepeatTrack`, `playerRepeatQueue`, `playerFiltersUpdate`, `playerFiltersClear`.
- Track events: `trackStart`, `trackEnd`, `trackException`, `trackStuck`.
- WS/voice events: `ws`, `voiceSocketClosed`, `nodeVoiceSocketClosed`.
- Plugin/event bus errors: `pluginError`, `error`, `ready`.

### `NodeBuilder` (returned by `createNode()`)

- `setHost(host: string)`
- `setPort(port: number)`
- `setPassword(password: string)`
- `setId(id: string)`
- `setSecure(secure: boolean)`
- `setRegions(regions: readonly string[])`
- `setReconnectPolicy({ initialDelayMs?, maxAttempts?, maxDelayMs? })`
- `setRequestPolicy({ retryAttempts?, retryDelayMs?, timeoutMs? })`
- `register(): Promise<Node>` (available when required fields are set)

### `PlayerBuilder` (returned by `createPlayer()`)

- `setGuild(guildId: string)`
- `setVoiceChannel(channelId: string)`
- `setTextChannel(channelId: string)`
- `preferRegion(region: string)`
- `preferNodes(nodeIds: readonly string[])`
- `withHistoryLimit(historyMaxSize: number)`
- `onQueueEmpty(handler)`
- `withSelfDeaf(selfDeaf: boolean)`
- `withSelfMute(selfMute: boolean)`
- `connect(): Promise<Player>` (available when guild+voice+text are set)

### `Player` (returned by manager methods)

Properties/getters:

- `guildId`, `current`, `queue`, `history`, `filter`, `filters`, `volume`, `paused`, `position`, `ping`, `textChannelId`
- `isConnected`, `isRepeatTrackEnabled`, `isRepeatQueueEnabled`

Core methods:

- Voice/state: `connect(channelId, options?)`, `setTextChannel(channelId|null)`, `getEstimatedPosition()`
- Playback: `play(track?, { noReplace? }?)`, `pause(paused)`, `stop(destroyPlayer=true, disconnectVoice=true)`, `skip()`, `seek(positionMs)`, `setEndTime(positionMs)`, `setVolume(volume)`
- Search/load: `search(query, provider?)`, `searchAndPlay(query, provider?)`
- Queue ops: `add`, `addMany`, `remove`, `insert`, `moveQueue`, `shuffleQueue`, `removeDuplicateTracks`, `clearQueue`, `getQueue`, `playNext`
- Repeat: `repeatTrack(enabled?)`, `repeatQueue(enabled?)`
- Filters: `setFilters`, `updateFilters`, `clearFilters`, `setBassboost`, `setNightcore`, `setVaporwave`, `setKaraoke`
- History/restore: `previous`, `rewindTrack`, `export`, `import`, `getCreationOptions`, `getRestoreState`
- Lyrics: `getLyrics(options?)`, `getLyricsFor(track, options?)`, `getLyricsForHistory(index, options?)`, `getCurrentLyricLine(lyricsResult)`

### `Node` (advanced; from manager internals)

Key methods/getters:

- `connect(): Promise<void>`
- `disconnect(): void`
- `createPlayer(guildId: string, options?: PlayerOptions): Player`
- `destroyPlayer(guildId: string): Promise<void>`
- `getPlayer(guildId: string): Player | undefined`
- `getPlayers(): Player[]`
- `connectVoice(guildId: string, channelId: string, options?: VoiceConnectOptions): Promise<void>`
- `disconnectVoice(guildId: string): Promise<void>`
- `handleVoicePacket(packet: unknown): void`
- `restorePlayer(player: Player): Promise<void>`
- `importPlayer(guildId: string, snapshot: PlayerExportData, options?: PlayerOptions): Promise<Player>`
- `setSearchResultTransformer(transformer | undefined): void`
- `transformSearchResult(context, result): Promise<SearchResult>`
- `getVoicePayload(guildId)`, `getVoiceChannelId(guildId)`, `getVoiceStateSnapshot(guildId)`, `setVoiceStateSnapshot(guildId, snapshot)`
- Getters/properties: `connected`, `playerCount`, `regions`, `lyricsClient`, `sessionId`, `latestStats`, `rest`, `socket`

### `Track`

- `static from(rawTrack)`
- `static fromValidated(rawTrack)`
- `durationFormatted`
- `toJSON()`

### Queue/domain helpers

- `Queue`: `enqueue`, `enqueueMany`, `dequeue`, `peek`, `insert`, `remove`, `move`, `shuffle`, `removeDuplicates`, `clear`, `toArray`, getters `size`, `isEmpty`.
- `QueueHistory`: `push`, `pop`, `peek`, `clear`, `toArray`, getter `size`.
- `Filter`: `set`, `update`, `clear`, `setBassboost`, `setNightcore`, `setVaporwave`, `setKaraoke`, `getPlaybackRate`, `applyLocally`, getter `value`.

### Transport classes (advanced)

- `Rest`:
  - Middleware: `use(middleware)`
  - Load/search: `loadTracks(identifier)`, `search(query, provider?)`
  - Decode: `decodeTrack(encodedTrack)`, `decodeTracks(encodedTracks)`
  - Metadata: `getInfo()`, `getVersion()`, `getRoutePlannerStatus()`
  - Players/sessions: `getPlayers(sessionId)`, `getPlayer(sessionId, guildId)`, `updatePlayer(sessionId, guildId, payload, options?)`, `destroyPlayer(sessionId, guildId)`, `updateSession(sessionId, resuming, timeout?)`
  - Route planner ops: `freeRoutePlannerAddress(address)`, `freeAllRoutePlannerAddresses()`
- `Socket`:
  - `connect()`, `disconnect()`, `send(data)`
  - Emits: `ready`, `playerUpdate`, `stats`, `event`, `close`, `reconnecting`, `reconnectFailed`, `error`

### Cache subpath (`lunacord.js/cache`)

- `Cache`: `get`, `set`, `getOrSet`, `wrap`, `delete`, `has`, `clear`, `namespace`
- `CacheManager`: `cache(name)`, `clearAll()`, `getStore()`
- `MemoryCacheStore`, `NoopCacheStore`, `RedisCacheStore`

### Plugin subpath (`lunacord.js/plugins`)

- `PluginBuilder`: chain hooks (`observe`, `beforeRestRequest`, `afterRestResponse`, `onRestError`, `transformSearchResult`, lifecycle hooks), then `build()` or `use()`.
- `PluginManager`: runtime orchestration and hook dispatch.

### Lyrics subpath (`lunacord.js/lyrics`)

- `LyricsClient`:
  - `getLyricsForTrack(track, options?)`
  - `markTrackActive(guildId, track)`
  - `markTrackInactive(guildId, track?)`
- `LyricsOvhClient`:
  - `getLyricsForTrack(track, options?)`
- `GeniusClient`:
  - `isConfigured()`
  - `getLyricsForTrack(track, options?)`
- `GeniusOAuthHelper`:
  - `static exchangeCode(options)`

## Error Handling

Use structured errors and code checks where possible.

Common errors:

- `NodeUnavailableError`
  - Codes: `NO_AVAILABLE_NODE`, `NODE_ALREADY_REGISTERED`, `NODE_NOT_FOUND`
- `InvalidNodeStateError`
  - Code: `NODE_NOT_READY` (incomplete node builder)
- `InvalidPlayerStateError`
  - Codes: `PLAYER_NOT_READY`, `PLAYER_NOT_PLAYING`, `PLAYER_SESSION_UNAVAILABLE`, `PLAYER_CONNECT_UNSUPPORTED`
- `LavalinkConnectionError`
  - Code: `GATEWAY_FORWARDER_MISSING` (missing `sendGatewayPayload`), plus connection-level failures.
- REST transport:
  - `LavalinkRestError` (non-2xx, includes `status`, `path`)
  - `ValidationError` (response schema mismatch)
- Plugin runtime:
  - `PluginValidationError` (invalid plugin metadata/dependencies)
  - `PluginTimeoutError` (hook exceeded timeout)

Pattern:

```ts
try {
  const player = lunacord.createPlayer("guild-id");
  await player.searchAndPlay("query", "ytsearch");
} catch (error) {
  if (error instanceof NodeUnavailableError) {
    // no connected node selected
  } else if (error instanceof LavalinkConnectionError) {
    // likely missing/failed gateway forwarding
  } else {
    // fallback
  }
}
```

## Gotchas & Tips

- Root export is intentionally minimal. Do not expect `SearchProvider` from root export; provider strings like `"ytsearch"` are safe.
- If voice never connects, confirm BOTH are true:
  - `sendGatewayPayload` is configured.
  - raw gateway packets are forwarded via `lunacord.handleVoicePacket(packet)`.
- `createPlayer(guildId)` is idempotent per guild: you get existing player if present.
- `player.stop()` defaults to `destroyPlayer=true` and `disconnectVoice=true`.
- Repeat modes are mutually exclusive by design.
- `trackEnd` auto-advance only for reasons `finished` and `loadFailed`.
- WebSocket runtimes that cannot send custom headers will fail unless you provide `webSocketFactory`.
- Search provider default is YouTube (`ytsearch`) when omitted.
- Volume is clamped to `0..1000`.
- Track seek is clamped to duration unless stream.
- Node auto-migration triggers on `nodeReconnectFailed`, not every disconnect.
- `bun.lockb` may not exist in this repo; Bun text lockfile is `bun.lock`.
