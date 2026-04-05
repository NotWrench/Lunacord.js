// rest/Rest.ts
import type { z } from "zod";
import {
  type LoadResult,
  LoadResultSchema,
  type PlayerUpdatePayload,
  type RawTrack,
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

  private async request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Promise<T> {
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
      let message = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        // Body wasn't JSON; use status text
        message = response.statusText || message;
      }
      throw new LavalinkRestError(message, response.status, path);
    }

    const data: unknown = await response.json();
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new ValidationError(result.error.issues);
    }

    return result.data;
  }

  private async requestVoid(method: string, path: string, body?: unknown): Promise<void> {
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
      let message = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        message = response.statusText || message;
      }
      throw new LavalinkRestError(message, response.status, path);
    }
  }

  loadTracks(identifier: string): Promise<LoadResult> {
    const encoded = encodeURIComponent(identifier);
    return this.request("GET", `/v4/loadtracks?identifier=${encoded}`, LoadResultSchema);
  }

  decodeTrack(encodedTrack: string): Promise<RawTrack> {
    const encoded = encodeURIComponent(encodedTrack);
    return this.request("GET", `/v4/decodetrack?encodedTrack=${encoded}`, TrackSchema);
  }

  updatePlayer(sessionId: string, guildId: string, payload: PlayerUpdatePayload): Promise<void> {
    return this.requestVoid(
      "PATCH",
      `/v4/sessions/${sessionId}/players/${guildId}?noReplace=false`,
      payload
    );
  }

  destroyPlayer(sessionId: string, guildId: string): Promise<void> {
    return this.requestVoid("DELETE", `/v4/sessions/${sessionId}/players/${guildId}`);
  }
}
