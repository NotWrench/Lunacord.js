import {
  LUNACORD_PLUGIN_API_VERSION,
  type LunacordPlugin,
  type LunacordPluginEvent,
  type PluginContext,
  type PluginMetadata,
} from "@lunacord/core";

export interface LoggerPluginOptions {
  includeEvents?: readonly string[];
  /**
   * When true, pass the raw observe payload to the logger (can dump huge `Node` graphs).
   * Default false — logs a compact, JSON-safe summary.
   */
  verbose?: boolean;
}

const MAX_DEPTH = 6;
const MAX_KEYS = 48;
const MAX_ARRAY = 32;

function isPlainObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function summarizeNodeLike(o: Record<string, unknown>): Record<string, unknown> | null {
  if (
    typeof o.id !== "string" ||
    !("sessionId" in o) ||
    !("rest" in o) ||
    !("socket" in o) ||
    typeof o.connected !== "boolean"
  ) {
    return null;
  }
  let playerCount: number | undefined;
  const players = o.players;
  if (players instanceof Map) {
    playerCount = players.size;
  }
  return {
    _type: "Node",
    id: o.id,
    sessionId: o.sessionId,
    connected: o.connected,
    playerCount,
  };
}

function summarizePlayerLike(o: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof o.guildId !== "string" || !("queue" in o) || !("history" in o)) {
    return null;
  }
  return { _type: "Player", guildId: o.guildId };
}

function summarizeTrackLike(o: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof o.encoded !== "string" || typeof o.title !== "string" || !("duration" in o)) {
    return null;
  }
  return {
    _type: "Track",
    title: o.title,
    author: typeof o.author === "string" ? o.author : undefined,
    sourceName: typeof o.sourceName === "string" ? o.sourceName : undefined,
  };
}

function summarizePlainObject(o: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, child] of Object.entries(o)) {
    if (++count > MAX_KEYS) {
      out["..."] = "truncated";
      break;
    }
    out[key] = sanitizeObserveValue(child, depth + 1);
  }
  return out;
}

/** Strip class instances so `debug()` never receives circular / megabyte Node dumps. */
export function summarizePluginObserveEvent(event: LunacordPluginEvent): unknown {
  return sanitizeObserveValue(event, 0);
}

function sanitizeObserveValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return "[max-depth]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return value;
  }
  if (t === "bigint") {
    return String(value);
  }
  if (t === "function") {
    return "[function]";
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => sanitizeObserveValue(item, depth + 1));
  }
  if (typeof value !== "object") {
    return String(value);
  }

  const o = value as Record<string, unknown>;
  const asNode = summarizeNodeLike(o);
  if (asNode) {
    return asNode;
  }
  const asPlayer = summarizePlayerLike(o);
  if (asPlayer) {
    return asPlayer;
  }
  const asTrack = summarizeTrackLike(o);
  if (asTrack) {
    return asTrack;
  }
  if (!isPlainObject(value)) {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name ?? "Object";
    return `[${ctor}]`;
  }
  return summarizePlainObject(o, depth);
}

export const createLoggerPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">,
  options: LoggerPluginOptions = {}
): LunacordPlugin => ({
  ...metadata,
  apiVersion: LUNACORD_PLUGIN_API_VERSION,
  observe: (event, context: PluginContext) => {
    if (options.includeEvents && !options.includeEvents.includes(event.type)) {
      return;
    }
    // const data = options.verbose ? event : summarizePluginObserveEvent(event);
    // context.logger.debug(`Observed ${event.type}:`, data);
    context.logger.debug(`Observed ${event.type}`);
  },
});
