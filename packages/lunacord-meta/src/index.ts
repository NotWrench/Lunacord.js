/**
 * @deprecated
 *
 * The unscoped `lunacord.js` package is a deprecated meta-package that re-exports
 * `@lunacord/core` for backwards compatibility with the pre-1.0 single-package layout.
 *
 * Please migrate to:
 *
 *   - `@lunacord/core`       — the Lavalink manager
 *   - `@lunacord/discordjs`  — batteries-included MusicKit
 *   - `@lunacord/plugins`    — plugin builder + builtins
 *   - `@lunacord/lyrics`     — lyrics providers
 *   - `@lunacord/cache-redis` — Redis cache + persistence
 *
 * See the migration guide: https://github.com/NotWrench/Lunacord.js/blob/master/apps/docs/content/docs/migration.mdx
 */

export * from "@lunacord/core";
