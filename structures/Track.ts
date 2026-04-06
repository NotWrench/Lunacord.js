// structures/Track.ts
import { type RawTrack, TrackSchema } from "../types.ts";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;

export class Track {
  readonly encoded: string;
  readonly title: string;
  readonly author: string;
  readonly duration: number;
  readonly identifier: string;
  readonly uri: string | null;
  readonly artworkUrl: string | null;
  readonly isrc: string | null;
  readonly isStream: boolean;
  readonly sourceName: string;

  private readonly raw: RawTrack;

  constructor(data: RawTrack, skipValidation = false) {
    const parsed = skipValidation ? data : TrackSchema.parse(data);

    this.raw = parsed;
    this.encoded = parsed.encoded;
    this.title = parsed.info.title;
    this.author = parsed.info.author;
    this.duration = parsed.info.length;
    this.identifier = parsed.info.identifier;
    this.uri = parsed.info.uri ?? null;
    this.artworkUrl = parsed.info.artworkUrl ?? null;
    this.isrc = parsed.info.isrc ?? null;
    this.isStream = parsed.info.isStream;
    this.sourceName = parsed.info.sourceName;
  }

  static from(data: RawTrack): Track {
    return new Track(data);
  }

  static fromValidated(data: RawTrack): Track {
    return new Track(data, true);
  }

  get durationFormatted(): string {
    if (this.isStream) {
      return "LIVE";
    }

    const totalSeconds = Math.floor(this.duration / MS_PER_SECOND);
    const hours = Math.floor(totalSeconds / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
    const minutes = Math.floor(
      (totalSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE
    );
    const seconds = totalSeconds % SECONDS_PER_MINUTE;

    const pad = (n: number): string => n.toString().padStart(2, "0");

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    return `${pad(minutes)}:${pad(seconds)}`;
  }

  toJSON(): RawTrack {
    return this.raw;
  }
}
