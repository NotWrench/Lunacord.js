/**
 * Base shape for all structured Lunacord errors.
 */
export interface LunacordErrorDetails<TCode extends string, TContext> {
  cause?: unknown;
  code: TCode;
  context: TContext;
  /** Optional recovery hint printed alongside `.message` in dev tooling. */
  hint?: string;
  message: string;
}

/**
 * Base error class for public Lunacord errors.
 *
 * In addition to `code`, `context`, and the standard `cause`, every Lunacord error carries
 * an optional `hint` string that tells the developer how to fix the problem (useful in logs
 * and error overlays).
 */
export class LunacordBaseError<TCode extends string, TContext> extends Error {
  override readonly cause?: unknown;
  readonly code: TCode;
  readonly context: TContext;
  readonly hint?: string;

  constructor(details: LunacordErrorDetails<TCode, TContext>) {
    super(details.hint ? `${details.message}\n  → ${details.hint}` : details.message);
    this.name = new.target.name;
    this.code = details.code;
    this.context = details.context;
    this.cause = details.cause;
    this.hint = details.hint;
  }

  /** Plain object form suitable for structured logging. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      hint: this.hint,
      context: this.context,
    };
  }
}

export type LavalinkConnectionErrorCode =
  | "GATEWAY_FORWARDER_MISSING"
  | "LAVALINK_CONNECTION_FAILED";

export interface LavalinkConnectionErrorContext {
  channelId?: string;
  guildId?: string;
  nodeId?: string;
}

/**
 * Raised when Lunacord cannot establish or continue a Lavalink-related connection flow.
 */
export class LavalinkConnectionError extends LunacordBaseError<
  LavalinkConnectionErrorCode,
  LavalinkConnectionErrorContext
> {}

export type NodeUnavailableErrorCode =
  | "NODE_ALREADY_REGISTERED"
  | "NODE_NOT_FOUND"
  | "NO_AVAILABLE_NODE";

export interface NodeUnavailableErrorContext {
  guildId?: string;
  nodeId?: string;
  preferredNodeIds?: readonly string[];
  region?: string;
}

/**
 * Raised when a requested node cannot be resolved or no suitable node is available.
 */
export class NodeUnavailableError extends LunacordBaseError<
  NodeUnavailableErrorCode,
  NodeUnavailableErrorContext
> {}

export type InvalidNodeStateErrorCode = "NODE_NOT_READY";

export interface InvalidNodeStateErrorContext {
  missingFields: readonly ("host" | "password" | "port")[];
  nodeId?: string;
  operation: string;
}

/**
 * Raised when a node operation is attempted in an invalid lifecycle state.
 */
export class InvalidNodeStateError extends LunacordBaseError<
  InvalidNodeStateErrorCode,
  InvalidNodeStateErrorContext
> {}

export type InvalidPlayerStateErrorCode =
  | "PLAYER_CONNECT_UNSUPPORTED"
  | "PLAYER_NOT_PLAYING"
  | "PLAYER_NOT_READY"
  | "PLAYER_SESSION_UNAVAILABLE";

export interface InvalidPlayerStateErrorContext {
  guildId: string;
  operation: string;
}

/**
 * Raised when a player operation is attempted in an invalid lifecycle state.
 */
export class InvalidPlayerStateError extends LunacordBaseError<
  InvalidPlayerStateErrorCode,
  InvalidPlayerStateErrorContext
> {}

export type IdentityErrorCode = "IDENTITY_NOT_BOUND";

export interface IdentityErrorContext {
  operation: string;
}

/**
 * Raised when a voice operation is attempted on a Lunacord instance that has no
 * `userId` / `numShards` bound yet (builder-first API allows deferred binding).
 */
export class IdentityError extends LunacordBaseError<IdentityErrorCode, IdentityErrorContext> {}
