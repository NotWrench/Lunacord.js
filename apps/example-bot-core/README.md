# Lunacord — Example Bot (Core)

Core-first music bot using [`@lunacord/core`](../../packages/core) with manual discord.js wiring.

## Run it

```bash
# Copy the env template and fill it in
cp .env.example .env

# Start a Lavalink v4 server in another terminal, then:
bun run dev
```

## What it demonstrates

- `Lunacord.create()` with explicit `sendGatewayPayload` wiring.
- Manual forwarding of Discord raw packets via `lunacord.handleVoicePacket(packet)`.
- Manual identity binding with `lunacord.bindIdentity({ userId, numShards })` in the ready event.
- Manual slash-command registration (`/ping`, `/play`) through Discord REST routes.
- Manual interaction handling for command execution.
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
