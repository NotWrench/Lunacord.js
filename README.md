# Lunacord.js

Previously known as Cosmicord.js, but I guess I had a change of heart and decided to release a new library and start fresh

## Quickstart

```ts
import { Client, GatewayIntentBits } from "discord.js";
import { MusicKit } from "@lunacord/discordjs";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const music = MusicKit.create(client, {
  nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
  onReady: () => music.commands.installDefaults(),
});

await client.login(process.env.DISCORD_TOKEN);
```

Guides and API reference: **[lunacord-js-docs.vercel.app](https://lunacord-js-docs.vercel.app/)** (source in [`apps/docs`](apps/docs)). 
Demos: [`apps/example-bot-musickit`](apps/example-bot-musickit) (MusicKit), [`apps/example-bot-core`](apps/example-bot-core) (core-only).

### Docs

**[lunacord-js-docs.vercel.app](https://lunacord-js-docs.vercel.app/)**.

## License

MIT
