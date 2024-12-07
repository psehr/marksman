import { OsuUser } from "./user";

export type BeatmapSet = {
  id: number;
  url: string;
  metadata: BeatmapMetadata;
  creator: OsuUser;
  status: BeatmapStatus;
  cover: string;
  slimcover: string;
  list: string;
  card: string;
  versions: BeatmapVersion[];
};

export type BeatmapVersion = {
  id: number;
  url: string;
  difficulty_name: string;
  metadata: BeatmapMetadata;
  attributes: BeatmapAttributes;
};

export type BeatmapMetadata = {
  title: string;
  titleUnicode: string;
  artist: string;
  artistUnicode: string;
};

export type BeatmapAttributes = {
  star_rating: number;
  bpm: number;
  overall_difficulty: number;
  approach_rate: number;
  drain_length: number;
  max_combo: number;
};

export type BeatmapStatus =
  | "graveyard"
  | "wip"
  | "pending"
  | "ranked"
  | "approved"
  | "qualified"
  | "loved";
