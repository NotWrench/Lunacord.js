import type { AggregatedLunacordStats, Player, Track } from "@lunacord/core";
import { EmbedBuilder } from "discord.js";

const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

export interface MusicEmbedFactory {
  nowPlaying(player: Player): EmbedBuilder;
  playlistLoaded(name: string, trackCount: number): EmbedBuilder;
  queue(player: Player, options?: { limit?: number }): EmbedBuilder;
  stats(stats: AggregatedLunacordStats): EmbedBuilder;
  trackQueued(track: Track, position: number): EmbedBuilder;
}

export const defaultEmbedFactory: MusicEmbedFactory = {
  nowPlaying(player) {
    const track = player.current;
    const embed = new EmbedBuilder()
      .setTitle(track ? track.title : "Nothing playing")
      .setColor(0x8b_5c_f6);

    if (track) {
      embed
        .setURL(track.uri ?? null)
        .setAuthor({ name: track.author })
        .addFields(
          {
            name: "Duration",
            value: track.isStream ? "🔴 Live" : formatDuration(track.duration),
            inline: true,
          },
          {
            name: "Position",
            value: formatDuration(player.getEstimatedPosition()),
            inline: true,
          },
          { name: "Volume", value: `${player.volume}%`, inline: true }
        );
      if (track.artworkUrl) {
        embed.setThumbnail(track.artworkUrl);
      }
    }

    return embed;
  },

  queue(player, options) {
    const limit = options?.limit ?? 10;
    const upcoming = player.queue.toArray().slice(0, limit);
    const embed = new EmbedBuilder().setTitle(`Queue (${player.queue.size})`).setColor(0x8b_5c_f6);

    if (player.current) {
      embed.addFields({
        name: "Now playing",
        value: `**${player.current.title}** — ${player.current.author}`,
      });
    }

    if (upcoming.length > 0) {
      const description = upcoming
        .map((track, index) => `${index + 1}. **${track.title}** — ${track.author}`)
        .join("\n");
      embed.setDescription(description);
    } else {
      embed.setDescription("Queue is empty.");
    }

    return embed;
  },

  stats(stats) {
    return new EmbedBuilder()
      .setTitle("Lunacord stats")
      .setColor(0x8b_5c_f6)
      .addFields(
        {
          name: "Nodes",
          value: `${stats.connectedNodes} / ${stats.totalNodes} connected`,
          inline: true,
        },
        { name: "Players", value: String(stats.players), inline: true },
        { name: "Playing", value: String(stats.playingPlayers), inline: true }
      );
  },

  trackQueued(track, position) {
    return new EmbedBuilder()
      .setTitle("Queued")
      .setColor(0x8b_5c_f6)
      .setDescription(`**${track.title}** — ${track.author}`)
      .setURL(track.uri ?? null)
      .setFooter({ text: `Position in queue: ${position}` });
  },

  playlistLoaded(name, trackCount) {
    return new EmbedBuilder()
      .setTitle("Playlist loaded")
      .setColor(0x8b_5c_f6)
      .setDescription(`**${name}** (${trackCount} ${trackCount === 1 ? "track" : "tracks"})`);
  },
};
