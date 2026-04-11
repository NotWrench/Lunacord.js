import { existsSync, readFileSync } from "node:fs";
import { GatewayIntentBits } from "discord.js";
import type { LunacordOptions } from "../../src/index";

interface DemoConfigFile {
  discord?: {
    guildId?: string;
    token?: string;
  };
  lavalink?: {
    host?: string;
    id?: string;
    password?: string;
    port?: number;
    regions?: string[];
    secure?: boolean;
  };
  lyrics?: {
    genius?: {
      accessToken?: string;
      clientId?: string;
      clientSecret?: string;
    };
  };
}

export interface DemoConfig {
  clientName: string;
  discordGuildId: string;
  discordToken: string;
  lyrics?: LunacordOptions["lyrics"];
  node: {
    host: string;
    id: string;
    password: string;
    port: number;
    regions: string[];
    secure: boolean;
  };
}

const CONFIG_FILE_URL = new URL("./config.json", import.meta.url);

const readConfigFile = (): DemoConfigFile => {
  if (!existsSync(CONFIG_FILE_URL)) {
    return {};
  }

  const raw = readFileSync(CONFIG_FILE_URL, "utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as DemoConfigFile;
  } catch (error) {
    throw new Error(
      `[Config] Failed to parse examples/bot/config.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`[Config] Invalid boolean value: ${value}. Use \"true\" or \"false\".`);
};

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`[Config] Invalid number value: ${value}.`);
  }

  return parsed;
};

const parseRegions = (value: string | undefined): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const regions = value
    .split(",")
    .map((region) => region.trim())
    .filter((region) => region.length > 0);

  return regions.length > 0 ? regions : undefined;
};

const resolveGeniusCredentials = (
  configFile: DemoConfigFile
): LunacordOptions["lyrics"] | undefined => {
  const clientId =
    process.env.GENIUS_CLIENT_ID ??
    process.env.GENIUS_API_CLIENT_ID ??
    configFile.lyrics?.genius?.clientId;
  const clientSecret =
    process.env.GENIUS_CLIENT_SECRET ??
    process.env.GENIUS_API_CLIENT_SECRET ??
    configFile.lyrics?.genius?.clientSecret;
  const accessToken =
    process.env.GENIUS_ACCESS_TOKEN ??
    process.env.GENIUS_API_ACCESS_TOKEN ??
    configFile.lyrics?.genius?.accessToken;

  if (!(clientId && clientSecret && accessToken)) {
    return undefined;
  }

  return {
    genius: {
      accessToken,
      clientId,
      clientSecret,
    },
  };
};

export const demoIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] as const;

export const loadDemoConfig = (): DemoConfig => {
  const configFile = readConfigFile();

  const discordToken = process.env.DISCORD_TOKEN ?? configFile.discord?.token;
  const discordGuildId = process.env.DISCORD_GUILD_ID ?? configFile.discord?.guildId;

  if (!discordToken) {
    throw new Error(
      "[Config] Missing Discord token. Set DISCORD_TOKEN or examples/bot/config.json -> discord.token"
    );
  }

  if (!discordGuildId) {
    throw new Error(
      "[Config] Missing Discord guild ID. Set DISCORD_GUILD_ID or examples/bot/config.json -> discord.guildId"
    );
  }

  const nodeId = process.env.LAVALINK_ID ?? configFile.lavalink?.id ?? "demo-node";
  const nodeHost = process.env.LAVALINK_HOST ?? configFile.lavalink?.host ?? "localhost";
  const nodePort = parseNumber(process.env.LAVALINK_PORT) ?? configFile.lavalink?.port ?? 58232;
  const nodePassword =
    process.env.LAVALINK_PASSWORD ?? configFile.lavalink?.password ?? "youshallnotpass";
  const nodeSecure =
    parseBoolean(process.env.LAVALINK_SECURE) ?? configFile.lavalink?.secure ?? false;
  const nodeRegions = parseRegions(process.env.LAVALINK_REGIONS) ??
    configFile.lavalink?.regions ?? ["local"];

  return {
    clientName: process.env.DISCORD_CLIENT_NAME ?? "LunacordDemo",
    discordGuildId,
    discordToken,
    lyrics: resolveGeniusCredentials(configFile),
    node: {
      host: nodeHost,
      id: nodeId,
      password: nodePassword,
      port: nodePort,
      regions: nodeRegions,
      secure: nodeSecure,
    },
  };
};

export const createLunacordOptions = (
  config: DemoConfig,
  userId: string,
  sendGatewayPayload: NonNullable<LunacordOptions["sendGatewayPayload"]>
): LunacordOptions => ({
  clientName: config.clientName,
  lyrics: config.lyrics,
  nodeSelection: {
    type: "roundRobin",
  },
  nodes: [],
  numShards: 1,
  sendGatewayPayload,
  userId,
});
