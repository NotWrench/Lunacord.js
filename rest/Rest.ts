import type { z } from "zod";
import {
  buildSearchIdentifier,
  type LoadResult,
  LoadResultSchema,
  type PlayerUpdatePayload,
  type RawTrack,
  type SearchProvider,
  type Session,
  SessionSchema,
  TrackSchema,
} from "../types.ts";

export class LavalinkRestError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "LavalinkRestError";
    this.status = status;
    this.path = path;
  }
}

export class ValidationError extends Error {
  readonly issues: z.core.$ZodIssue[];

  constructor(issues: z.core.$ZodIssue[]) {
    const formatted = issues.map((i) => `  - ${i.path?.join(".")}: ${i.message}`).join("\n");
    super(`Validation failed:\n${formatted}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

interface RestOptions {
  baseUrl: string;
  password: string;
}

const TRAILING_SLASH = /\/$/;
const DEFAULT_ERROR_MESSAGE = "Request failed";

export class Rest {
  private readonly baseUrl: string;
  private readonly password: string;

  constructor(options: RestOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASH, "");
    this.password = options.password;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: this.password,
      "Content-Type": "application/json",
    };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody.message) {
        return errorBody.message;
      }
    } catch {
      // Ignore invalid error payloads and fall back to HTTP metadata.
    }

    return response.statusText || `HTTP ${response.status}` || DEFAULT_ERROR_MESSAGE;
  }

  private async request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Promise<T>;
  private async request(
    method: string,
    path: string,
    schema?: undefined,
    body?: unknown
  ): Promise<void>;
  private async request<T>(
    method: string,
    path: string,
    schema?: z.ZodType<T>,
    body?: unknown
  ): Promise<T | void> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const message = await this.parseErrorMessage(response);
      throw new LavalinkRestError(message, response.status, path);
    }

    if (!schema) {
      return;
    }

    const data: unknown = await response.json();
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new ValidationError(result.error.issues);
    }

    return result.data;
  }

  loadTracks(identifier: string): Promise<LoadResult> {
    const encodedIdentifier = encodeURIComponent(identifier);
    return this.request("GET", `/v4/loadtracks?identifier=${encodedIdentifier}`, LoadResultSchema);
  }

  search(query: string, provider?: SearchProvider): Promise<LoadResult> {
    return this.loadTracks(buildSearchIdentifier(query, provider));
  }

  decodeTrack(encodedTrack: string): Promise<RawTrack> {
    const encoded = encodeURIComponent(encodedTrack);
    return this.request("GET", `/v4/decodetrack?encodedTrack=${encoded}`, TrackSchema);
  }

  updatePlayer(sessionId: string, guildId: string, payload: PlayerUpdatePayload): Promise<void> {
    return this.request(
      "PATCH",
      `/v4/sessions/${sessionId}/players/${guildId}?noReplace=false`,
      undefined,
      payload
    );
  }

  destroyPlayer(sessionId: string, guildId: string): Promise<void> {
    return this.request("DELETE", `/v4/sessions/${sessionId}/players/${guildId}`);
  }

  updateSession(sessionId: string, resuming: boolean, timeout?: number): Promise<Session> {
    return this.request("PATCH", `/v4/sessions/${sessionId}`, SessionSchema, {
      resuming,
      timeout,
    });
  }
}
