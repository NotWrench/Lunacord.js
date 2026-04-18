# lunacord.js (deprecated meta-package)

> ⚠️ This package is a thin deprecation shim. Please migrate to the split packages:
>
> - [`@lunacord/core`](https://www.npmjs.com/package/@lunacord/core) — the Lavalink v4 manager
> - [`@lunacord/discordjs`](https://www.npmjs.com/package/@lunacord/discordjs) — batteries-included MusicKit
> - [`@lunacord/plugins`](https://www.npmjs.com/package/@lunacord/plugins) — plugin builder + builtins
> - [`@lunacord/lyrics`](https://www.npmjs.com/package/@lunacord/lyrics) — lyrics providers
> - [`@lunacord/cache-redis`](https://www.npmjs.com/package/@lunacord/cache-redis) — Redis cache + persistence

## Why?

The single-package layout couldn't cleanly express optional dependencies (Redis, Genius, discord.js). The `@lunacord/*` scope gives each concern its own package boundary, peer deps, and release cadence. `lunacord.js` stays on npm for one minor cycle so existing code keeps installing, and then we'll stop publishing it.

## Migration

See the [migration guide in the docs](https://github.com/NotWrench/Lunacord.js/blob/master/apps/docs/content/docs/migration.mdx).
