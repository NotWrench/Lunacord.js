import { GatewayIntentBits } from "discord.js";

export const DEFAULT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
] as const;

export const PLAYER_PERSISTENCE_PREFIX = "lunacord:player";

export const DEFAULT_ERROR_MESSAGE = "Command failed unexpectedly.";
