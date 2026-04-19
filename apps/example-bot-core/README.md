# Lunacord — Example Bot (Core)

Core-first music bot using [`@lunacord/core`](../../packages/core) with a custom discord.js client class.

## Run it

```bash
# Copy the env template and fill it in
cp .env.example .env

# Start a Lavalink v4 server in another terminal, then:
bun run dev
```

## What it demonstrates

- A custom `CoreBotClient` class that extends discord.js `Client` and owns the Lunacord manager.
- Discord.js event handlers (`ready`, `raw`, `interactionCreate`) split into dedicated files.
- Lunacord event handlers (debug, node, track, player/queue lifecycle).
- Typed slash-command execute context that includes the extended client and Lunacord manager.
- Slash command publishing strategy: guild scope when `INSTALL_GUILD_ID` is set, otherwise global.
- Optional Redis persistence so players rehydrate after bot restarts.
- Optional lyrics via `@lunacord/lyrics` (Lyrics.ovh + Genius fallback).

## Included commands

- `/ping`
- `/play`
- `/pause`
- `/skip`
- `/stop`
- `/nowplaying`

## Required env

```env
DISCORD_TOKEN=...
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
# Optional:
INSTALL_GUILD_ID=123...            # install slash commands to one guild (instant rollout)
REDIS_URL=redis://localhost:6379   # enables persistence
GENIUS_CLIENT_ID=...               # enables Genius lyrics fallback
GENIUS_CLIENT_SECRET=...
GENIUS_ACCESS_TOKEN=...
```
