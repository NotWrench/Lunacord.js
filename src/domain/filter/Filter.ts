import type { Rest } from "../../transports/rest/Rest";
import type { Filters } from "../../types";

export const BASSBOOST_FILTERS: Filters = {
  equalizer: [
    { band: 0, gain: 0.15 },
    { band: 1, gain: 0.125 },
    { band: 2, gain: 0.1 },
  ],
};

export const NIGHTCORE_FILTERS: Filters = {
  timescale: {
    pitch: 1.2,
    rate: 1.0,
    speed: 1.15,
  },
};

export const VAPORWAVE_FILTERS: Filters = {
  timescale: {
    pitch: 0.85,
    rate: 1.0,
    speed: 0.8,
  },
};

export const KARAOKE_FILTERS: Filters = {
  karaoke: {
    filterBand: 220,
    filterWidth: 100,
    level: 1,
    monoLevel: 1,
  },
};

interface FilterAdapter {
  readonly getSessionId: () => string;
  readonly guildId: string;
  onClear?: (filters: Filters) => void;
  onUpdate?: (filters: Filters) => void;
  readonly rest: Pick<Rest, "updatePlayer">;
}

type EqualizerBand = NonNullable<Filters["equalizer"]>[number];

export class Filter {
  private filters: Filters = {};
  private readonly adapter: FilterAdapter;

  constructor(adapter: FilterAdapter) {
    this.adapter = adapter;
  }

  get value(): Filters {
    return cloneFilters(this.filters);
  }

  async set(filters: Filters): Promise<void> {
    this.filters = cloneFilters(filters);
    await this.sync();
    this.adapter.onUpdate?.(this.value);
  }

  async update(filters: Partial<Filters>): Promise<void> {
    await this.set(mergeFilters(this.filters, filters));
  }

  async clear(): Promise<void> {
    this.filters = {};
    await this.sync();
    this.adapter.onClear?.(this.value);
  }

  applyLocally(filters: Filters): void {
    this.filters = cloneFilters(filters);
  }

  getPlaybackRate(): number {
    const speed = this.filters.timescale?.speed;
    const rate = this.filters.timescale?.rate;
    const normalizedSpeed =
      typeof speed === "number" && Number.isFinite(speed) && speed > 0 ? speed : 1;
    const normalizedRate = typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 1;
    return normalizedSpeed * normalizedRate;
  }

  setBassboost(): Promise<void> {
    return this.set(BASSBOOST_FILTERS);
  }

  setNightcore(): Promise<void> {
    return this.set(NIGHTCORE_FILTERS);
  }

  setVaporwave(): Promise<void> {
    return this.set(VAPORWAVE_FILTERS);
  }

  setKaraoke(): Promise<void> {
    return this.set(KARAOKE_FILTERS);
  }

  private async sync(): Promise<void> {
    await this.adapter.rest.updatePlayer(this.adapter.getSessionId(), this.adapter.guildId, {
      filters: this.filters,
    });
  }
}

const cloneFilters = (filters: Filters): Filters => JSON.parse(JSON.stringify(filters)) as Filters;

const mergeFilters = (current: Filters, next: Partial<Filters>): Filters => ({
  ...current,
  ...next,
  channelMix: mergeObject(current.channelMix, next.channelMix),
  distortion: mergeObject(current.distortion, next.distortion),
  equalizer: mergeEqualizer(current.equalizer, next.equalizer),
  karaoke: mergeObject(current.karaoke, next.karaoke),
  lowPass: mergeObject(current.lowPass, next.lowPass),
  pluginFilters: mergeObject(current.pluginFilters, next.pluginFilters),
  rotation: mergeObject(current.rotation, next.rotation),
  timescale: mergeObject(current.timescale, next.timescale),
  tremolo: mergeObject(current.tremolo, next.tremolo),
  vibrato: mergeObject(current.vibrato, next.vibrato),
});

const mergeObject = <T extends object>(current?: T, next?: Partial<T>): T | undefined => {
  if (!current && !next) {
    return undefined;
  }

  return {
    ...current,
    ...next,
  } as T;
};

const mergeEqualizer = (
  current?: Filters["equalizer"],
  next?: Filters["equalizer"]
): Filters["equalizer"] => {
  if (!current && !next) {
    return undefined;
  }

  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  const merged = new Map<number, EqualizerBand>();

  for (const band of current) {
    merged.set(band.band, band);
  }

  for (const band of next) {
    merged.set(band.band, band);
  }

  return [...merged.values()].sort((left, right) => left.band - right.band);
};
