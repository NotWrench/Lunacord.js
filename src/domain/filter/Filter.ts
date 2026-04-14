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
type ChannelMixFilter = NonNullable<Filters["channelMix"]>;
type DistortionFilter = NonNullable<Filters["distortion"]>;
type KaraokeFilter = NonNullable<Filters["karaoke"]>;
type LowPassFilter = NonNullable<Filters["lowPass"]>;
type PluginFilters = NonNullable<Filters["pluginFilters"]>;
type RotationFilter = NonNullable<Filters["rotation"]>;
type TimescaleFilter = NonNullable<Filters["timescale"]>;
type TremoloFilter = NonNullable<Filters["tremolo"]>;
type VibratoFilter = NonNullable<Filters["vibrato"]>;

type FilterObjectKey =
  | "channelMix"
  | "distortion"
  | "karaoke"
  | "lowPass"
  | "pluginFilters"
  | "rotation"
  | "timescale"
  | "tremolo"
  | "vibrato";

export class Filter {
  private filters: Filters = {};
  private readonly adapter: FilterAdapter;

  constructor(adapter: FilterAdapter) {
    this.adapter = adapter;
  }

  get value(): Filters {
    return cloneFilters(this.filters);
  }

  builder(): FilterBuilder {
    return FilterBuilder.from(this);
  }

