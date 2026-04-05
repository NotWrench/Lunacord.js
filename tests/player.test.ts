// tests/player.test.ts
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Node } from "../core/Node.ts";
import { Player } from "../core/Player.ts";
import { Track } from "../structures/Track.ts";
import type { RawTrack } from "../types.ts";

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

const createMockNode = (): Node => {
  const updatePlayer = mock(() => Promise.resolve());
  const destroyPlayer = mock(() => Promise.resolve());

  return {
    sessionId: "test-session",
    rest: {
      updatePlayer,
      destroyPlayer,
    },
  } as unknown as Node;
};

describe("Player", () => {
  let player: Player;
  let mockNode: Node;
  let track: Track;
  let track2: Track;

  beforeEach(() => {
    mockNode = createMockNode();
    player = new Player("guild-123", mockNode);
    track = new Track(MOCK_RAW_TRACK);
    track2 = new Track(MOCK_RAW_TRACK_2);
  });

  describe("add", () => {
    it("should add a track to the queue", () => {
      player.add(track);
      expect(player.queue).toHaveLength(1);
      expect(player.queue[0]?.title).toBe("Never Gonna Give You Up");
    });
  });

  describe("remove", () => {
    it("should remove track by index and return it", () => {
      player.add(track);
      player.add(track2);

      const removed = player.remove(0);
      expect(removed?.title).toBe("Never Gonna Give You Up");
      expect(player.queue).toHaveLength(1);
    });

    it("should return undefined for out-of-bounds index", () => {
      const removed = player.remove(5);
      expect(removed).toBeUndefined();
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

    it("should dequeue first track and play when no arg given", async () => {
      player.add(track);
      player.add(track2);

      await player.play();

      expect(player.current?.title).toBe("Never Gonna Give You Up");
      expect(player.queue).toHaveLength(1);
      expect(mockNode.rest.updatePlayer).toHaveBeenCalled();
    });

    it("should no-op when queue is empty and no track given", async () => {
      await player.play();

      expect(player.current).toBeNull();
      expect(mockNode.rest.updatePlayer).not.toHaveBeenCalled();
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
  });

  describe("stop", () => {
    it("should clear current track and call REST", async () => {
      player.current = track;

      await player.stop();

      expect(player.current).toBeNull();
      expect(mockNode.rest.updatePlayer).toHaveBeenCalledWith("test-session", "guild-123", {
        track: { encoded: null },
      });
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
  });
});
