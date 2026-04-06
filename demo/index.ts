import { Client, GatewayIntentBits } from "discord.js";
import { Lunacord } from "../index.ts";

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("Please provide a DISCORD_TOKEN environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let lunacord: Lunacord | null = null;

// Forward all Discord raw packets so Lunacord can manage VOICE_* state internally.
client.on("raw", (packet) => {
  if (!lunacord) {
    return;
  }

  lunacord.handleVoicePacket(packet);
});

client.on("clientReady", async () => {
  console.log(`[Discord] Logged in as ${client.user?.tag}`);

  lunacord = new Lunacord({
    nodes: [
      {
        host: "localhost",
        port: 58232,
        password: "youshallnotpass",
      },
    ],
    userId: client.user!.id,
    numShards: 1,
    clientName: "LunacordDemo",
    sendGatewayPayload: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return;
      }

      guild.shard.send(payload);
    },
  });

  lunacord.on("nodeCreate", ({ node }) => console.log(`[Lavalink] Node created: ${node.id}`));
  lunacord.on("nodeConnect", ({ node }) => console.log(`[Lavalink] Node connected: ${node.id}`));
  lunacord.on("trackStart", ({ track }) => console.log(`[Lavalink] Playing: ${track.title}`));
  lunacord.on("trackEnd", ({ track, reason }) =>
    console.log(`[Lavalink] Track ended: ${track.title} (${reason})`)
  );
  lunacord.on("playerRepeatTrack", ({ guildId, enabled }) => {
    console.log(`[Lavalink] Repeat track ${enabled ? "enabled" : "disabled"} for guild ${guildId}`);
  });
  lunacord.on("playerRepeatQueue", ({ guildId, enabled }) => {
    console.log(`[Lavalink] Repeat queue ${enabled ? "enabled" : "disabled"} for guild ${guildId}`);
  });
  lunacord.on("trackException", ({ track, exception }) =>
    console.error(
      `[Lavalink] Track exception: ${track.title}`,
      `\n  Severity: ${exception.severity}`,
      `\n  Message: ${exception.message}`,
      exception.cause ? `\n  Cause: ${exception.cause}` : ""
    )
  );
  lunacord.on("ws", (event) => {
    switch (event.type) {
      case "nodeReconnecting":
        console.warn(
          `[Lavalink] Node ${event.node.id} reconnecting (attempt ${event.attempt}, retry in ${event.delay}ms)`
        );
        break;
      case "nodeDisconnect":
        console.warn(
          `[Lavalink] Node ${event.node.id} disconnected (${event.code} ${event.reason})`
        );
        break;
      default:
        break;
    }
  });
  lunacord.on("nodeVoiceSocketClosed", (event) => {
    const source = event.byRemote ? "remote" : "local";
    console.warn(
      `[Lavalink] Voice websocket closed (${source}) for guild ${event.guildId} on ${event.node.id}: ${event.code} ${event.reason}`
    );
  });
  lunacord.on("nodeError", (error) =>
    console.error(`[Lavalink] Node error (${error.node.id}):`, error.message)
  );
  lunacord.on("error", (err) => console.error("[Lavalink] Error:", err.message));

  try {
    await lunacord.connect();
  } catch (error) {
    console.error(
      "[Lavalink] Failed to connect:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !lunacord) {
    return;
  }

  const args = message.content.split(" ");
  const command = args.shift()?.toLowerCase();

  if (command === "!play") {
    const query = args.join(" ");
    if (!query) {
      await message.reply("Please provide a search query. Usage: `!play <song>`");
      return;
    }

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      await message.reply("Join a voice channel first.");
      return;
    }

    try {
      const player = lunacord.createPlayer(message.guild.id);
      await player.connect(voiceChannel.id);
      const result = await player.searchAndPlay(query);

      if (result.loadType === "empty" || result.loadType === "error") {
        await message.reply("No results found or an error occurred.");
        return;
      }

      const track = result.tracks[0];
      if (!track) {
        await message.reply("No tracks found.");
        return;
      }

      const action = player.current?.encoded === track.encoded ? "Now playing" : "Queued";
      await message.reply(`${action}: **${track.title}**`);
    } catch (err) {
      console.error(err);
      await message.reply("Failed to load track.");
    }
  }

  if (command === "!skip") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!(player && player.current)) {
      await message.reply("Nothing is playing.");
      return;
    }

    const repeatTrackEnabled = player.isRepeatTrackEnabled;
    const repeatQueueEnabled = player.isRepeatQueueEnabled;
    const hadQueuedTrack = !player.queue.isEmpty;

    await player.skip();

    if (repeatTrackEnabled) {
      await message.reply("Track repeat is enabled, so skip replayed the same track.");
      return;
    }

    if (repeatQueueEnabled && !hadQueuedTrack) {
      await message.reply(
        "Queue repeat is enabled and this was the last track, so playback continued from the loop."
      );
      return;
    }

    await message.reply("Skipped!");
  }

  if (command === "!repeattrack") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    const enabled = player.repeatTrack();
    await message.reply(`Repeat track is now **${enabled ? "enabled" : "disabled"}**.`);
  }

  if (command === "!repeatqueue") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    const enabled = player.repeatQueue();
    await message.reply(`Repeat queue is now **${enabled ? "enabled" : "disabled"}**.`);
  }

  if (command === "!filter") {
    const preset = args.shift()?.toLowerCase();
    const player = lunacord.getPlayer(message.guild.id);
    if (!(player && player.current)) {
      await message.reply("Nothing is playing.");
      return;
    }

    if (!preset) {
      await message.reply("Usage: `!filter <bassboost|nightcore|vaporwave|karaoke|clear>`");
      return;
    }

    try {
      switch (preset) {
        case "bassboost":
          await player.setBassboost();
          await message.reply("Applied filter: **bassboost**");
          break;
        case "nightcore":
          await player.setNightcore();
          await message.reply("Applied filter: **nightcore**");
          break;
        case "vaporwave":
          await player.setVaporwave();
          await message.reply("Applied filter: **vaporwave**");
          break;
        case "karaoke":
          await player.setKaraoke();
          await message.reply("Applied filter: **karaoke**");
          break;
        case "clear":
          await player.clearFilters();
          await message.reply("Cleared all filters.");
          break;
        default:
          await message.reply(
            "Unknown filter. Use `bassboost`, `nightcore`, `vaporwave`, `karaoke`, or `clear`."
          );
          break;
      }
    } catch (error) {
      console.error(error);
      await message.reply("Failed to update filters.");
    }
  }

  if (command === "!stop") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    await player.stop();

    await message.reply("Stopped and disconnected.");
  }
});

client.login(TOKEN).catch((err) => console.error("[Discord] Login failed:", err.message));
