# Lunacord Codebase Review (2026-04-10)

## Scope

- Runtime architecture and reliability review of core playback, networking, and caching paths.
- Test suite signal quality and CI reliability review.
- Static review plus local lint/test runs.

## What I Ran

- `bun x ultracite check` ✅ (passes)
- `bun test` ❌ (fails due to test-harness timer API mismatch in multiple suites)

## High-Priority Bugs / Risks

### 1) WebSocket typed-array decoding can read wrong bytes

**Location:** `websocket/Socket.ts` (`handleMessage` branch for `ArrayBuffer.isView(raw)`).

Current logic decodes `new Uint8Array(raw.buffer)`, which ignores `byteOffset` and `byteLength` from typed-array views.
If the view is sliced from a larger backing buffer, JSON parsing may include unrelated bytes and fail intermittently.

**Why this matters:** binary WS frames from some runtimes are frequently provided as typed-array views, not full buffers.

**Fix direction:** decode with offset/length:

- `new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)`

---

### 2) WebSocket constructor error handling masks root causes

**Location:** `websocket/Socket.ts` (`createWebSocket`).

The `try/catch` around `new RuntimeWebSocket(...)` catches **all** constructor errors and replaces them with a generic “headers unsupported” message.
This can hide DNS/runtime failures and makes production debugging materially harder.

**Why this matters:** operational incidents lose actionable error context.

**Fix direction:**

- Only convert known “headers unsupported” failures to the custom error.
- Preserve original message/cause for all other exceptions.

---

### 3) Middleware cannot intentionally clear request body in REST prep

**Location:** `rest/Rest.ts` (`prepareRequest`).

`body: patch.body ?? request.body` prevents middleware from setting body to `null`/`undefined` intentionally, because nullish fallback restores the original body.

**Why this matters:** limits middleware extensibility and can lead to accidental payload leakage after path/method rewrites.

**Fix direction:** use explicit key presence checks, e.g. `"body" in patch`.

## Test-Suite Flags (Reliability / Tooling)

### 4) Timer APIs imported from `vi` are not available in current Bun test runtime

**Location:**

- `tests/player.test.ts` (`vi.useRealTimers()` in `beforeEach`)
- `tests/node.test.ts` (`vi.useRealTimers()`/`vi.useFakeTimers()`)

`bun test` fails broadly because `vi.useRealTimers` / `vi.useFakeTimers` are undefined in this environment.

**Why this matters:** suite reports large false-negative failures and weakens CI confidence.

**Fix direction:** migrate timer usage to Bun-supported APIs (or gate Vitest-specific helpers behind compatible test runner adapters).

## Medium-Priority Improvement Areas

### 5) Retry policy retries all generic `Error` values

**Location:** `rest/Rest.ts` (`shouldRetryError`).

Current implementation retries on any `Error` except custom validation/rest errors. This may retry deterministic programming/configuration errors and amplify load.

**Improvement direction:** classify retryable failures more narrowly (network errors, timeout/abort, explicit transient classes).

---

### 6) Queue shuffle uses `Math.random` directly

**Location:** `structures/Queue.ts` (`shuffle`).

Not a correctness bug, but makes deterministic testing/simulation difficult.

**Improvement direction:** allow optional RNG injection for deterministic test mode.

## Positive Observations

- Core event model is cohesive and strongly typed across `Player`, `Node`, and manager surfaces.
- Extensive test coverage exists for queue/player/node behaviors.
- Cache abstractions are cleanly layered (noop/memory/redis stores).

## Suggested Next Steps

1. Fix test timer compatibility first (restores CI signal quickly).
2. Patch typed-array decode bug in `Socket`.
3. Improve WebSocket constructor error preservation.
4. Harden REST middleware patch semantics.
5. Optionally tighten retry classification and add regression tests for each above bug.
