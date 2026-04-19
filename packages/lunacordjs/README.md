# lunacord.js

Umbrella package for [Lunacord](https://github.com/NotWrench/Lunacord.js): it **re-exports** the scoped libraries and exposes a small **preset** for discord.js bots.

## Install

```bash
bun add lunacord.js discord.js
# optional, for Redis cache / persistence
bun add redis
```

## Re-exports (main entry)

`import { … } from "lunacord.js"` includes:

- Everything from [`@lunacord/core`](https://www.npmjs.com/package/@lunacord/core)
- [`MusicKit`](https://www.npmjs.com/package/@lunacord/discordjs) and related discord.js types from [`@lunacord/discordjs`](https://www.npmjs.com/package/@lunacord/discordjs)
- Plugin **builtins** from [`@lunacord/plugins`](https://www.npmjs.com/package/@lunacord/plugins) (`createLoggerPlugin`, `createDebugPlugin`, …) — core types like `PluginBuilder` already come from `@lunacord/core`
- Lyrics clients from [`@lunacord/lyrics`](https://www.npmjs.com/package/@lunacord/lyrics)
- Redis helpers from [`@lunacord/cache-redis`](https://www.npmjs.com/package/@lunacord/cache-redis)

For smaller installs and explicit boundaries, depend on `@lunacord/*` packages directly instead.

## Subpath barrels (optional)

| Import | Same as |
|--------|---------|
| `lunacord.js/plugins` | `@lunacord/plugins` |
| `lunacord.js/lyrics` | `@lunacord/lyrics` |
| `lunacord.js/cache` | `@lunacord/cache-redis` |

## Preset: `createLunacordMusicClient`

Builds a [`Client`](https://discord.js.org/docs/packages/discord.js/main/Client:class) with default music intents and a [`MusicKit`](https://www.npmjs.com/package/@lunacord/discordjs) wired like `MusicKit.create(client, options)`.

```ts
import { createLunacordMusicClient, createLoggerPlugin } from "lunacord.js";

const { client, music } = createLunacordMusicClient({
  nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
  logger: console,
  plugins: [createLoggerPlugin({ name: "observer", version: "1.0.0" })],
  onReady: async () => {
    await music.commands.installDefaults();
  },
});

await client.login(process.env.DISCORD_TOKEN);
```

Override Discord intents via `discord.intents` if you need more than `Guilds` and `GuildVoiceStates`.

## Migration

See the [migration guide](https://github.com/NotWrench/Lunacord.js/blob/master/apps/docs/content/docs/migration.mdx) if you are moving from older layouts.