  async set(filters: Filters): Promise<void> {
    const nextFilters = cloneFilters(filters);
    validateFilters(nextFilters);
    this.filters = nextFilters;
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

  async setVolume(volume: number): Promise<void> {
    validateVolume(volume);
    await this.update({ volume });
  }

  async clearVolume(): Promise<void> {
    await this.clearKey("volume");
  }

  async setEqualizer(equalizer: Filters["equalizer"]): Promise<void> {
    validateEqualizer(equalizer);
    const nextFilters = this.value;
    nextFilters.equalizer = equalizer ? cloneEqualizer(equalizer) : undefined;
    await this.set(nextFilters);
  }

  async updateEqualizer(equalizer: Filters["equalizer"]): Promise<void> {
    validateEqualizer(equalizer);
    await this.update({ equalizer });
  }

  async setEqualizerBand(band: number, gain: number): Promise<void> {
    validateEqualizerBand({ band, gain });
    await this.update({
      equalizer: [
        {
          band,
          gain,
        },
      ],
    });
  }

  async clearEqualizer(): Promise<void> {
    await this.clearKey("equalizer");
  }

  async updateKaraoke(filter: Partial<KaraokeFilter>): Promise<void> {
    validateKaraoke(filter);
    await this.update({ karaoke: filter });
  }

  async clearKaraoke(): Promise<void> {
    await this.clearObjectKey("karaoke");
  }

  async updateTimescale(filter: Partial<TimescaleFilter>): Promise<void> {
    validateTimescale(filter);
    await this.update({ timescale: filter });
  }

  async clearTimescale(): Promise<void> {
    await this.clearObjectKey("timescale");
  }

  async updateTremolo(filter: Partial<TremoloFilter>): Promise<void> {
    validateTremolo(filter);
    await this.update({ tremolo: filter });
  }

  async clearTremolo(): Promise<void> {
    await this.clearObjectKey("tremolo");
  }

  async updateVibrato(filter: Partial<VibratoFilter>): Promise<void> {
    validateVibrato(filter);
    await this.update({ vibrato: filter });
  }

  async clearVibrato(): Promise<void> {
    await this.clearObjectKey("vibrato");
  }

  async updateRotation(filter: Partial<RotationFilter>): Promise<void> {
    validateRotation(filter);
    await this.update({ rotation: filter });
  }

  async clearRotation(): Promise<void> {
    await this.clearObjectKey("rotation");
  }

  async updateDistortion(filter: Partial<DistortionFilter>): Promise<void> {
    validateDistortion(filter);
    await this.update({ distortion: filter });
  }

  async clearDistortion(): Promise<void> {
    await this.clearObjectKey("distortion");
  }

  async updateChannelMix(filter: Partial<ChannelMixFilter>): Promise<void> {
    validateChannelMix(filter);
    await this.update({ channelMix: filter });
  }

  async clearChannelMix(): Promise<void> {
    await this.clearObjectKey("channelMix");
  }

  async updateLowPass(filter: Partial<LowPassFilter>): Promise<void> {
    validateLowPass(filter);
    await this.update({ lowPass: filter });
  }

  async clearLowPass(): Promise<void> {
    await this.clearObjectKey("lowPass");
  }

  async setPluginFilters(pluginFilters: Filters["pluginFilters"]): Promise<void> {
    validatePluginFilters(pluginFilters);
    const nextFilters = this.value;
    nextFilters.pluginFilters = pluginFilters ? { ...pluginFilters } : undefined;
    await this.set(nextFilters);
  }

  async updatePluginFilters(pluginFilters: PluginFilters): Promise<void> {
    validatePluginFilters(pluginFilters);
    await this.update({ pluginFilters });
  }

  async setPluginFilter(name: string, value: unknown): Promise<void> {
    const normalizedName = normalizePluginFilterName(name);
    const currentFilters = this.value;
    const currentPluginFilters = currentFilters.pluginFilters ?? {};

    await this.setPluginFilters({
      ...currentPluginFilters,
      [normalizedName]: value,
    });
  }

  async removePluginFilter(name: string): Promise<void> {
    const normalizedName = normalizePluginFilterName(name);
    const currentFilters = this.value;

    if (!currentFilters.pluginFilters || !(normalizedName in currentFilters.pluginFilters)) {
      return;
    }

    const nextPluginFilters = { ...currentFilters.pluginFilters };
    delete nextPluginFilters[normalizedName];

    if (Object.keys(nextPluginFilters).length === 0) {
      await this.clearPluginFilters();
      return;
    }

    await this.setPluginFilters(nextPluginFilters);
  }

  async clearPluginFilters(): Promise<void> {
    await this.clearObjectKey("pluginFilters");
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

  private async clearKey(key: keyof Filters): Promise<void> {
    const nextFilters = this.value;
    delete nextFilters[key];
    await this.set(nextFilters);
  }

  private async clearObjectKey(key: FilterObjectKey): Promise<void> {
    await this.clearKey(key);
  }

  private async sync(): Promise<void> {
    await this.adapter.rest.updatePlayer(this.adapter.getSessionId(), this.adapter.guildId, {
      filters: this.filters,
    });
  }
}

export class FilterBuilder {
  private readonly filter: Filter;
  private readonly snapshot: Filters;

  private constructor(filter: Filter, snapshot: Filters) {
    this.filter = filter;
    this.snapshot = cloneFilters(snapshot);
  }

  static from(filter: Filter): FilterBuilder {
    return new FilterBuilder(filter, filter.value);
  }

  get value(): Filters {
    return cloneFilters(this.snapshot);
  }

  apply(): Promise<void> {
    if (Object.keys(this.snapshot).length === 0) {
      return this.filter.clear();
    }

    return this.filter.set(this.snapshot);
  }

  clear(): FilterBuilder {
    return new FilterBuilder(this.filter, {});
  }

  set(filters: Filters): FilterBuilder {
    validateFilters(filters);
    return new FilterBuilder(this.filter, filters);
  }

  update(filters: Partial<Filters>): FilterBuilder {
    validateFilters(filters);
    return new FilterBuilder(this.filter, mergeFilters(this.snapshot, filters));
  }

  setVolume(volume: number): FilterBuilder {
    validateVolume(volume);
    return this.withUpdate((nextFilters) => {
      nextFilters.volume = volume;
    });
  }

  clearVolume(): FilterBuilder {
    return this.without("volume");
  }

  setEqualizer(equalizer: Filters["equalizer"]): FilterBuilder {
    validateEqualizer(equalizer);
    return this.withUpdate((nextFilters) => {
      nextFilters.equalizer = equalizer ? cloneEqualizer(equalizer) : undefined;
    });
  }

  updateEqualizer(equalizer: Filters["equalizer"]): FilterBuilder {
    validateEqualizer(equalizer);
    return this.update({ equalizer });
  }

  setEqualizerBand(band: number, gain: number): FilterBuilder {
    validateEqualizerBand({ band, gain });
    return this.updateEqualizer([
      {
        band,
        gain,
      },
    ]);
  }

  clearEqualizer(): FilterBuilder {
    return this.without("equalizer");
  }

  updateKaraoke(filter: Partial<KaraokeFilter>): FilterBuilder {
    validateKaraoke(filter);
    return this.update({ karaoke: filter });
  }

  clearKaraoke(): FilterBuilder {
    return this.without("karaoke");
  }

  updateTimescale(filter: Partial<TimescaleFilter>): FilterBuilder {
    validateTimescale(filter);
    return this.update({ timescale: filter });
  }

  clearTimescale(): FilterBuilder {
    return this.without("timescale");
  }

  updateTremolo(filter: Partial<TremoloFilter>): FilterBuilder {
    validateTremolo(filter);
    return this.update({ tremolo: filter });
  }

  clearTremolo(): FilterBuilder {
    return this.without("tremolo");
  }

  updateVibrato(filter: Partial<VibratoFilter>): FilterBuilder {
    validateVibrato(filter);
    return this.update({ vibrato: filter });
  }

  clearVibrato(): FilterBuilder {
    return this.without("vibrato");
  }

  updateRotation(filter: Partial<RotationFilter>): FilterBuilder {
    validateRotation(filter);
    return this.update({ rotation: filter });
  }

  clearRotation(): FilterBuilder {
    return this.without("rotation");
  }

  updateDistortion(filter: Partial<DistortionFilter>): FilterBuilder {
    validateDistortion(filter);
    return this.update({ distortion: filter });
  }

  clearDistortion(): FilterBuilder {
    return this.without("distortion");
  }

  updateChannelMix(filter: Partial<ChannelMixFilter>): FilterBuilder {
    validateChannelMix(filter);
    return this.update({ channelMix: filter });
  }

  clearChannelMix(): FilterBuilder {
    return this.without("channelMix");
  }

  updateLowPass(filter: Partial<LowPassFilter>): FilterBuilder {
    validateLowPass(filter);
    return this.update({ lowPass: filter });
  }

  clearLowPass(): FilterBuilder {
    return this.without("lowPass");
  }

  setPluginFilters(pluginFilters: Filters["pluginFilters"]): FilterBuilder {
    validatePluginFilters(pluginFilters);
    return this.withUpdate((nextFilters) => {
      nextFilters.pluginFilters = pluginFilters ? { ...pluginFilters } : undefined;
    });
  }

  updatePluginFilters(pluginFilters: PluginFilters): FilterBuilder {
    validatePluginFilters(pluginFilters);
    return this.update({ pluginFilters });
  }

  setPluginFilter(name: string, value: unknown): FilterBuilder {
    const normalizedName = normalizePluginFilterName(name);
    return this.withUpdate((nextFilters) => {
      nextFilters.pluginFilters = {
        ...(nextFilters.pluginFilters ?? {}),
        [normalizedName]: value,
      };
    });
  }

  removePluginFilter(name: string): FilterBuilder {
    const normalizedName = normalizePluginFilterName(name);
    return this.withUpdate((nextFilters) => {
      if (!nextFilters.pluginFilters) {
        return;
      }

      const mergedPluginFilters = { ...nextFilters.pluginFilters };
      delete mergedPluginFilters[normalizedName];

      if (Object.keys(mergedPluginFilters).length === 0) {
        delete nextFilters.pluginFilters;
        return;
      }

      nextFilters.pluginFilters = mergedPluginFilters;
    });
  }

  clearPluginFilters(): FilterBuilder {
    return this.without("pluginFilters");
  }

  setBassboost(): FilterBuilder {
    return this.set(BASSBOOST_FILTERS);
  }

  setNightcore(): FilterBuilder {
    return this.set(NIGHTCORE_FILTERS);
  }

  setVaporwave(): FilterBuilder {
    return this.set(VAPORWAVE_FILTERS);
  }

  setKaraoke(): FilterBuilder {
    return this.set(KARAOKE_FILTERS);
  }

  private withUpdate(update: (nextFilters: Filters) => void): FilterBuilder {
    const nextFilters = this.value;
    update(nextFilters);
    return new FilterBuilder(this.filter, nextFilters);
  }

  private without(key: keyof Filters): FilterBuilder {
    return this.withUpdate((nextFilters) => {
      delete nextFilters[key];
    });
  }
}

const cloneFilters = (filters: Filters): Filters => JSON.parse(JSON.stringify(filters)) as Filters;

const cloneEqualizer = (equalizer: NonNullable<Filters["equalizer"]>): Filters["equalizer"] =>
  equalizer.map((band) => ({
    band: band.band,
    gain: band.gain,
  }));

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

const validateFilters = (filters: Partial<Filters>): void => {
  if (filters.volume !== undefined) {
    validateVolume(filters.volume);
  }

  if (filters.equalizer !== undefined) {
    validateEqualizer(filters.equalizer);
  }

  if (filters.karaoke !== undefined) {
    validateKaraoke(filters.karaoke);
  }

  if (filters.timescale !== undefined) {
    validateTimescale(filters.timescale);
  }

  if (filters.tremolo !== undefined) {
    validateTremolo(filters.tremolo);
  }

  if (filters.vibrato !== undefined) {
    validateVibrato(filters.vibrato);
  }

  if (filters.rotation !== undefined) {
    validateRotation(filters.rotation);
  }

  if (filters.distortion !== undefined) {
    validateDistortion(filters.distortion);
  }

  if (filters.channelMix !== undefined) {
    validateChannelMix(filters.channelMix);
  }

  if (filters.lowPass !== undefined) {
    validateLowPass(filters.lowPass);
  }

  if (filters.pluginFilters !== undefined) {
    validatePluginFilters(filters.pluginFilters);
  }
};

const validateVolume = (volume: number): void => {
  assertFiniteNumber(volume, "filters.volume");
  assertMinNumber(volume, "filters.volume", 0);
};

const validateEqualizerBand = (band: EqualizerBand): void => {
  assertIntegerNumber(band.band, "filters.equalizer.band");
  assertMinNumber(band.band, "filters.equalizer.band", 0);
  assertFiniteNumber(band.gain, "filters.equalizer.gain");
};

const validateEqualizer = (equalizer?: Filters["equalizer"]): void => {
  if (!equalizer) {
    return;
  }

  for (const band of equalizer) {
    validateEqualizerBand(band);
  }
};

const validateKaraoke = (filter: Partial<KaraokeFilter>): void => {
  assertOptionalFiniteNumber(filter.level, "filters.karaoke.level");
  assertOptionalFiniteNumber(filter.monoLevel, "filters.karaoke.monoLevel");
  assertOptionalFiniteNumber(filter.filterBand, "filters.karaoke.filterBand");
  assertOptionalFiniteNumber(filter.filterWidth, "filters.karaoke.filterWidth");
};

const validateTimescale = (filter: Partial<TimescaleFilter>): void => {
  assertOptionalFiniteNumber(filter.speed, "filters.timescale.speed");
  assertOptionalFiniteNumber(filter.pitch, "filters.timescale.pitch");
  assertOptionalFiniteNumber(filter.rate, "filters.timescale.rate");

  assertOptionalMinNumber(filter.speed, "filters.timescale.speed", 0.000_001);
  assertOptionalMinNumber(filter.pitch, "filters.timescale.pitch", 0.000_001);
  assertOptionalMinNumber(filter.rate, "filters.timescale.rate", 0.000_001);
};

const validateTremolo = (filter: Partial<TremoloFilter>): void => {
  assertOptionalFiniteNumber(filter.frequency, "filters.tremolo.frequency");
  assertOptionalFiniteNumber(filter.depth, "filters.tremolo.depth");
  assertOptionalMinNumber(filter.frequency, "filters.tremolo.frequency", 0);
  assertOptionalMinNumber(filter.depth, "filters.tremolo.depth", 0);
};

const validateVibrato = (filter: Partial<VibratoFilter>): void => {
  assertOptionalFiniteNumber(filter.frequency, "filters.vibrato.frequency");
  assertOptionalFiniteNumber(filter.depth, "filters.vibrato.depth");
  assertOptionalMinNumber(filter.frequency, "filters.vibrato.frequency", 0);
  assertOptionalMinNumber(filter.depth, "filters.vibrato.depth", 0);
};

const validateRotation = (filter: Partial<RotationFilter>): void => {
  assertOptionalFiniteNumber(filter.rotationHz, "filters.rotation.rotationHz");
};

const validateDistortion = (filter: Partial<DistortionFilter>): void => {
  assertOptionalFiniteNumber(filter.sinOffset, "filters.distortion.sinOffset");
  assertOptionalFiniteNumber(filter.sinScale, "filters.distortion.sinScale");
  assertOptionalFiniteNumber(filter.cosOffset, "filters.distortion.cosOffset");
  assertOptionalFiniteNumber(filter.cosScale, "filters.distortion.cosScale");
  assertOptionalFiniteNumber(filter.tanOffset, "filters.distortion.tanOffset");
  assertOptionalFiniteNumber(filter.tanScale, "filters.distortion.tanScale");
  assertOptionalFiniteNumber(filter.offset, "filters.distortion.offset");
  assertOptionalFiniteNumber(filter.scale, "filters.distortion.scale");
};

const validateChannelMix = (filter: Partial<ChannelMixFilter>): void => {
  assertOptionalFiniteNumber(filter.leftToLeft, "filters.channelMix.leftToLeft");
  assertOptionalFiniteNumber(filter.leftToRight, "filters.channelMix.leftToRight");
  assertOptionalFiniteNumber(filter.rightToLeft, "filters.channelMix.rightToLeft");
  assertOptionalFiniteNumber(filter.rightToRight, "filters.channelMix.rightToRight");
};

const validateLowPass = (filter: Partial<LowPassFilter>): void => {
  assertOptionalFiniteNumber(filter.smoothing, "filters.lowPass.smoothing");
  assertOptionalMinNumber(filter.smoothing, "filters.lowPass.smoothing", 0);
};

const validatePluginFilters = (pluginFilters?: Filters["pluginFilters"]): void => {
  if (pluginFilters === undefined) {
    return;
  }

  if (!isRecord(pluginFilters)) {
    throw new Error("filters.pluginFilters must be an object");
  }
};

const normalizePluginFilterName = (name: string): string => {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Plugin filter name must not be empty");
  }

  return normalized;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertFiniteNumber = (value: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
};

const assertIntegerNumber = (value: number, label: string): void => {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
};

const assertMinNumber = (value: number, label: string, minValue: number): void => {
  if (value < minValue) {
    throw new Error(`${label} must be greater than or equal to ${minValue}`);
  }
};

const assertOptionalFiniteNumber = (value: number | undefined, label: string): void => {
  if (value === undefined) {
    return;
  }

  assertFiniteNumber(value, label);
};

const assertOptionalMinNumber = (
  value: number | undefined,
  label: string,
  minValue: number
): void => {
  if (value === undefined) {
    return;
  }

  assertMinNumber(value, label, minValue);
};
