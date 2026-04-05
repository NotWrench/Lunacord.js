import { Client, GatewayIntentBits } from "discord.js";
import { Node } from "../index.ts";

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

let node: Node | null = null;

// Forward all Discord raw packets so Lunacord can manage VOICE_* state internally.
client.on("raw", (packet) => {
  if (!node) {
    return;
  }

  node.handleVoicePacket(packet);
});

client.on("clientReady", async () => {
  console.log(`[Discord] Logged in as ${client.user?.tag}`);

  node = new Node({
    host: "localhost",
    port: 2333,
    password: "youshallnotpass",
    numShards: 1,
    userId: client.user!.id,
    clientName: "LunacordDemo",
    setVoiceState: ({ guildId, channelId, selfMute, selfDeaf }) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return;
      }

      guild.shard.send({
        op: 4,
        d: {
          guild_id: guildId,
          channel_id: channelId,
          self_mute: selfMute,
          self_deaf: selfDeaf,
        },
      });
    },
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
      const player = node.createPlayer(message.guild.id);
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

    await message.reply("Stopped and disconnected.");
  }
});

client.login(TOKEN).catch((err) => console.error("[Discord] Login failed:", err.message));
