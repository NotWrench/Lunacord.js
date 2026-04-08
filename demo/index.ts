import { Client, GatewayIntentBits } from "discord.js";
import { Lunacord, SearchProvider } from "../index";

const TOKEN = process.env.DISCORD_TOKEN;
const GENIUS_CLIENT_ID = process.env.GENIUS_CLIENT_ID ?? process.env.GENIUS_API_CLIENT_ID;
const GENIUS_CLIENT_SECRET =
  process.env.GENIUS_CLIENT_SECRET ?? process.env.GENIUS_API_CLIENT_SECRET;
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN ?? process.env.GENIUS_API_ACCESS_TOKEN;

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
const SEARCH_PROVIDERS = new Set<string>(Object.values(SearchProvider));

const isSearchProvider = (value: string): value is SearchProvider => SEARCH_PROVIDERS.has(value);

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
        regions: ["local"],
      },
    ],
    userId: client.user!.id,
    numShards: 1,
    clientName: "LunacordDemo",
    lyrics:
      GENIUS_CLIENT_ID && GENIUS_CLIENT_SECRET && GENIUS_ACCESS_TOKEN
        ? {
            genius: {
              clientId: GENIUS_CLIENT_ID,
              clientSecret: GENIUS_CLIENT_SECRET,
              accessToken: GENIUS_ACCESS_TOKEN,
            },
          }
        : undefined,
    nodeSelection: {
      type: "roundRobin",
    },
    sendGatewayPayload: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return;
      }

      guild.shard.send(payload);
    },
  });

  lunacord.use({
    name: "demo-observer",
    observe: (event) => {
      if (event.type === "playerSeek") {
        console.log(`[Plugin] Seeked guild ${event.guildId} to ${event.position}ms`);
      }
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
    const providerArg = args.shift()?.toLowerCase();
    const query = args.join(" ").trim();

    if (!providerArg || !query) {
      await message.reply(
        "Usage: `!play <provider> <song>` (providers: ytsearch, ytmsearch, scsearch, spsearch, dzsearch, amsearch)"
      );
      return;
    }

    if (!isSearchProvider(providerArg)) {
      await message.reply(
        "Invalid provider. Use one of: ytsearch, ytmsearch, scsearch, spsearch, dzsearch, amsearch."
      );
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
      const result = await player.searchAndPlay(query, providerArg);

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

  if (command === "!seek") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!(player && player.current)) {
      await message.reply("Nothing is playing.");
      return;
    }

    const seconds = Number(args[0]);
    if (!Number.isFinite(seconds) || seconds < 0) {
      await message.reply("Usage: `!seek <seconds>`");
      return;
    }

    try {
      await player.seek(seconds * 1000);
      await message.reply(`Seeked to **${seconds}s**.`);
    } catch (error) {
      console.error(error);
      await message.reply("Failed to seek the current track.");
    }
  }

  if (command === "!lyrics") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    try {
      const result = await player.getLyrics();

      switch (result.status) {
        case "found": {
          const excerpt =
            result.lyrics.lyricsText.length > 1_500
              ? `${result.lyrics.lyricsText.slice(0, 1_497).trimEnd()}...`
              : result.lyrics.lyricsText;
          await message.reply(
            `Lyrics for **${result.lyrics.title}** by **${result.lyrics.artist}**\n${result.lyrics.url}\n\n${excerpt || "*No lyric text available.*"}`
          );
          break;
        }
        case "not_found":
          await message.reply("Lyrics were not found for the current track.");
          break;
        case "unavailable":
          switch (result.reason) {
            case "missing_credentials":
              await message.reply(
                "Genius lyrics are not configured. Set `GENIUS_CLIENT_ID`, `GENIUS_CLIENT_SECRET`, and `GENIUS_ACCESS_TOKEN`."
              );
              break;
            case "invalid_token":
              await message.reply("The configured Genius access token is invalid.");
              break;
            case "rate_limited":
              await message.reply("Genius rate limited the lyrics request. Try again shortly.");
              break;
            default:
              await message.reply("Genius lyrics are currently unavailable.");
              break;
          }
          break;
        case "no_track":
        default:
          await message.reply("Nothing is currently playing.");
          break;
      }
    } catch (error) {
      console.error(error);
      await message.reply("Failed to fetch lyrics.");
    }
  }

  if (command === "!shuffle") {
    const player = lunacord.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    player.shuffleQueue();
    await message.reply("Shuffled the queue.");
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
