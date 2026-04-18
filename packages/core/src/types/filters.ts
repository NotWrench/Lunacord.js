import type { z } from "zod";
import type {
  ChannelMixFilterSchema,
  DistortionFilterSchema,
  EqualizerBandSchema,
  FiltersSchema,
  KaraokeFilterSchema,
  LowPassFilterSchema,
  RotationFilterSchema,
  TimescaleFilterSchema,
  TremoloFilterSchema,
  VibratoFilterSchema,
} from "../schemas/lavalink";

export type EqualizerBand = z.infer<typeof EqualizerBandSchema>;
export type KaraokeFilter = z.infer<typeof KaraokeFilterSchema>;
export type TimescaleFilter = z.infer<typeof TimescaleFilterSchema>;
export type TremoloFilter = z.infer<typeof TremoloFilterSchema>;
export type VibratoFilter = z.infer<typeof VibratoFilterSchema>;
export type RotationFilter = z.infer<typeof RotationFilterSchema>;
export type DistortionFilter = z.infer<typeof DistortionFilterSchema>;
export type ChannelMixFilter = z.infer<typeof ChannelMixFilterSchema>;
export type LowPassFilter = z.infer<typeof LowPassFilterSchema>;
export type Filters = z.infer<typeof FiltersSchema>;
