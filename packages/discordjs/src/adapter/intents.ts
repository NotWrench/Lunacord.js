import { type Client, GatewayIntentBits } from "discord.js";

export const REQUIRED_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
] as const;

export interface IntentValidationResult {
  missing: GatewayIntentBits[];
  ok: boolean;
}

const resolveIntentBitfield = (intents: Client["options"]["intents"]): number => {
  if (typeof intents === "object" && intents !== null && "bitfield" in intents) {
    return Number((intents as { bitfield: bigint | number }).bitfield);
  }
  if (typeof intents === "number") {
    return intents;
  }
  return 0;
};

const hasIntent = (bitfield: number, intent: GatewayIntentBits): boolean => {
  // Discord gateway intents are bitmask flags — bitwise AND is the documented check.
  // biome-ignore lint/suspicious/noBitwiseOperators: required for Discord intent flag checks
  return (bitfield & intent) === intent;
};

export const validateIntents = (client: Client): IntentValidationResult => {
  const bitfield = resolveIntentBitfield(client.options.intents);

  const missing: GatewayIntentBits[] = [];
  for (const intent of REQUIRED_INTENTS) {
    if (!hasIntent(bitfield, intent)) {
      missing.push(intent);
    }
  }

  return { ok: missing.length === 0, missing };
};

export const intentName = (intent: GatewayIntentBits): string => {
  const entry = Object.entries(GatewayIntentBits).find(
    ([, value]) => typeof value === "number" && value === intent
  );
  return entry?.[0] ?? `Unknown(${intent})`;
};
