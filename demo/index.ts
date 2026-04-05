import { Client, GatewayIntentBits } from "discord.js";
import { Node, Track } from "../index.ts";
import type { RawTrack } from "../types.ts";

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

let node: Node;

// Track Discord Voice States to supply to Lavalink
const voiceStates = new Map<string, { sessionId: string; channelId: string }>();
const voiceServers = new Map<string, { token: string; endpoint: string }>();

// Promise-based waiting for voice credentials from Discord
const voiceReadyResolvers = new Map<string, () => void>();

function waitForVoice(guildId: string, timeoutMs = 10_000): Promise<void> {
  // If both pieces already cached, resolve immediately
  if (voiceStates.has(guildId) && voiceServers.has(guildId)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      voiceReadyResolvers.delete(guildId);
      reject(new Error("Voice connection timed out"));
    }, timeoutMs);

    voiceReadyResolvers.set(guildId, () => {
      clearTimeout(timer);
      voiceReadyResolvers.delete(guildId);
      resolve();
    });
  });
}

// Listen to raw Discord Voice Packets
client.on("raw", (packet) => {
  if (packet.t === "VOICE_STATE_UPDATE" && packet.d.user_id === client.user?.id) {
    if (!packet.d.channel_id) {
      voiceStates.delete(packet.d.guild_id);
    } else {
      voiceStates.set(packet.d.guild_id, {
        sessionId: packet.d.session_id,
        channelId: packet.d.channel_id,
      });
    }
    tryResolveVoice(packet.d.guild_id);
  }

  if (packet.t === "VOICE_SERVER_UPDATE") {
    voiceServers.set(packet.d.guild_id, {
      token: packet.d.token,
      endpoint: packet.d.endpoint,
    });
    tryResolveVoice(packet.d.guild_id);
  }
});

function tryResolveVoice(guildId: string) {
  if (voiceStates.has(guildId) && voiceServers.has(guildId)) {
    const resolver = voiceReadyResolvers.get(guildId);
    if (resolver) {
      resolver();
    }
  }
}

function getVoicePayload(guildId: string) {
  const state = voiceStates.get(guildId);
  const server = voiceServers.get(guildId);
  if (!state || !server) {
    return undefined;
  }
  return {
    sessionId: state.sessionId,
    token: server.token,
    endpoint: server.endpoint,
    channelId: state.channelId,
  };
}

client.on("clientReady", async () => {
  console.log(`[Discord] Logged in as ${client.user?.tag}`);

  node = new Node({
    host: "localhost",
    port: 2333,
    password: "youshallnotpass",
    numShards: 1,
    userId: client.user!.id,
    clientName: "LunacordDemo",
  });

  node.on("ready", () => console.log("[Lavalink] Node connected!"));
  node.on("trackStart", ({ track }) => console.log(`[Lavalink] Playing: ${track.title}`));
  node.on("trackEnd", ({ track, reason }) =>
    console.log(`[Lavalink] Track ended: ${track.title} (${reason})`)
  );
  node.on("trackException", ({ track, exception }) =>
    console.error(
      `[Lavalink] Track exception: ${track.title}`,
      `\n  Severity: ${exception.severity}`,
      `\n  Message: ${exception.message}`,
      exception.cause ? `\n  Cause: ${exception.cause}` : ""
    )
  );
  node.on("error", (err) => console.error("[Lavalink] Error:", err.message));

  try {
    await node.connect();
  } catch (error) {
    console.error(
      "[Lavalink] Failed to connect:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !node) {
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

    // Join VC via gateway OP 4
    message.guild.shard.send({
      op: 4,
      d: {
        guild_id: message.guild.id,
        channel_id: voiceChannel.id,
        self_mute: false,
        self_deaf: true,
      },
    });

    try {
      // Wait for Discord to send us voice credentials
      await waitForVoice(message.guild.id);

      const player = node.createPlayer(message.guild.id);
      const res = await player.search(query);

      if (res.loadType === "empty" || res.loadType === "error") {
        await message.reply("No results found or an error occurred.");
        return;
      }

      let track: RawTrack | undefined;
      if (res.loadType === "playlist") {
        track = res.data.tracks[0];
      } else if (res.loadType === "search") {
        track = res.data[0];
      } else {
        track = res.data;
      }

      if (!track) {
        await message.reply("No tracks found.");
        return;
      }

      const voice = getVoicePayload(message.guild.id);
      const sessionId = node.sessionId;
      if (!sessionId || !voice) {
        await message.reply("Voice connection failed.");
        return;
      }

      // Send voice + track in a SINGLE PATCH so Lavalink handles them atomically
      await node.rest.updatePlayer(sessionId, message.guild.id, {
        track: { encoded: track.encoded },
        voice,
      });

      const wrappedTrack = new Track(track);
      player.current = wrappedTrack;

      await message.reply(`Now playing: **${wrappedTrack.title}**`);
    } catch (err) {
      console.error(err);
      await message.reply("Failed to load track.");
    }
  }

  if (command === "!skip") {
    const player = node.getPlayer(message.guild.id);
    if (!(player && player.current)) {
      await message.reply("Nothing is playing.");
      return;
    }
    await player.skip();
    await message.reply("Skipped!");
  }

  if (command === "!stop") {
    const player = node.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    await player.stop();
    await node.destroyPlayer(message.guild.id);

    // Disconnect from VC
    message.guild.shard.send({
      op: 4,
      d: {
        guild_id: message.guild.id,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      },
    });

    await message.reply("Stopped and disconnected.");
  }
});

client.login(TOKEN).catch((err) => console.error("[Discord] Login failed:", err.message));
