import type { Lunacord, LunacordNodeOptions } from "../core/Lunacord";
import type { Node } from "../core/Node";
import { InvalidNodeStateError } from "../errors/LunacordError";

type BuilderFlag = true | false;

interface NodeBuilderState {
  host: BuilderFlag;
  password: BuilderFlag;
  port: BuilderFlag;
}

type WithState<TState extends NodeBuilderState, TKey extends keyof NodeBuilderState> = Omit<
  TState,
  TKey
> &
  Record<TKey, true>;

interface NodeBuilderReadyState {
  host: true;
  password: true;
  port: true;
}

export type NodeBuilderStart = NodeBuilder<{
  host: false;
  password: false;
  port: false;
}>;

/**
 * Fluent type-state builder for node registration.
 */
export class NodeBuilder<TState extends NodeBuilderState> {
  private readonly client: Lunacord;
  private readonly config: Partial<LunacordNodeOptions>;

  constructor(client: Lunacord, config: Partial<LunacordNodeOptions> = {}) {
    this.client = client;
    this.config = config;
  }

  /**
   * Registers the node once all required fields are configured.
   */
  readonly register = (async (): Promise<Node> =>
    this.registerInternal()) as TState extends NodeBuilderReadyState ? () => Promise<Node> : never;

  /**
   * Sets the node host.
   */
  setHost(host: string): NodeBuilder<WithState<TState, "host">> {
    return new NodeBuilder(this.client, {
      ...this.config,
      host,
    });
  }

  /**
   * Sets the node port.
   */
  setPort(port: number): NodeBuilder<WithState<TState, "port">> {
    return new NodeBuilder(this.client, {
      ...this.config,
      port,
    });
  }

  /**
   * Sets the node password.
   */
  setPassword(password: string): NodeBuilder<WithState<TState, "password">> {
    return new NodeBuilder(this.client, {
      ...this.config,
      password,
    });
  }

  /**
   * Sets a stable node id.
   */
  setId(id: string): NodeBuilder<TState> {
    return new NodeBuilder(this.client, {
      ...this.config,
      id,
    });
  }

  /**
   * Enables or disables secure transport.
   */
  setSecure(secure: boolean): NodeBuilder<TState> {
    return new NodeBuilder(this.client, {
      ...this.config,
      secure,
    });
  }

  /**
   * Sets preferred regions for this node.
   */
  setRegions(regions: readonly string[]): NodeBuilder<TState> {
    return new NodeBuilder(this.client, {
      ...this.config,
      regions: [...regions],
    });
  }

  /**
   * Configures reconnect attempts.
   */
  setReconnectPolicy(options: {
    initialDelayMs?: number;
    maxAttempts?: number;
    maxDelayMs?: number;
  }): NodeBuilder<TState> {
    return new NodeBuilder(this.client, {
      ...this.config,
      initialReconnectDelayMs: options.initialDelayMs,
      maxReconnectAttempts: options.maxAttempts,
      maxReconnectDelayMs: options.maxDelayMs,
    });
  }

  /**
   * Configures REST request retry/timeout behavior.
   */
  setRequestPolicy(options: {
    retryAttempts?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  }): NodeBuilder<TState> {
    return new NodeBuilder(this.client, {
      ...this.config,
      requestRetryAttempts: options.retryAttempts,
      requestRetryDelayMs: options.retryDelayMs,
      requestTimeoutMs: options.timeoutMs,
    });
  }

  private registerInternal(): Promise<Node> {
    const { host, password, port, ...rest } = this.config;
    const requiredConfig = this.getRequiredConfig(host, password, port, this.config.id);

    const readyConfig: LunacordNodeOptions = {
      ...rest,
      ...requiredConfig,
    };

    return this.client.addNode(readyConfig);
  }

  private getRequiredConfig(
    host: LunacordNodeOptions["host"] | undefined,
    password: LunacordNodeOptions["password"] | undefined,
    port: LunacordNodeOptions["port"] | undefined,
    id: LunacordNodeOptions["id"]
  ): Pick<LunacordNodeOptions, "host" | "password" | "port"> {
    const missingFields: ("host" | "password" | "port")[] = [];

    if (typeof host !== "string" || host.length === 0) {
      missingFields.push("host");
    }

    if (typeof password !== "string" || password.length === 0) {
      missingFields.push("password");
    }

    if (typeof port !== "number" || !Number.isFinite(port)) {
      missingFields.push("port");
    }

    if (missingFields.length > 0) {
      throw new InvalidNodeStateError({
        code: "NODE_NOT_READY",
        message: "Cannot register a node before host, port, and password are set",
        context: {
          missingFields,
          nodeId: id,
          operation: "nodeBuilder.register",
        },
      });
    }

    if (typeof host !== "string" || typeof password !== "string" || typeof port !== "number") {
      throw new InvalidNodeStateError({
        code: "NODE_NOT_READY",
        message: "Cannot register a node before host, port, and password are set",
        context: {
          missingFields: ["host", "password", "port"],
          nodeId: id,
          operation: "nodeBuilder.register",
        },
      });
    }

    return {
      host,
      password,
      port,
    };
  }
}
