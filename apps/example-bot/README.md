# Lunacord — Example Bot

Batteries-included music bot in about 15 lines of meaningful code using [`@lunacord/discordjs`](../../packages/discordjs).

## Run it

```bash
# Copy the env template and fill it in
cp .env.example .env

# Start a Lavalink v4 server in another terminal, then:
bun run dev
```

## What it demonstrates

- `MusicKit.create(client, {...})` auto-wires raw-packet forwarding, op:4 gateway sends,
  intent validation, `userId` / `numShards` binding, and a `sendGatewayPayload` implementation.
- `music.commands.installDefaults()` registers 18 slash commands (play, pause, skip, etc.).
- `music.register({...})` adds a custom command (`/ping`).
- `music.commands.extend("skip", ...)` adds per-command middleware for logging.
- Optional Redis persistence so players rehydrate after bot restarts.
- Optional lyrics via `@lunacord/lyrics` (Lyrics.ovh + Genius fallback).

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
