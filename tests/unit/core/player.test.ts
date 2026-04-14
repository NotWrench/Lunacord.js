import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { TimerHandler } from "bun";
import type { PlayerNodeAdapter } from "../../../src/core/Player";
import { Player } from "../../../src/core/Player";
import { Filter } from "../../../src/domain/filter/Filter";
import { Queue } from "../../../src/domain/queue/Queue";
import { QueueHistory } from "../../../src/domain/queue/QueueHistory";
import type { SearchResult } from "../../../src/domain/track/SearchResult";
import { Track } from "../../../src/domain/track/Track";
import { InvalidPlayerStateError } from "../../../src/errors/LunacordError";
import type { LyricsClient } from "../../../src/integrations/lyrics/LyricsClient";
import {
  type Filters,
  type LoadResult,
  type RawTrack,
  SearchProvider,
  type SearchProviderInput,
} from "../../../src/types";

const MOCK_RAW_TRACK: RawTrack = {
  encoded: "QAABJAMACk5ldmVyIEdvbm5h...",
  info: {
    identifier: "dQw4w9WgXcQ",
    isSeekable: true,
    author: "Rick Astley",
    length: 212_000,
    isStream: false,
    position: 0,
    title: "Never Gonna Give You Up",
    uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const MOCK_RAW_TRACK_2: RawTrack = {
  encoded: "QAABJAMACk5ldmVyIEdvbm5h_2...",
  info: {
    identifier: "abc123",
    isSeekable: true,
    author: "Test Artist",
    length: 180_000,
    isStream: false,
    position: 0,
    title: "Test Song",
    uri: "https://www.youtube.com/watch?v=abc123",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const createMockNode = (): MockPlayerNode => {
  const updatePlayer = mock(() => Promise.resolve());
  const search = mock(
    (query: string, provider?: SearchProviderInput): Promise<LoadResult> =>
      Promise.resolve({
        loadType: "search",
        data: [MOCK_RAW_TRACK_2],
      })
  );
  const getLyricsForTrack = mock(() =>
    Promise.resolve({
      status: "found" as const,
      lyrics: {
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        url: "https://genius.com/Rick-astley-never-gonna-give-you-up-lyrics",
        lyricsText: "Never gonna give you up",
        albumArtUrl: null,
        releaseDate: null,
        geniusId: 42,
      },
    })
  );

  return {
    lyricsClient: {
      getLyricsForTrack,
    } as unknown as LyricsClient,
    sessionId: "test-session",
    rest: {
      loadTracks: mock(() =>
        Promise.resolve({
          loadType: "search",
          data: [MOCK_RAW_TRACK],
        } satisfies LoadResult)
      ),
      search,
      updatePlayer,
    },
  };
};

interface MockPlayerNode extends PlayerNodeAdapter {
  readonly lyricsClient?: LyricsClient;
}

const getMockEvents = (fn: ReturnType<typeof mock>): unknown[] =>
  (fn.mock.calls as Array<[unknown?]>).map((call) => call[0]);

interface PlayerSkipEvent {
  guildId: string;
  nextTrack: Track | null;
  reason: "manual" | "repeatQueue" | "repeatTrack";
  skippedTrack: Track | null;
  type: "playerSkip";
}

const isEventWithType = (
  event: unknown
): event is {
  type: string;
} => typeof event === "object" && event !== null && "type" in event;

const isPlayerSkipEvent = (event: unknown): event is PlayerSkipEvent =>
  isEventWithType(event) && event.type === "playerSkip";

describe("Player", () => {
  let player: Player;
  let mockNode: MockPlayerNode;
  let track: Track;
  let track2: Track;

  beforeEach(() => {
    mockNode = createMockNode();
    player = new Player("guild-123", mockNode);
    track = new Track(MOCK_RAW_TRACK);
    track2 = new Track(MOCK_RAW_TRACK_2);
  });

  describe("add", () => {
    it("should expose a Queue instance", () => {
      expect(player.queue).toBeInstanceOf(Queue);
      expect(player.history).toBeInstanceOf(QueueHistory);
    });

    it("should add a track to the queue", () => {
      player.add(track);
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.title).toBe("Never Gonna Give You Up");
    });

    it("should add many tracks with a single batched event", () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.addMany([track, track2]);

      expect(player.queue.size).toBe(2);
      expect(emitPlayerEvent).toHaveBeenCalledTimes(1);
      expect(emitPlayerEvent).toHaveBeenCalledWith({
        type: "playerQueueAddMany",
        guildId: "guild-123",
        tracks: [track, track2],
        queueSize: 2,
      });
    });
  });

  describe("clearQueue", () => {
    it("should clear queue and emit a clear event", () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;
      player.add(track);
      player.add(track2);

      player.clearQueue();

      expect(player.queue.size).toBe(0);
      expect(emitPlayerEvent).toHaveBeenLastCalledWith({
        type: "playerQueueClear",
        guildId: "guild-123",
        clearedCount: 2,
        queueSize: 0,
      });
    });
  });

  describe("remove", () => {
    it("should remove track by index and return it", () => {
      player.add(track);
      player.add(track2);

      const removed = player.remove(0);
      expect(removed?.title).toBe("Never Gonna Give You Up");
      expect(player.queue.size).toBe(1);
    });

    it("should return undefined for out-of-bounds index", () => {
      const removed = player.remove(5);
      expect(removed).toBeUndefined();
    });

    it("should emit queue add/remove events", () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.add(track);
      player.remove(0);

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter((event): event is { type: string } => typeof event === "object" && event !== null)
        .map((event) => event.type);
      expect(eventTypes).toEqual(["playerQueueAdd", "playerQueueRemove"]);
    });
  });

  describe("play", () => {
    it("should play an explicit track via REST", async () => {
      await player.play(track);

      expect(player.current?.title).toBe("Never Gonna Give You Up");
      expect(player.paused).toBe(false);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        track: { encoded: track.encoded },
      });
    });

    it("should include cached voice payload without waiting", async () => {
      mockNode.getVoicePayload = mock(() => ({
        channelId: "channel-123",
        endpoint: "us-east.discord.gg",
        sessionId: "voice-session-123",
        token: "voice-token",
      }));

      await player.play(track);

      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        track: { encoded: track.encoded },
        voice: {
          channelId: "channel-123",
          endpoint: "us-east.discord.gg",
          sessionId: "voice-session-123",
          token: "voice-token",
        },
      });
    });

    it("should pass noReplace when requested", async () => {
      await player.play(track, { noReplace: true });

      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith(
        "test-session",
        "guild-123",
        {
          track: { encoded: track.encoded },
        },
        { noReplace: true }
      );
    });

    it("should dequeue first track and play when no arg given", async () => {
      player.add(track);
      player.add(track2);

      await player.play();

      expect(player.current?.title).toBe("Never Gonna Give You Up");
      expect(player.queue.size).toBe(1);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalled();
    });

    it("should no-op when queue is empty and no track given", async () => {
      await player.play();

      expect(player.current).toBeNull();
      expect(mockNode.rest.updatePlayer).not.toHaveBeenCalled();
    });
  });

  describe("seek", () => {
    it("should seek the current track", async () => {
      player.current = track;

      await player.seek(30_000);

      expect(player.position).toBe(30_000);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        position: 30_000,
      });
    });

    it("should clamp seek position for non-stream tracks", async () => {
      player.current = track;

      await player.seek(track.duration + 10_000);

      expect(player.position).toBe(track.duration);
    });

    it("should allow large seek positions for streams", async () => {
      player.current = Track.from({
        ...MOCK_RAW_TRACK,
        info: {
          ...MOCK_RAW_TRACK.info,
          isStream: true,
        },
      });

      await player.seek(999_999);

      expect(player.position).toBe(999_999);
    });

    it("should throw when there is no current track", async () => {
      await expect(player.seek(1_000)).rejects.toBeInstanceOf(InvalidPlayerStateError);
    });
  });

  describe("connect", () => {
    it("should connect via node adapter and expose connected state", async () => {
      const connectVoice = mock(() => Promise.resolve());
      mockNode.connectVoice = connectVoice;

      await player.connect("channel-123");

      expect(connectVoice).toHaveBeenCalledWith("guild-123", "channel-123", undefined);
      expect(player.isConnected).toBe(true);
    });

    it("should throw when node adapter does not expose connectVoice", async () => {
      await expect(player.connect("channel-123")).rejects.toBeInstanceOf(InvalidPlayerStateError);
    });
  });

  describe("pause", () => {
    it("should send paused=true via REST", async () => {
      await player.pause(true);

      expect(player.paused).toBe(true);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        paused: true,
      });
    });

    it("should send paused=false via REST", async () => {
      await player.pause(false);

      expect(player.paused).toBe(false);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        paused: false,
      });
    });

    it("should emit pause and resume events", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      await player.pause(true);
      await player.pause(false);

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter((event): event is { type: string } => typeof event === "object" && event !== null)
        .map((event) => event.type);
      expect(eventTypes).toEqual(["playerPause", "playerResume"]);
    });
  });

  describe("stop", () => {
    it("should clear current track, disconnect voice, and destroy player", async () => {
      player.current = track;

      const disconnectVoice = mock(() => Promise.resolve());
      const destroyPlayer = mock(() => Promise.resolve());
      mockNode.disconnectVoice = disconnectVoice;
      mockNode.destroyPlayer = destroyPlayer;

      await player.stop();

      expect(player.current).toBeNull();
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        track: { encoded: null },
      });
      expect(disconnectVoice).toHaveBeenCalledWith("guild-123");
      expect(destroyPlayer).toHaveBeenCalledWith("guild-123");
    });

    it("should emit stop events with flags", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      await player.stop(false, true);

      expect(emitPlayerEvent).toHaveBeenCalledWith({
        type: "playerStop",
        guildId: "guild-123",
        destroyPlayer: false,
        disconnectVoice: true,
      });
    });
  });

  describe("queue end idle destroy", () => {
    it("should destroy after the default delay when queue ends from track end", async () => {
      const originalSetTimeout = globalThis.setTimeout;
      const originalClearTimeout = globalThis.clearTimeout;
      const pendingHandlers: Array<() => void> = [];
      let scheduledDelay = 0;

      globalThis.setTimeout = ((handler: TimerHandler, delay?: number) => {
        scheduledDelay = Number(delay ?? 0);
        if (typeof handler === "function") {
          pendingHandlers.push(handler);
        }

        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout;
      globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

      const stopSpy = spyOn(player, "stop").mockResolvedValue();

      try {
        player.notifyQueueEmpty("trackEnd");

        expect(scheduledDelay).toBe(120_000);
        expect(stopSpy).not.toHaveBeenCalled();

        pendingHandlers[0]?.();
        await Promise.resolve();

        expect(stopSpy).toHaveBeenCalledWith(true, false);
      } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
      }
    });

    it("should cancel the pending destroy when new tracks are queued", () => {
      const originalSetTimeout = globalThis.setTimeout;
      const originalClearTimeout = globalThis.clearTimeout;
      const clearTimeoutMock = mock(() => {});

      globalThis.setTimeout = ((_: TimerHandler) =>
        77 as unknown as ReturnType<typeof setTimeout>) as typeof setTimeout;
      globalThis.clearTimeout = clearTimeoutMock as typeof clearTimeout;

      try {
        player.notifyQueueEmpty("trackEnd");
        player.add(track);

        expect(clearTimeoutMock).toHaveBeenCalledWith(
          77 as unknown as ReturnType<typeof setTimeout>
        );
      } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
      }
    });

    it("should not schedule destroy for manual queue-empty notifications", () => {
      const originalSetTimeout = globalThis.setTimeout;
      const originalClearTimeout = globalThis.clearTimeout;
      const setTimeoutMock = mock(
        (_: TimerHandler) => 1 as unknown as ReturnType<typeof setTimeout>
      );

      globalThis.setTimeout = setTimeoutMock as typeof setTimeout;
      globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

      try {
        player.notifyQueueEmpty("manual");

        expect(setTimeoutMock).not.toHaveBeenCalled();
      } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
      }
    });
  });

  describe("skip", () => {
    it("should stop and continue without disconnecting voice", async () => {
      player.current = track;
      player.add(track2);

      const disconnectVoice = mock(() => Promise.resolve());
      const destroyPlayer = mock(() => Promise.resolve());
      mockNode.disconnectVoice = disconnectVoice;
      mockNode.destroyPlayer = destroyPlayer;

      await player.skip();

      expect(disconnectVoice).not.toHaveBeenCalled();
      expect(destroyPlayer).not.toHaveBeenCalled();
      expect(player.current?.encoded).toBe(track2.encoded);
    });

    it("should emit skip events", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.current = track;
      player.add(track2);
      await player.skip();

      const skipEvent = getMockEvents(emitPlayerEvent).find(isPlayerSkipEvent);

      expect(skipEvent).toEqual({
        type: "playerSkip",
        guildId: "guild-123",
        skippedTrack: track,
        nextTrack: track2,
        reason: "manual",
      });
    });

    it("should replay the same track on skip when repeatTrack is enabled", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.current = track;
      player.add(track2);
      player.repeatTrack(true);

      await player.skip();

      expect(player.current?.encoded).toBe(track.encoded);
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.encoded).toBe(track2.encoded);

      const skipEvent = getMockEvents(emitPlayerEvent).find(isPlayerSkipEvent);
      expect(skipEvent?.reason).toBe("repeatTrack");
    });

    it("should continue queue loop on skip when repeatQueue is enabled and queue is empty", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.current = track;
      player.repeatQueue(true);

      await player.skip();

      expect(player.current?.encoded).toBe(track.encoded);
      expect(player.queue.isEmpty).toBe(true);

      const skipEvent = getMockEvents(emitPlayerEvent).find(isPlayerSkipEvent);
      expect(skipEvent?.reason).toBe("repeatQueue");
      expect(skipEvent?.nextTrack?.encoded).toBe(track.encoded);
    });

    it("should skip to next track and rotate queue when repeatQueue is enabled", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.current = track;
      player.add(track2);
      player.repeatQueue(true);

      await player.skip();

      expect(player.current?.encoded).toBe(track2.encoded);
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.encoded).toBe(track.encoded);

      const skipEvent = getMockEvents(emitPlayerEvent).find(isPlayerSkipEvent);
      expect(skipEvent?.reason).toBe("repeatQueue");
      expect(skipEvent?.nextTrack?.encoded).toBe(track2.encoded);
    });
  });

  describe("setVolume", () => {
    it("should send the correct volume", async () => {
      await player.setVolume(150);

      expect(player.volume).toBe(150);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        volume: 150,
      });
    });

    it("should clamp volume to 1000", async () => {
      await player.setVolume(1500);

      expect(player.volume).toBe(1000);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        volume: 1000,
      });
    });

    it("should emit volume update events", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      await player.setVolume(350);

      expect(emitPlayerEvent).toHaveBeenCalledWith({
        type: "playerVolumeUpdate",
        guildId: "guild-123",
        volume: 350,
      });
    });
  });

  describe("repeat", () => {
    it("should toggle repeatTrack mode", () => {
      expect(player.isRepeatTrackEnabled).toBe(false);

      const enabled = player.repeatTrack();
      expect(enabled).toBe(true);
      expect(player.isRepeatTrackEnabled).toBe(true);

      const disabled = player.repeatTrack();
      expect(disabled).toBe(false);
      expect(player.isRepeatTrackEnabled).toBe(false);
    });

    it("should toggle repeatQueue mode", () => {
      expect(player.isRepeatQueueEnabled).toBe(false);

      const enabled = player.repeatQueue();
      expect(enabled).toBe(true);
      expect(player.isRepeatQueueEnabled).toBe(true);

      const disabled = player.repeatQueue();
      expect(disabled).toBe(false);
      expect(player.isRepeatQueueEnabled).toBe(false);
    });

    it("should make repeat modes mutually exclusive", () => {
      player.repeatTrack(true);
      expect(player.isRepeatTrackEnabled).toBe(true);
      expect(player.isRepeatQueueEnabled).toBe(false);

      player.repeatQueue(true);
      expect(player.isRepeatQueueEnabled).toBe(true);
      expect(player.isRepeatTrackEnabled).toBe(false);
    });

    it("should emit repeat mode toggle events", () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      player.repeatTrack(true);
      player.repeatQueue(true);

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter((event): event is { type: string } => typeof event === "object" && event !== null)
        .map((event) => event.type);

      expect(eventTypes).toContain("playerRepeatTrack");
      expect(eventTypes).toContain("playerRepeatQueue");
    });
  });

  describe("filters", () => {
    it("should create a Filter instance for each player", () => {
      const anotherPlayer = new Player("guild-456", mockNode);

      expect(player.filter).toBeInstanceOf(Filter);
      expect(anotherPlayer.filter).toBeInstanceOf(Filter);
      expect(player.filter).not.toBe(anotherPlayer.filter);
    });

    it("should set filters and update local state", async () => {
      const filters: Filters = {
        timescale: {
          speed: 1.1,
        },
      };

      await player.setFilters(filters);

      expect(player.filters).toEqual(filters);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        filters,
      });
    });

    it("should merge partial filter updates", async () => {
      await player.setFilters({
        timescale: {
          speed: 1.1,
        },
      });

      await player.updateFilters({
        timescale: {
          pitch: 1.2,
        },
      });

      expect(player.filters).toEqual({
        timescale: {
          pitch: 1.2,
          speed: 1.1,
        },
      });
      expect(mockNode.rest.updatePlayer).toHaveBeenLastCalledWith("test-session", "guild-123", {
        filters: {
          timescale: {
            pitch: 1.2,
            speed: 1.1,
          },
        },
      });
    });

    it("should merge equalizer filters by band", async () => {
      await player.setFilters({
        equalizer: [
          { band: 0, gain: 0.1 },
          { band: 2, gain: 0.2 },
        ],
      });

      await player.updateFilters({
        equalizer: [
          { band: 1, gain: 0.15 },
          { band: 2, gain: 0.25 },
        ],
      });

      expect(player.filters.equalizer).toEqual([
        { band: 0, gain: 0.1 },
        { band: 1, gain: 0.15 },
        { band: 2, gain: 0.25 },
      ]);
    });

    it("should clear filters", async () => {
      await player.setFilters({
        karaoke: {
          level: 1,
        },
      });

      await player.clearFilters();

      expect(player.filters).toEqual({});
      expect(mockNode.rest.updatePlayer).toHaveBeenLastCalledWith("test-session", "guild-123", {
        filters: {},
      });
    });

    it("should apply preset helpers", async () => {
      await player.setBassboost();
      expect(mockNode.rest.updatePlayer).toHaveBeenLastCalledWith("test-session", "guild-123", {
        filters: {
          equalizer: [
            { band: 0, gain: 0.15 },
            { band: 1, gain: 0.125 },
            { band: 2, gain: 0.1 },
          ],
        },
      });

      await player.setNightcore();
      expect(player.filters).toEqual({
        timescale: {
          pitch: 1.2,
          rate: 1,
          speed: 1.15,
        },
      });

      await player.setVaporwave();
      expect(player.filters).toEqual({
        timescale: {
          pitch: 0.85,
          rate: 1,
          speed: 0.8,
        },
      });

      await player.setKaraoke();
      expect(player.filters).toEqual({
        karaoke: {
          filterBand: 220,
          filterWidth: 100,
          level: 1,
          monoLevel: 1,
        },
      });
    });

    it("should emit filter events", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      await player.setFilters({
        timescale: {
          speed: 1.1,
        },
      });
      await player.clearFilters();

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter((event): event is { type: string } => typeof event === "object" && event !== null)
        .map((event) => event.type);
      expect(eventTypes).toContain("playerFiltersUpdate");
      expect(eventTypes).toContain("playerFiltersClear");
    });

    it("should keep filters when playing and skipping", async () => {
      await player.setNightcore();
      player.add(track);
      player.add(track2);

      await player.play();
      await player.skip();

      expect(player.filters).toEqual({
        timescale: {
          pitch: 1.2,
          rate: 1,
          speed: 1.15,
        },
      });
    });

    it("should support custom helper methods for lavalink filter fields", async () => {
      await player.setFilterVolume(0.8);
      await player.setEqualizerBand(4, 0.2);
      await player.updateTimescaleFilter({ speed: 1.1 });
      await player.updateTremoloFilter({ depth: 0.4, frequency: 2 });
      await player.setPluginFilter("my-plugin", { enabled: true });

      expect(player.filters).toEqual({
        equalizer: [{ band: 4, gain: 0.2 }],
        timescale: { speed: 1.1 },
        tremolo: { depth: 0.4, frequency: 2 },
        volume: 0.8,
        pluginFilters: {
          "my-plugin": { enabled: true },
        },
      });
    });

    it("should compose presets and custom updates with createFilterBuilder", async () => {
      const updatePlayer = mockNode.rest.updatePlayer;

      const builder = player
        .createFilterBuilder()
        .setNightcore()
        .setEqualizerBand(0, 0.22)
        .updateChannelMix({ leftToLeft: 0.8 })
        .setPluginFilter("fx", { enabled: true });

      await builder.apply();

      expect(updatePlayer).toHaveBeenCalledTimes(1);
      expect(player.filters).toEqual({
        channelMix: {
          leftToLeft: 0.8,
        },
        equalizer: [{ band: 0, gain: 0.22 }],
        pluginFilters: {
          fx: { enabled: true },
        },
        timescale: {
          pitch: 1.2,
          rate: 1,
          speed: 1.15,
        },
      });
    });

    it("should support plugin filter set, merge, and removal", async () => {
      await player.setPluginFilters({
        alpha: { enabled: true },
      });

      await player.updatePluginFilters({
        beta: { value: 1 },
      });

      await player.removePluginFilter("alpha");

      expect(player.filters.pluginFilters).toEqual({
        beta: { value: 1 },
      });

      await player.clearPluginFilters();
      expect(player.filters.pluginFilters).toBeUndefined();
    });

    it("should reject invalid custom filter values with basic guards", async () => {
      await expect(player.setFilterVolume(-1)).rejects.toThrow(/filters.volume/i);
      await expect(player.updateTimescaleFilter({ speed: 0 })).rejects.toThrow(
        /filters.timescale.speed/i
      );
      await expect(player.setEqualizerBand(1.5, 0.1)).rejects.toThrow(/filters.equalizer.band/i);
    });

    it("should clear individual custom filters", async () => {
      await player
        .createFilterBuilder()
        .setVolume(0.7)
        .updateTimescale({ speed: 1.05 })
        .setPluginFilter("fx", { value: true })
        .setEqualizerBand(2, 0.15)
        .apply();

      await player.clearFilterVolume();
      await player.clearTimescaleFilter();
      await player.clearPluginFilters();
      await player.clearEqualizer();

      expect(player.filters).toEqual({});
    });

    it("should clear filters through builder clear", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;

      await player.setNightcore();
      await player.createFilterBuilder().clear().apply();

      expect(player.filters).toEqual({});

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter((event): event is { type: string } => typeof event === "object" && event !== null)
        .map((event) => event.type);

      expect(eventTypes).toContain("playerFiltersClear");
    });
  });

  describe("queue helpers", () => {
    it("should expose a queue snapshot", () => {
      player.add(track);

      const snapshot = player.getQueue();
      snapshot.pop();

      expect(snapshot).toHaveLength(0);
      expect(player.queue.size).toBe(1);
    });

    it("should emit events for insert, move, shuffle, and dedupe", () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;
      const randomSpy = spyOn(Math, "random");
      randomSpy.mockReturnValue(0);

      player.add(track);
      player.insert(1, track2);
      player.moveQueue(0, 1);
      player.shuffleQueue();
      player.insert(3, track);
      player.removeDuplicateTracks();

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter(isEventWithType)
        .map((event) => event.type);

      expect(eventTypes).toEqual([
        "playerQueueAdd",
        "playerQueueInsert",
        "playerQueueMove",
        "playerQueueShuffle",
        "playerQueueInsert",
        "playerQueueDedupe",
      ]);
    });
  });

  describe("history", () => {
    it("should push skipped tracks into history and allow rewinding", async () => {
      player.current = track;
      player.add(track2);

      await player.skip();

      expect(player.history.peek()).toBe(track);
      const previous = player.previous();
      expect(previous).toBe(track);
      expect(player.queue.peek()).toBe(track);
    });

    it("should fetch lyrics for a history track", async () => {
      player.pushHistory(track);

      const result = await player.getLyricsForHistory(0);

      expect(result).toMatchObject({ status: "found" });
      expect(mockNode.lyricsClient?.getLyricsForTrack).toHaveBeenCalledWith(track, undefined);
    });
  });

  describe("playNext", () => {
    it("should insert the track at the front of the queue", () => {
      player.add(track2);

      player.playNext(track);

      expect(player.queue.toArray()).toEqual([track, track2]);
    });
  });

  describe("setEndTime", () => {
    it("should update the player end time through REST", async () => {
      await player.setEndTime(30_000);

      expect(player.endTime).toBe(30_000);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        endTime: 30_000,
      });
    });
  });

  describe("export/import", () => {
    it("should export and import player state", async () => {
      mockNode.getVoiceChannelId = mock(() => "channel-123");
      player.current = track;
      player.setTextChannel("text-123");
      player.volume = 75;
      player.paused = true;
      player.endTime = 12_000;
      player.repeatQueue(true);
      player.add(track2);
      player.pushHistory(track);
      await player.setFilters({
        timescale: {
          speed: 1.1,
        },
      });

      const snapshot = player.export();
      const importedNode = createMockNode();
      importedNode.getVoiceChannelId = mock(() => "channel-123");
      const importedPlayer = new Player("guild-456", importedNode);

      await importedPlayer.import(snapshot);

      expect(importedPlayer.current?.title).toBe(track.title);
      expect(importedPlayer.queue.peek()?.title).toBe(track2.title);
      expect(importedPlayer.history.peek()?.title).toBe(track.title);
      expect(importedPlayer.volume).toBe(75);
      expect(importedPlayer.endTime).toBe(12_000);
      expect(importedPlayer.textChannelId).toBe("text-123");
      expect(importedPlayer.isRepeatQueueEnabled).toBe(true);
    });

    it("should import filters locally without emitting filter update events", async () => {
      await player.setFilters({
        timescale: {
          speed: 1.1,
        },
      });
      player.add(track);
      const snapshot = player.export();

      const importedNode = createMockNode();
      const emitPlayerEvent = mock(() => {});
      importedNode.emitPlayerEvent = emitPlayerEvent;
      const importedPlayer = new Player("guild-456", importedNode);

      await importedPlayer.import(snapshot);

      const eventTypes = getMockEvents(emitPlayerEvent)
        .filter(isEventWithType)
        .map((event) => event.type);

      expect(eventTypes).not.toContain("playerFiltersUpdate");
      expect(eventTypes).not.toContain("playerQueueClear");
      expect(eventTypes).not.toContain("playerQueueAddMany");
      expect(importedNode.rest.updatePlayer).not.toHaveBeenCalled();
      expect(importedPlayer.filters.timescale?.speed).toBe(1.1);
      expect(importedPlayer.queue.size).toBe(1);
    });
  });

  describe("synced lyrics", () => {
    it("should return the current synced lyric line", () => {
      let now = 1_000;
      spyOn(Date, "now").mockImplementation(() => now);
      player.current = track;
      player.connected = true;
      player.applyState({
        connected: true,
        ping: 0,
        position: 5_000,
        time: Date.now(),
      });
      now += 2_000;

      const line = player.getCurrentLyricLine({
        status: "found",
        lyrics: {
          title: track.title,
          artist: track.author,
          url: "https://example.com",
          lyricsText: "Line 1\nLine 2",
          syncedLyrics: [
            { timeMs: 4_000, text: "Line 1" },
            { timeMs: 6_000, text: "Line 2" },
          ],
        },
      });

      expect(line).toBe("Line 2");
    });
  });

  describe("estimated position", () => {
    it("should interpolate playback position while playing", () => {
      player.current = track;
      player.connected = true;
      player.paused = false;
      const nowSpy = spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      player.applyState({
        time: 1_000_000,
        position: 5_000,
        connected: true,
        ping: 42,
      });
      nowSpy.mockReturnValue(1_002_000);

      expect(player.getEstimatedPosition()).toBe(7_000);
      expect(player.ping).toBe(42);
      nowSpy.mockRestore();
    });

    it("should use local receipt time instead of the server clock for interpolation", () => {
      player.current = track;
      player.connected = true;
      player.paused = false;
      const nowSpy = spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      player.applyState({
        time: 9_999_999,
        position: 5_000,
        connected: true,
        ping: 42,
      });
      nowSpy.mockReturnValue(1_002_000);

      expect(player.getEstimatedPosition()).toBe(7_000);
      nowSpy.mockRestore();
    });

    it("should not advance while paused", () => {
      player.current = track;
      player.connected = true;
      player.paused = true;
      const nowSpy = spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      player.applyState({
        time: 1_000_000,
        position: 5_000,
        connected: true,
        ping: 42,
      });
      nowSpy.mockReturnValue(1_002_000);

      expect(player.getEstimatedPosition()).toBe(5_000);
      nowSpy.mockRestore();
    });

    it("should apply timescale speed when estimating position", async () => {
      player.current = track;
      player.connected = true;
      player.paused = false;
      await player.setFilters({
        timescale: {
          speed: 2,
        },
      });
      const nowSpy = spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      player.applyState({
        time: 1_000_000,
        position: 5_000,
        connected: true,
        ping: 42,
      });
      nowSpy.mockReturnValue(1_002_000);

      expect(player.getEstimatedPosition()).toBe(9_000);
      nowSpy.mockRestore();
    });

    it("should apply slower timescale speed when estimating position", async () => {
      player.current = track;
      player.connected = true;
      player.paused = false;
      await player.setFilters({
        timescale: {
          speed: 0.5,
        },
      });
      const nowSpy = spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      player.applyState({
        time: 1_000_000,
        position: 5_000,
        connected: true,
        ping: 42,
      });
      nowSpy.mockReturnValue(1_002_000);

      expect(player.getEstimatedPosition()).toBe(6_000);
      nowSpy.mockRestore();
    });

    it("should apply combined timescale speed and rate when estimating position", async () => {
      player.current = track;
      player.connected = true;
      player.paused = false;
      await player.setFilters({
        timescale: {
          speed: 2,
          rate: 1.5,
        },
      });
      const nowSpy = spyOn(Date, "now");
      nowSpy.mockReturnValue(1_000_000);
      player.applyState({
        time: 1_000_000,
        position: 5_000,
        connected: true,
        ping: 42,
      });
      nowSpy.mockReturnValue(1_002_000);

      expect(player.getEstimatedPosition()).toBe(11_000);
      nowSpy.mockRestore();
    });
  });

  describe("search", () => {
    it("should use youtube as the default search provider", async () => {
      const result = await player.search("never gonna give you up");

      expect(result.loadType).toBe("search");
      expect(result.tracks[0]).toBeInstanceOf(Track);
      expect(mockNode.rest.search).toHaveBeenCalledWith("never gonna give you up", undefined);
    });

    it("should pass the explicit provider through to rest.search", async () => {
      await player.search("rick astley", SearchProvider.SoundCloud);

      expect(mockNode.rest.search).toHaveBeenCalledWith("rick astley", SearchProvider.SoundCloud);
    });

    it("should return the raw load result unchanged", async () => {
      const result = await player.search("test");

      expect(result.loadType).toBe("search");
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0]?.title).toBe("Test Song");
    });
  });

  describe("searchAndPlay", () => {
    it("should start playback immediately when idle", async () => {
      const result = await player.searchAndPlay("never gonna give you up");

      expect(result.loadType).toBe("search");
      expect(player.current?.title).toBe("Test Song");
      expect(player.queue.isEmpty).toBe(true);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        track: { encoded: MOCK_RAW_TRACK_2.encoded },
      });
    });

    it("should enqueue when already playing", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;
      player.current = track;

      const result = await player.searchAndPlay("test");

      expect(result.loadType).toBe("search");
      expect(player.current?.title).toBe("Never Gonna Give You Up");
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.title).toBe("Test Song");
      expect(
        getMockEvents(emitPlayerEvent)
          .filter(isEventWithType)
          .map((event) => event.type)
      ).toContain("playerQueueAddMany");
    });

    it("should enqueue all playlist tracks", async () => {
      const emitPlayerEvent = mock(() => {});
      mockNode.emitPlayerEvent = emitPlayerEvent;
      mockNode.rest.search = mock(
        (): Promise<LoadResult> =>
          Promise.resolve({
            loadType: "playlist",
            data: {
              info: {
                name: "My Playlist",
                selectedTrack: 0,
              },
              tracks: [MOCK_RAW_TRACK, MOCK_RAW_TRACK_2],
            },
          })
      );

      const result = await player.searchAndPlay("playlist");

      expect(result.loadType).toBe("playlist");
      expect(player.current?.title).toBe("Never Gonna Give You Up");
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.title).toBe("Test Song");
      expect(
        getMockEvents(emitPlayerEvent)
          .filter(isEventWithType)
          .map((event) => event.type)
      ).toEqual(["playerQueueAddMany", "playerPlay"]);
    });

    it("should not mutate playback state for empty results", async () => {
      mockNode.rest.search = mock(
        (): Promise<LoadResult> =>
          Promise.resolve({
            loadType: "empty",
            data: {},
          })
      );

      const result = await player.searchAndPlay("missing");

      expect(result.loadType).toBe("empty");
      expect(player.current).toBeNull();
      expect(player.queue.isEmpty).toBe(true);
      expect(mockNode.rest.updatePlayer).not.toHaveBeenCalled();
    });

    it("should not mutate playback state for error results", async () => {
      mockNode.rest.search = mock(
        (): Promise<LoadResult> =>
          Promise.resolve({
            loadType: "error",
            data: {
              message: "Search failed",
              severity: "fault",
              cause: "upstream",
            },
          })
      );

      const result = (await player.searchAndPlay("broken")) as SearchResult;

      expect(result.loadType).toBe("error");
      expect(player.current).toBeNull();
      expect(player.queue.isEmpty).toBe(true);
      expect(mockNode.rest.updatePlayer).not.toHaveBeenCalled();
    });
  });

  describe("lyrics", () => {
    it("should return no_track when nothing is playing", async () => {
      await expect(player.getLyrics()).resolves.toEqual({
        status: "no_track",
      });
    });

    it("should fetch lyrics for a specific track", async () => {
      const result = await player.getLyricsFor(track, {
        query: "Rick Astley Never Gonna Give You Up",
      });

      expect(result.status).toBe("found");
      expect(mockNode.lyricsClient?.getLyricsForTrack).toHaveBeenCalledWith(track, {
        query: "Rick Astley Never Gonna Give You Up",
      });
    });

    it("should gracefully return unavailable when the node adapter has no lyrics client", async () => {
      const nodeWithoutLyrics = createMockNode();
      const playerWithoutLyrics = new Player("guild-456", {
        ...nodeWithoutLyrics,
        lyricsClient: undefined,
      });
      playerWithoutLyrics.current = track;

      await expect(playerWithoutLyrics.getLyrics()).resolves.toEqual({
        status: "unavailable",
        reason: "provider_unavailable",
      });
    });

    it("should delegate current-track lyrics lookups through the lyrics client", async () => {
      player.current = track;

      const result = await player.getLyrics({ query: "Never Gonna Give You Up lyrics" });

      expect(result.status).toBe("found");
      expect(mockNode.lyricsClient?.getLyricsForTrack).toHaveBeenCalledWith(track, {
        query: "Never Gonna Give You Up lyrics",
      });
    });
  });
});
