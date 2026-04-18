import {
  type AggregatedLunacordStats,
  LUNACORD_PLUGIN_API_VERSION,
  type LunacordPlugin,
  type PluginMetadata,
} from "@lunacord/core";

export interface StatsReporterPluginOptions {
  /** Optional access to the manager — pass `() => lunacord` or `() => lunacord.getStats()`. */
  getStats: () => AggregatedLunacordStats;
  /** Interval in milliseconds. Default: 30_000. */
  intervalMs?: number;
  /** Called periodically with the aggregated stats. Throwing is logged but never crashes the bot. */
  report: (stats: AggregatedLunacordStats) => Promise<void> | void;
}

/**
 * Periodically calls `report(stats)` so you can push node stats to Datadog / Prometheus /
 * Discord status channels without wiring setInterval yourself.
 */
export const createStatsReporterPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">,
  options: StatsReporterPluginOptions
): LunacordPlugin => {
  const intervalMs = options.intervalMs ?? 30_000;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    ...metadata,
    apiVersion: LUNACORD_PLUGIN_API_VERSION,
    start: (ctx) => {
      timer = setInterval(async () => {
        try {
          await options.report(options.getStats());
        } catch (error) {
          ctx.logger.warn("stats-reporter plugin report() threw", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }, intervalMs);
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    dispose: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
};
