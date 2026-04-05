# Lunacord.js Demo Bot

This is a simple proof-of-concept Discord bot using `discord.js` and `Lunacord.js` (your Lavalink v4 Client Library) to demonstrate how the wrapper works.

## Setup

1. Run Lavalink v4 on `localhost` port `2333` with password `youshallnotpass` (or modify the `index.ts` Node options to match your setup).
2. Grab a Discord bot token and invite the bot to your server.
3. Run the bot by passing the token as an environment variable:

```bash
# Using bun
DISCORD_TOKEN=your_token_here bun run index.ts
```

## Commands

- `!play <youtube search query or url>` — Joins the voice channel and plays the track.
- `!skip` — Skips the current track in the queue.
- `!stop` — Stops playback and disconnects the bot.

## How it works

The demo demonstrates the strict architecture built during this session:
- Re-uses `index.ts` from your library (type safety, schemas, and strictly native Bun code).
- Hooks into `discord.js`'s raw WS packet event hook (`client.on('raw')`) to extract `VOICE_SERVER_UPDATE` and `VOICE_STATE_UPDATE` — avoiding third party Node packages or custom Discord WS implementations.
- Updates the Lavalink `Node` by calling `REST` wrapper endpoints transparently using `tryProvideVoiceUpdate()` directly.
