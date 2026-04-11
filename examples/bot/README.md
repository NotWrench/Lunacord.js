# Lunacord.js Demo Bot

This demo is a slash-command Discord bot built on `discord.js` + `Lunacord.js`.

## DX-first structure

- `config.ts` - typed config loading (environment first, `config.json` fallback).
- `commands/` - one slash command per file.
- `events/discord/` - Discord event wiring (`raw`, `interactionCreate`, slash registration).
- `events/lunacord/` - Lunacord event and plugin wiring.
- `index.ts` - lightweight bootstrap only.

## Setup

1. Copy `config.example.json` to `config.json` and fill in:
   - `discord.token`
   - `discord.guildId`
2. Run Lavalink v4 (`localhost:58232`, password `youshallnotpass`) or change `lavalink` in config.
3. Invite your Discord bot to the target guild.

## Config precedence

Runtime uses environment variables first, then `config.json` values.

Supported environment keys:

- `DISCORD_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_CLIENT_NAME`
- `LAVALINK_ID`
- `LAVALINK_HOST`
- `LAVALINK_PORT`
- `LAVALINK_PASSWORD`
- `LAVALINK_SECURE` (`true` or `false`)
- `LAVALINK_REGIONS` (comma-separated)
- `GENIUS_CLIENT_ID` / `GENIUS_API_CLIENT_ID`
- `GENIUS_CLIENT_SECRET` / `GENIUS_API_CLIENT_SECRET`
- `GENIUS_ACCESS_TOKEN` / `GENIUS_API_ACCESS_TOKEN`

## Run

```bash
bun run demo:bot
```

On startup, the demo auto-registers slash commands in the configured guild.

## Slash commands

- `/play provider:<provider> query:<song>`
- `/skip`
- `/repeattrack`
- `/repeatqueue`
- `/filter preset:<bassboost|nightcore|vaporwave|karaoke|clear>`
- `/seek seconds:<number>`
- `/lyrics`
- `/shuffle`
- `/stop`
