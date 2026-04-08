import { z } from "zod";
import {
  buildSearchIdentifier,
  type InfoResponse,
  InfoResponseSchema,
  type LoadResult,
  LoadResultSchema,
  type PlayerUpdatePayload,
  type RawTrack,
  type RoutePlannerStatus,
  RoutePlannerStatusSchema,
  type SearchProvider,
  type Session,
  SessionSchema,
  TrackSchema,
  type VersionResponse,
} from "../types";

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

export interface RestRequestContext {
  body?: unknown;
  method: string;
  path: string;
  url: string;
}

export interface RestRequestPatch {
  body?: unknown;
  method?: string;
  path?: string;
}

type HttpResponse = Awaited<ReturnType<typeof fetch>>;

export interface RestResponseContext {
  data: unknown;
  request: RestRequestContext;
  response: HttpResponse;
}

export interface RestErrorContext {
  error: unknown;
  request: RestRequestContext;
}

export interface RestMiddleware {
  afterResponse?: (context: RestResponseContext) => Promise<unknown | void> | unknown | void;
  beforeRequest?: (
    context: RestRequestContext
  ) => Promise<RestRequestPatch | void> | RestRequestPatch | void;
  onError?: (context: RestErrorContext) => Promise<void> | void;
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
  private readonly middlewares: RestMiddleware[] = [];
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

  private async parseErrorMessage(response: HttpResponse): Promise<string> {
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
    const { request, response } = await this.sendRequest(method, path, body);

    if (!schema) {
      return;
    }

    const data = await this.readJsonResponse(request, response);
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new ValidationError(result.error.issues);
    }

    return result.data;
  }

  private async requestText(method: string, path: string): Promise<string> {
    const { request, response } = await this.sendRequest(method, path);
    return this.readTextResponse(request, response);
  }

  private async sendRequest(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ request: RestRequestContext; response: HttpResponse }> {
    let attempt = 0;

    while (true) {
      const preparedRequest = await this.prepareRequest(method, path, body);
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.requestTimeoutMs);
      const init: RequestInit = {
        method: preparedRequest.method,
        headers: this.headers,
        signal: controller.signal,
      };

      if (preparedRequest.body !== undefined) {
        init.body = JSON.stringify(preparedRequest.body);
      }

      try {
        const response = await fetch(preparedRequest.url, init);

        if (!response.ok) {
          if (this.shouldRetryResponse(response.status, attempt)) {
            attempt++;
            await this.delay(this.retryDelayMs * 2 ** (attempt - 1));
            continue;
          }

          const message = await this.parseErrorMessage(response);
          throw new LavalinkRestError(message, response.status, preparedRequest.path);
        }

        return {
          request: preparedRequest,
          response,
        };
      } catch (error) {
        if (this.shouldRetryError(error, attempt)) {
          attempt++;
          await this.delay(this.retryDelayMs * 2 ** (attempt - 1));
          continue;
        }

        const finalError =
          error instanceof DOMException && error.name === "AbortError"
            ? new Error(`Request timed out after ${this.requestTimeoutMs}ms`)
            : error;

        await this.notifyError({
          request: preparedRequest,
          error: finalError,
        });

        throw finalError;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  private async prepareRequest(
    method: string,
    path: string,
    body?: unknown
  ): Promise<RestRequestContext> {
    let request: RestRequestContext = {
      method,
      path,
      body,
      url: `${this.baseUrl}${path}`,
    };

    for (const middleware of this.middlewares) {
      const patch = await middleware.beforeRequest?.(request);
      if (!patch) {
        continue;
      }

      request = {
        method: patch.method ?? request.method,
        path: patch.path ?? request.path,
        body: patch.body ?? request.body,
        url: `${this.baseUrl}${patch.path ?? request.path}`,
      };
    }

    return request;
  }

  private async readJsonResponse(
    request: RestRequestContext,
    response: HttpResponse
  ): Promise<unknown> {
    let data: unknown = await response.json();

    for (const middleware of this.middlewares) {
      const nextData = await middleware.afterResponse?.({
        request,
        response,
        data,
      });

      if (nextData !== undefined) {
        data = nextData;
      }
    }

    return data;
  }

  private async readTextResponse(
    request: RestRequestContext,
    response: HttpResponse
  ): Promise<string> {
    let data: unknown = await response.text();

    for (const middleware of this.middlewares) {
      const nextData = await middleware.afterResponse?.({
        request,
        response,
        data,
      });

      if (nextData !== undefined) {
        data = nextData;
      }
    }

    return String(data);
  }

  private async notifyError(context: RestErrorContext): Promise<void> {
    for (const middleware of this.middlewares) {
      await middleware.onError?.(context);
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

  use(middleware: RestMiddleware): void {
    this.middlewares.push(middleware);
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

  decodeTracks(encodedTracks: string[]): Promise<RawTrack[]> {
    return this.request("POST", "/v4/decodetracks", z.array(TrackSchema), encodedTracks);
  }

  getInfo(): Promise<InfoResponse> {
    return this.request("GET", "/v4/info", InfoResponseSchema);
  }

  getRoutePlannerStatus(): Promise<RoutePlannerStatus> {
    return this.request("GET", "/v4/routeplanner/status", RoutePlannerStatusSchema);
  }

  getVersion(): Promise<VersionResponse> {
    return this.requestText("GET", "/version");
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
