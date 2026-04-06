import type { Exception, LoadResult, PlaylistInfo } from "../types";
import { Track } from "./Track";

export interface SearchResultTrack {
  loadType: "track";
  tracks: Track[];
}

export interface SearchResultSearch {
  loadType: "search";
  tracks: Track[];
}

export interface SearchResultPlaylist {
  loadType: "playlist";
  playlistInfo: PlaylistInfo;
  tracks: Track[];
}

export interface SearchResultEmpty {
  loadType: "empty";
  tracks: Track[];
}

export interface SearchResultError {
  error: Exception;
  loadType: "error";
  tracks: Track[];
}

export type SearchResult =
  | SearchResultEmpty
  | SearchResultError
  | SearchResultPlaylist
  | SearchResultSearch
  | SearchResultTrack;

export const toSearchResult = (result: LoadResult): SearchResult => {
  switch (result.loadType) {
    case "track":
      return {
        loadType: "track",
        tracks: [Track.fromValidated(result.data)],
      };

    case "search":
      return {
        loadType: "search",
        tracks: result.data.map((track) => Track.fromValidated(track)),
      };

    case "playlist":
      return {
        loadType: "playlist",
        playlistInfo: result.data.info,
        tracks: result.data.tracks.map((track) => Track.fromValidated(track)),
      };

    case "empty":
      return {
        loadType: "empty",
        tracks: [],
      };

    case "error":
      return {
        error: result.data,
        loadType: "error",
        tracks: [],
      };
  }
};
