import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface MockLavalinkOptions {
  /** Lavalink password to accept. Default: `"testpass"`. */
  password?: string;
  /** Port to bind. Default: 0 (random). */
  port?: number;
  /** Fixture session id. Default: `"mock-session"`. */
  sessionId?: string;
}

interface RoutedRequest {
  body: string;
  method: string;
  path: string;
}

type Handler = (request: RoutedRequest) =>
  | {
      status?: number;
      body?: unknown;
    }
  | undefined;

/**
 * Minimal HTTP-only mock Lavalink server useful for Rest-layer tests. For WebSocket tests
 * use {@link createStubWebSocketFactory} — the Socket class is easier to drive through
 * a stub factory than through a real WS implementation.
 */
export class MockLavalinkServer {
  private readonly server: Server;
  private readonly password: string;
  readonly sessionId: string;
  private routes: Array<{ match: (req: RoutedRequest) => boolean; handler: Handler }> = [];
  private port_: number | undefined;

  constructor(options: MockLavalinkOptions = {}) {
    this.password = options.password ?? "testpass";
    this.sessionId = options.sessionId ?? "mock-session";
    this.server = createServer((req, res) => this.onRequest(req, res));
  }

  get port(): number {
    if (this.port_ === undefined) {
      throw new Error("MockLavalinkServer is not listening yet.");
    }
    return this.port_;
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(port = 0): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(port, () => resolve());
    });
    const address = this.server.address();
    if (address && typeof address === "object") {
      this.port_ = address.port;
    }
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  /** Register a route. Each call is tried in insertion order until one matches. */
  on(method: string, pathPattern: string | RegExp, handler: Handler): this {
    const matcher: (req: RoutedRequest) => boolean =
      typeof pathPattern === "string"
        ? (req) => req.method === method && req.path === pathPattern
        : (req) => req.method === method && pathPattern.test(req.path);
    this.routes.push({ match: matcher, handler });
    return this;
  }

  /** Reset all routes. */
  clearRoutes(): this {
    this.routes = [];
    return this;
  }

  private onRequest(req: IncomingMessage, res: ServerResponse): void {
    const auth = req.headers.authorization;
    if (auth !== this.password) {
      res.statusCode = 401;
      res.end("Unauthorized");
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const path = req.url ?? "/";
      const method = req.method ?? "GET";
      const request: RoutedRequest = { method, path, body };
      for (const route of this.routes) {
        if (route.match(request)) {
          const result = route.handler(request) ?? {};
          res.statusCode = result.status ?? 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result.body ?? {}));
          return;
        }
      }
      res.statusCode = 404;
      res.end();
    });
  }
}
