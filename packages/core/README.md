# @lunacord/core

Builder-first [Lavalink v4](https://lavalink.dev) client for Bun and Node.js.

```ts
import { Lunacord } from "@lunacord/core";

const lunacord = Lunacord.create()
  .userId("bot-user-id")
  .shards(1)
  .nodeSelection.leastLoaded()
  .build();

await lunacord
  .createNode()
  .setId("main")
  .setHost("localhost")
  .setPort(2333)
  .setPassword("youshallnotpass")
  .register();

await lunacord.connect();
```

For the batteries-included discord.js integration, see [`@lunacord/discordjs`](https://www.npmjs.com/package/@lunacord/discordjs).
