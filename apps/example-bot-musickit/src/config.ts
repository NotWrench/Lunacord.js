import type { GeniusOptions, LunacordNodeOptions } from "@lunacord/core";

export interface DemoConfig {
  discordToken: string;
  genius?: GeniusOptions;
  /** Optional: if set, the demo installs slash commands to this guild only (instant rollout). */
  installGuildId?: string;
  nodes: readonly LunacordNodeOptions[];
  redis?: { url: string };
}

/**
 * Pull config from environment variables — no external file required. This keeps the
 * example ~15 lines of meaningful code in `index.ts`; config lives here for clarity.
 */
export const loadConfig = (): DemoConfig => {
  const discordToken = process.env.DISCORD_TOKEN?.trim();
  if (!discordToken) {
    throw new Error("DISCORD_TOKEN is required to run the example bot.");
  }

  const lavalinkPortRaw = process.env.LAVALINK_PORT?.trim();
  const lavalinkPort = lavalinkPortRaw ? Number(lavalinkPortRaw) : 2333;
  const port = Number.isFinite(lavalinkPort) ? lavalinkPort : 2333;

  const config: DemoConfig = {
    discordToken,
    nodes: [
      {
        id: process.env.LAVALINK_ID?.trim() || "main",
        host: process.env.LAVALINK_HOST?.trim() || "localhost",
        port,
        password: process.env.LAVALINK_PASSWORD?.trim() || "youshallnotpass",
        secure: process.env.LAVALINK_SECURE?.trim().toLowerCase() === "true",
      },
    ],
  };

  if (process.env.INSTALL_GUILD_ID) {
    config.installGuildId = process.env.INSTALL_GUILD_ID;
  }
  if (
    process.env.GENIUS_CLIENT_ID &&
    process.env.GENIUS_CLIENT_SECRET &&
    process.env.GENIUS_ACCESS_TOKEN
  ) {
    config.genius = {
      clientId: process.env.GENIUS_CLIENT_ID,
      clientSecret: process.env.GENIUS_CLIENT_SECRET,
      accessToken: process.env.GENIUS_ACCESS_TOKEN,
    };
  }
  if (process.env.REDIS_URL) {
    config.redis = { url: process.env.REDIS_URL };
  }

  return config;
};
