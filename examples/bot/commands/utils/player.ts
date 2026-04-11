import { GuildMember } from "discord.js";
import type { Lunacord } from "../../../../src/index";
import type { CommandContext } from "../types";
import { respond } from "./interaction";

type ManagedPlayer = NonNullable<ReturnType<Lunacord["getPlayer"]>>;

const getGuildId = async (context: CommandContext): Promise<string | undefined> => {
  const guildId = context.interaction.guildId;
  if (!guildId) {
    await respond(context.interaction, {
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return undefined;
  }

  return guildId;
};

const resolveVoiceChannelId = async (context: CommandContext): Promise<string | undefined> => {
  const interaction = context.interaction;
  if (!interaction.guild) {
    return undefined;
  }

  if (interaction.member instanceof GuildMember) {
    return interaction.member.voice.channelId ?? undefined;
  }

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.voice.channelId ?? undefined;
  } catch {
    return undefined;
  }
};

export const getExistingPlayer = async (
  context: CommandContext
): Promise<ManagedPlayer | undefined> => {
  const guildId = await getGuildId(context);
  if (!guildId) {
    return undefined;
  }

  const player = context.lunacord.getPlayer(guildId);
  if (player) {
    player.setTextChannel(context.interaction.channelId);
  }

  return player;
};

export const getOrCreateConnectedPlayer = async (
  context: CommandContext
): Promise<ManagedPlayer | undefined> => {
  const guildId = await getGuildId(context);
  if (!guildId) {
    return undefined;
  }

  const existing = context.lunacord.getPlayer(guildId);
  const interaction = context.interaction;

  if (existing) {
    existing.setTextChannel(interaction.channelId);
    if (existing.isConnected) {
      return existing;
    }

    const voiceChannelId = await resolveVoiceChannelId(context);
    if (!voiceChannelId) {
      await respond(interaction, "Join a voice channel first.");
      return undefined;
    }

    await existing.connect(voiceChannelId);
    return existing;
  }

  const voiceChannelId = await resolveVoiceChannelId(context);
  if (!voiceChannelId) {
    await respond(interaction, "Join a voice channel first.");
    return undefined;
  }

  return context.lunacord
    .createPlayer()
    .setGuild(guildId)
    .setVoiceChannel(voiceChannelId)
    .setTextChannel(interaction.channelId)
    .connect();
};

export const getExistingPlayingPlayer = async (
  context: CommandContext
): Promise<ManagedPlayer | undefined> => {
  const player = await getExistingPlayer(context);
  if (!(player && player.current)) {
    await respond(context.interaction, "Nothing is playing.");
    return undefined;
  }

  return player;
};
