# @lunacord/discordjs — MusicKit

Batteries-included discord.js adapter for [Lunacord](https://github.com/NotWrench/Lunacord.js). 5-line music bot:

```ts
import { Client, GatewayIntentBits } from "discord.js";
import { MusicKit } from "@lunacord/discordjs";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

const music = MusicKit.create(client, {
  nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
});

await music.commands.installDefaults();
await client.login(process.env.DISCORD_TOKEN);
```
