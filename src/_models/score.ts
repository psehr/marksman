export type OsuScore = {
  id: number;
  user: string;
  user_id: number;
  combo: number;
  accuracy: number;
  mods: Mod[];
  pass: boolean;
  timestamp: number;
  beatmap_id: number;
};

export type Grade =
  | "D"
  | "C"
  | "B"
  | "A"
  | "S"
  | "Silver S"
  | "SS"
  | "Silver SS";

export type Mod =
  | "nm"
  | "hr"
  | "dt"
  | "hd"
  | "ez"
  | "fl"
  | "ht"
  | "nc"
  | "nf"
  | "pf"
  | "sd"
  | "so"
  | "cl";
