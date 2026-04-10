import type { Lunacord, LunacordNodeOptions } from "../core/Lunacord";
import type { Node } from "../core/Node";

type BuilderFlag = true | false;

type NodeBuilderState = {
  host: BuilderFlag;
  password: BuilderFlag;
  port: BuilderFlag;
};

type WithState<TState extends NodeBuilderState, TKey extends keyof NodeBuilderState> = Omit<
  TState,
  TKey
> &
  Record<TKey, true>;

type NodeBuilderReadyState = {
  host: true;
  password: true;
  port: true;
};

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
  readonly register = (() =>
    this.client.addNode(this.config as LunacordNodeOptions)) as TState extends NodeBuilderReadyState
    ? () => Promise<Node>
    : never;

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
}
