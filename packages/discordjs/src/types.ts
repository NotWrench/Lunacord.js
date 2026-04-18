import type { Lunacord, Player } from "@lunacord/core";
import type {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  Locale,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { MusicKit } from "./MusicKit";

export interface CommandReplyOptions extends InteractionReplyOptions {}

export interface CommandContext {
  readonly client: Client;
  /** Reply ephemerally with an error message. */
  error(message: string): Promise<unknown>;
  /**
   * Returns the existing player for the guild (setting its text channel to the current
   * interaction channel), or `undefined` if none exists.
   */
  getPlayer(): Promise<Player | undefined>;
  readonly interaction: ChatInputCommandInteraction;
  /**
   * Returns the player for the guild, connecting (joining) to the user's voice channel
   * and creating the player when none exists. Replies with an ephemeral error when the
   * user isn't in a voice channel, and returns `undefined` in that case.
   */
  joinAndGetPlayer(): Promise<Player | undefined>;
  readonly lunacord: Lunacord;
  readonly music: MusicKit;
  /** Reply (or edit the deferred reply) with a text/options payload. */
  reply(payload: string | CommandReplyOptions): Promise<unknown>;
  /** Resolve the user's current voice channel id, or `undefined`. */
  resolveVoiceChannel(): Promise<string | undefined>;
}

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

export interface MusicCommand {
  data: SlashCommandData;
  execute: (ctx: CommandContext) => Promise<unknown>;
}

export interface LocalizedString {
  default: string;
  locales?: Partial<Record<Locale, string>>;
}

export type MessageKey =
  | "notInServer"
  | "joinVoiceFirst"
  | "nothingPlaying"
  | "emptyQueue"
  | "failedLoad"
  | "playerConnecting"
  | "nowPlaying"
  | "queued"
  | "playlistLoaded"
  | "paused"
  | "resumed"
  | "stopped"
  | "skipped"
  | "cleared"
  | "volumeSet"
  | "seekTo"
  | "repeatTrackOn"
  | "repeatTrackOff"
  | "repeatQueueOn"
  | "repeatQueueOff"
  | "filterApplied"
  | "filterCleared"
  | "shuffled"
  | "disconnected"
  | "lyricsNotFound"
  | "lyricsUnavailable";

export type MessageTable = Partial<Record<MessageKey, string>>;

export type Locale_ = Locale;

export type CommandMiddleware = (
  ctx: CommandContext,
  next: () => Promise<unknown>
) => Promise<unknown>;

export interface ApplicationCommandsJsonBody
  extends RESTPostAPIChatInputApplicationCommandsJSONBody {}
