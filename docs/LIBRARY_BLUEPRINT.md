# Lunacord Library Blueprint

This document outlines a practical migration path to make Lunacord feel like a polished, extensible library rather than a project-shaped codebase.

## 1) Target Folder Structure

Proposed structure:

```text
src/
  core/
    Lunacord.ts
    Node.ts
    Player.ts
  plugins/
    types.ts
    runtime/
      PluginManager.ts
    builtins/
      metrics.ts
      logger.ts
  transports/
    rest/
      Rest.ts
    websocket/
      Socket.ts
  domain/
    queue/
      Queue.ts
      QueueHistory.ts
    track/
      Track.ts
    filter/
      Filter.ts
  integrations/
    lyrics/
      LyricsClient.ts
      providers/
        LyricsOvhClient.ts
        GeniusClient.ts
        GeniusOAuthHelper.ts
  cache/
    Cache.ts
    CacheManager.ts
    stores/
  errors/
  builders/
  utils/
  schemas/
    lavalink.ts
  index.ts

examples/
  basic/
  plugins/

tests/
  unit/
  integration/
  contract/
```

### Why this helps

- Separates **domain model** from **transport details**.
- Makes plugin internals discoverable and testable.
- Improves API boundaries for future subpath exports.

## 2) Public API Surface (Library-First)

### Keep a small root API

Prefer `lunacord` root exports for stable high-level types and classes only.

### Add subpath exports for power users

- `lunacord/cache`
- `lunacord/plugins`
- `lunacord/lyrics`
- `lunacord/errors`

This lets advanced users import focused modules without relying on private file paths.

## 3) Plugin System Evolution

The current plugin shape is a strong start. To make it ecosystem-ready, add:

### a) Plugin lifecycle hooks

Introduce optional lifecycle hooks:

- `setup(ctx)` for initialization
- `start(ctx)` when nodes are connected
- `stop(ctx)` for graceful shutdown
- `dispose(ctx)` for cleanup

### b) Plugin context contract

Create a versioned, minimal plugin context:

- `logger`
- `events` (typed event bus)
- `cache` (namespace-scoped)
- `registerCommand`/`registerMetric` style extension points
- `getPlayer(guildId)` read API

This avoids passing internal classes directly and reduces breaking changes.

### c) Capabilities and metadata

Require plugin metadata:

- `name`
- `version`
- `apiVersion` (e.g. `"1"`)
- optional `capabilities` and `dependencies`

Use this to validate compatibility at startup.

### d) Isolation policy

Standardize error isolation:

- plugin failures never crash core runtime
- all plugin hook errors emit a single structured `pluginError` event
- support plugin-level timeouts for expensive hooks

## 4) Internal Boundary Improvements

- Introduce `PluginManager` that is solely responsible for invoking hooks.
- Move hook invocation out of `Lunacord` where possible.
- Keep `Player` free of transport concerns by narrowing adapter interfaces.
- Group schemas in `schemas/` to avoid mixed runtime/type declarations.

## 5) Testing Strategy for a Real Library

- **Unit**: queue, filters, plugin hook dispatch, cache stores.
- **Contract**: public API compatibility snapshots (`index.ts` export contracts).
- **Integration**: node failover, reconnect, search transforms, lyrics fallback.
- **Plugin compatibility tests**: fixture plugins loaded against supported API versions.

## 6) Migration Plan (Low Risk)

1. Add `src/` mirror folders and migrate internals incrementally.
2. Introduce `PluginManager` with no behavior change.
3. Add lifecycle hooks as optional.
4. Add plugin metadata validation.
5. Add subpath exports and document them.
6. Keep root exports stable during transition.

## 7) Definition of Done

Lunacord should feel library-grade when:

- public API is intentionally small and versioned
- folder layout follows runtime boundaries
- plugins have lifecycle + compatibility checks
- tests treat plugin compatibility as a first-class concern
