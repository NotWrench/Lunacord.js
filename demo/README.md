# Lunacord.js Demo Bot

This is a simple proof-of-concept Discord bot using `discord.js` and `Lunacord.js` (your Lavalink v4 Client Library) to demonstrate how the wrapper works.

## Setup

1. Run Lavalink v4 on `localhost` port `58232` with password `youshallnotpass` (or modify the demo node builder options to match your setup).
2. Grab a Discord bot token and invite the bot to your server.
3. Optional for better lyrics fallback coverage: set Genius environment variables:
   - `GENIUS_CLIENT_ID`
   - `GENIUS_CLIENT_SECRET`
   - `GENIUS_ACCESS_TOKEN`
4. Run the bot by passing the token as an environment variable:

```bash
# Using bun
DISCORD_TOKEN=your_token_here bun run index.ts
```

## Commands

- `!play <provider> <song>` — Joins the voice channel and searches/plays (`ytsearch`, `ytmsearch`, `scsearch`, `spsearch`, `dzsearch`, `amsearch`).
- `!skip` — Skips the current track in the queue.
- `!repeattrack` — Toggles repeat for the current track.
- `!repeatqueue` — Toggles repeat for the queue loop.
- `!filter <bassboost|nightcore|vaporwave|karaoke|clear>` — Applies or clears filters.
- `!seek <seconds>` — Seeks the current track.
- `!lyrics` — Fetches lyrics (`lyrics.ovh` first, optional Genius fallback).
- `!shuffle` — Shuffles the queue.
- `!stop` — Stops playback and disconnects the bot.

## How it works

The demo is updated to reflect the current builder-first API:

- Uses `lunacord.createNode().setHost(...).setPort(...).setPassword(...).register()` for node setup.
- Uses `lunacord.createPlugin("demo-observer").observe(...).use()` for plugin registration.
- Uses `lunacord.createPlayer().setGuild(...).setVoiceChannel(...).setTextChannel(...).connect()` for player creation.
- Forwards Discord raw packets via `client.on("raw", packet => lunacord.handleVoicePacket(packet))`.
- Lets Lunacord manage VOICE packet caching, Lavalink sync, queue, filters, and lyrics flow internally.
