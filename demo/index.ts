import { Client, GatewayIntentBits } from "discord.js";
import { Lavacord } from "../index.ts";

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

let lavacord: Lavacord | null = null;

// Forward all Discord raw packets so Lunacord can manage VOICE_* state internally.
client.on("raw", (packet) => {
  if (!lavacord) {
    return;
  }

  lavacord.handleVoicePacket(packet);
});

client.on("clientReady", async () => {
  console.log(`[Discord] Logged in as ${client.user?.tag}`);

  lavacord = new Lavacord({
    nodes: [
      {
        host: "localhost",
        port: 2333,
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

  lavacord.on("ready", ({ node }) => console.log(`[Lavalink] Node connected: ${node.id}`));
  lavacord.on("trackStart", ({ track }) => console.log(`[Lavalink] Playing: ${track.title}`));
  lavacord.on("trackEnd", ({ track, reason }) =>
    console.log(`[Lavalink] Track ended: ${track.title} (${reason})`)
  );
  lavacord.on("trackException", ({ track, exception }) =>
    console.error(
      `[Lavalink] Track exception: ${track.title}`,
      `\n  Severity: ${exception.severity}`,
      `\n  Message: ${exception.message}`,
      exception.cause ? `\n  Cause: ${exception.cause}` : ""
    )
  );
  lavacord.on("error", (err) => console.error("[Lavalink] Error:", err.message));

  try {
    await lavacord.connect();
  } catch (error) {
    console.error(
      "[Lavalink] Failed to connect:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild || !lavacord) {
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
      const player = lavacord.createPlayer(message.guild.id);
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
    const player = lavacord.getPlayer(message.guild.id);
    if (!(player && player.current)) {
      await message.reply("Nothing is playing.");
      return;
    }
    await player.skip();
    await message.reply("Skipped!");
  }

  if (command === "!stop") {
    const player = lavacord.getPlayer(message.guild.id);
    if (!player) {
      await message.reply("Nothing is playing.");
      return;
    }

    await player.stop();

    await message.reply("Stopped and disconnected.");
  }
});

client.login(TOKEN).catch((err) => console.error("[Discord] Login failed:", err.message));
