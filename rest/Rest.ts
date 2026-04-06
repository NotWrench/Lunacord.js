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
  requestTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

const TRAILING_SLASH = /\/$/;
const DEFAULT_ERROR_MESSAGE = "Request failed";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 250;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);

export class Rest {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly requestTimeoutMs: number;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;

  constructor(options: RestOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASH, "");
    this.headers = {
      Authorization: options.password,
      "Content-Type": "application/json",
    };
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
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
    let attempt = 0;

    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.requestTimeoutMs);
      const init: RequestInit = {
        method,
        headers: this.headers,
        signal: controller.signal,
      };

      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, init);

        if (!response.ok) {
          if (this.shouldRetryResponse(response.status, attempt)) {
            attempt++;
            await this.delay(this.retryDelayMs * 2 ** (attempt - 1));
            continue;
          }

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
      } catch (error) {
        if (this.shouldRetryError(error, attempt)) {
          attempt++;
          await this.delay(this.retryDelayMs * 2 ** (attempt - 1));
          continue;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error(`Request timed out after ${this.requestTimeoutMs}ms`);
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private shouldRetryError(error: unknown, attempt: number): boolean {
    if (attempt >= this.retryAttempts) {
      return false;
    }

    if (error instanceof ValidationError || error instanceof LavalinkRestError) {
      return false;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }

    return error instanceof Error;
  }

  private shouldRetryResponse(status: number, attempt: number): boolean {
    return attempt < this.retryAttempts && RETRYABLE_STATUS_CODES.has(status);
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

  updatePlayer(
    sessionId: string,
    guildId: string,
    payload: PlayerUpdatePayload,
    options?: { noReplace?: boolean }
  ): Promise<void> {
    return this.request(
      "PATCH",
      `/v4/sessions/${sessionId}/players/${guildId}?noReplace=${options?.noReplace ?? false}`,
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
